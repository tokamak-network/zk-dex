/**
 * noteProofHelper.js
 * Integration helper between Note.js and snarkjsUtils.js
 *
 * This module provides:
 * - Note creation with circomlib-compatible public keys
 * - Proof generation from Note objects
 * - Hash format conversion utilities
 *
 * 7-input Poseidon note hash:
 * - Regular notes: Note(pkX, pkY, value, token, pkX, pkY, salt)
 * - Smart notes: Note(parentHash_hi, parentHash_lo, value, token, parentHash_hi, parentHash_lo, salt)
 */

const Web3Utils = require('web3-utils');
const crypto = require('crypto');
const RLP = require('rlp');
const { Note, constants, init: initNote, createSmartNote: noteCreateSmartNote } = require('./Note');
const snarkjsUtils = require('./snarkjsUtils');
const circomlibBabyJub = require('./circomlibBabyJub');
const ecdhCrypto = require('./ecdhCrypto');

/**
 * Initialize the crypto libraries (including Poseidon for Note.hash())
 */
async function init() {
    await circomlibBabyJub.init();
    await initNote();
}

/**
 * Generate a new keypair using circomlib-compatible BabyJubJub
 * @returns {Promise<{sk: string, pk: {x: string, y: string}}>}
 */
async function generateKeypair() {
    await init();

    const sk = await circomlibBabyJub.randomSecretKey();
    const pk = await circomlibBabyJub.getPublicKey(sk);

    return {
        sk: '0x' + sk.toString(16).padStart(64, '0'),
        pk: {
            x: '0x' + pk.x.toString(16).padStart(64, '0'),
            y: '0x' + pk.y.toString(16).padStart(64, '0')
        }
    };
}

/**
 * Derive public key from secret key
 * @param {string} sk - Secret key (hex string)
 * @returns {Promise<{x: string, y: string}>}
 */
async function derivePublicKey(sk) {
    await init();

    const skBigInt = BigInt(sk.startsWith('0x') ? sk : '0x' + sk);
    const pk = await circomlibBabyJub.getPublicKey(skBigInt);

    return {
        x: '0x' + pk.x.toString(16).padStart(64, '0'),
        y: '0x' + pk.y.toString(16).padStart(64, '0')
    };
}

/**
 * Convert a value to a 0x-prefixed hex string, handling BigInt, string, and numeric types.
 * @param {bigint|string|number} value - The value to convert (BigInt, hex string, or number)
 * @returns {string} The value as a 0x-prefixed hex string
 */
function toHexString(value) {
    if (typeof value === 'bigint') {
        return '0x' + value.toString(16);
    }
    if (typeof value === 'string' && value.startsWith('0x')) {
        return value;
    }
    return Web3Utils.toHex(value);
}

/**
 * Create a new note with a circomlib-compatible owner public key.
 *
 * Regular note: owner0=pkX, owner1=pkY, vk0=pkX, vk1=pkY
 * hash = Poseidon(pkX, pkY, value, tokenType, pkX, pkY, salt)
 *
 * @param {string} sk - Secret key of the owner
 * @param {string|number|bigint} value - Note value
 * @param {string} tokenType - Token type (ETH or DAI)
 * @param {string} _unused - Unused parameter (kept for API compatibility)
 * @param {string} salt - Optional salt (random if not provided)
 * @returns {Promise<{note: Note, sk: string}>}
 */
async function createNote(sk, value, tokenType = constants.ETH_TOKEN_TYPE, _unused = null, salt = null) {
    const pk = await derivePublicKey(sk);

    // Generate random salt if not provided (masked to 254 bits for circuit compatibility)
    if (!salt) {
        const saltBigInt = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
        const mask254 = (BigInt(1) << BigInt(254)) - BigInt(1);
        salt = '0x' + (saltBigInt & mask254).toString(16).padStart(64, '0');
    }

    // Convert value to hex string (handles BigInt)
    const valueHex = toHexString(value);

    // Regular note: owner = pk, vk = pk
    const note = new Note(
        pk.x,       // owner0 = pkX
        pk.y,       // owner1 = pkY
        valueHex,
        tokenType,
        pk.x,       // vk0 = pkX
        pk.y,       // vk1 = pkY
        salt
    );

    return { note, sk };
}

/**
 * Create an empty note
 * @returns {Note}
 */
function createEmptyNote() {
    return constants.EMPTY_NOTE;
}

/**
 * Create a smart note (stake note) for TakeOrder.
 * Smart note: owner0=parentHash_hi, owner1=parentHash_lo, vk0=owner0, vk1=owner1
 *
 * @param {Note} ownerNote - The note whose hash will be the parent (e.g., maker note)
 * @param {string|number|bigint} value - Note value
 * @param {string} tokenType - Token type
 * @param {string} _unused - Unused parameter (kept for API compatibility)
 * @param {string} salt - Optional salt (random if not provided)
 * @returns {Note}
 */
function createSmartNote(ownerNote, value, tokenType, _unused = null, salt = null) {
    // Generate random salt if not provided
    if (!salt) {
        const saltBigInt = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
        const mask254 = (BigInt(1) << BigInt(254)) - BigInt(1);
        salt = '0x' + (saltBigInt & mask254).toString(16).padStart(64, '0');
    }

    // Convert value to hex string (handles BigInt)
    const valueHex = toHexString(value);

    // Delegate to Note.js createSmartNote which splits parentHash into owner0/owner1
    return noteCreateSmartNote(ownerNote, valueHex, tokenType, salt);
}

/**
 * Generate a mint/burn proof for a note
 * @param {Note} note - The note to prove
 * @param {string} sk - Secret key of the note owner
 * @returns {Promise<Object>} Proof formatted for smart contract
 */
async function generateMintProof(note, sk) {
    return await snarkjsUtils.getMintNBurnProof(note, sk);
}

/**
 * Generate a transfer proof
 * @param {Note} oldNote0 - First input note
 * @param {Note} oldNote1 - Second input note (can be null)
 * @param {Note} newNote - Output note to recipient
 * @param {Note} changeNote - Change note back to sender
 * @param {string} sk0 - Secret key for oldNote0
 * @param {string} sk1 - Secret key for oldNote1 (can be null)
 * @returns {Promise<Object>} Proof formatted for smart contract
 */
async function generateTransferProof(oldNote0, oldNote1, newNote, changeNote, sk0, sk1) {
    return await snarkjsUtils.getTransferProof(oldNote0, oldNote1, newNote, changeNote, sk0, sk1);
}

/**
 * Generate a make order proof
 * @param {Note} makerNote - The maker's note
 * @param {string} sk - Secret key of the maker
 * @returns {Promise<Object>} Proof formatted for smart contract
 */
async function generateMakeOrderProof(makerNote, sk) {
    return await snarkjsUtils.getMakeOrderProof(makerNote, sk);
}

/**
 * Generate a take order proof
 * @param {Note} parentNote - The parent note
 * @param {Note} stakeNote - The stake note
 * @param {string} sk - Secret key
 * @returns {Promise<Object>} Proof formatted for smart contract
 */
async function generateTakeOrderProof(parentNote, stakeNote, sk) {
    return await snarkjsUtils.getTakeOrderProof(parentNote, stakeNote, sk);
}

/**
 * Generate a convert note proof
 * @param {Note} smartNote - Smart note to convert
 * @param {Note} originNote - Original note
 * @param {Note} newNote - New output note
 * @param {string} sk - Secret key
 * @returns {Promise<Object>} Proof formatted for smart contract
 */
async function generateConvertProof(smartNote, originNote, newNote, sk) {
    return await snarkjsUtils.getConvertProof(smartNote, originNote, newNote, sk);
}

/**
 * Generate a settle order proof
 * @param {Note} makerNote - Maker's note
 * @param {Note} takerStakeNote - Taker's stake note
 * @param {Note} rewardNote - Reward note
 * @param {Note} paymentNote - Payment note
 * @param {Note} changeNote - Change note
 * @param {string|number} price - Order price
 * @param {string} sk - Secret key
 * @returns {Promise<Object>} Proof formatted for smart contract
 */
async function generateSettleOrderProof(makerNote, takerStakeNote, rewardNote, paymentNote, changeNote, price, sk) {
    // Calculate division witnesses for price calculations
    // Must match circuit constraints:
    // Line 160: o0Value * price === q0 * 10^18 + r0
    // Line 174: o1Value === q1 * price + r1

    const makerValue = BigInt(makerNote.value);
    const takerValue = BigInt(takerStakeNote.value);
    const priceValue = BigInt(price);
    const SCALING = BigInt(10) ** BigInt(18);

    // For q0, r0: o0Value * price = q0 * SCALING + r0
    const o0ValueTimesPrice = makerValue * priceValue;
    const q0 = o0ValueTimesPrice / SCALING;
    const r0 = o0ValueTimesPrice % SCALING;

    // For q1, r1: o1Value = q1 * price + r1
    const q1 = takerValue / priceValue;
    const r1 = takerValue % priceValue;

    return await snarkjsUtils.getSettleOrderProof(
        makerNote,
        takerStakeNote,
        rewardNote,
        paymentNote,
        changeNote,
        price,
        sk,
        q0, r0, q1, r1
    );
}

/**
 * Verify a proof locally
 * @param {string} circuitName - Name of the circuit
 * @param {Object} proof - The proof object
 * @param {Array} publicSignals - Public signals
 * @returns {Promise<boolean>} True if valid
 */
async function verifyProof(circuitName, proof, publicSignals) {
    return await snarkjsUtils.verifyProofLocal(circuitName, proof, publicSignals);
}

/**
 * Encrypt a Note object for on-chain storage using ECDH
 * RLP-encodes note fields then encrypts with recipient's BabyJubJub public key
 *
 * @param {Note} note - The note to encrypt
 * @param {{x: bigint, y: bigint}} recipientPk - Recipient's BabyJubJub public key
 * @returns {Promise<string>} ECDH-encrypted hex string
 */
async function encryptNoteForRecipient(note, recipientPk) {
    // RLP-encode note fields: [owner0, owner1, value, token, vk0, vk1, salt]
    function hexToBuffer(hexStr) {
        const clean = hexStr.replace('0x', '');
        // Remove leading zeros but keep at least 2 chars
        const trimmed = clean.replace(/^0+/, '') || '00';
        const padded = trimmed.length % 2 === 0 ? trimmed : '0' + trimmed;
        return Buffer.from(padded, 'hex');
    }

    const fields = [
        hexToBuffer(note.owner0),
        hexToBuffer(note.owner1),
        hexToBuffer(note.value),
        hexToBuffer(note.token),
        hexToBuffer(note.vk0),
        hexToBuffer(note.vk1),
        hexToBuffer(note.salt)
    ];
    const rlpEncoded = RLP.encode(fields);

    // Normalize pk to {x: bigint, y: bigint} (accepts hex strings or bigints)
    const pk = {
        x: typeof recipientPk.x === 'bigint' ? recipientPk.x : BigInt(recipientPk.x),
        y: typeof recipientPk.y === 'bigint' ? recipientPk.y : BigInt(recipientPk.y)
    };

    return await ecdhCrypto.encryptForRecipient(Buffer.from(rlpEncoded), pk);
}

/**
 * Format proof for contract call with note encryption
 * @param {Object} proof - The proof object
 * @param {Note} note - The note to encrypt
 * @param {string} encKey - Encryption key (legacy)
 * @returns {Object} Proof and encrypted note for contract
 */
function formatProofWithEncryptedNote(proof, note, encKey) {
    return {
        a: proof.a,
        b: proof.b,
        c: proof.c,
        input: proof.input,
        encryptedNote: note.encrypt(encKey)
    };
}

/**
 * Parse proof array for legacy contract compatibility
 * @param {Object} proof - Groth16 proof object
 * @returns {Array} Proof as array for contract call
 */
function proofToArray(proof) {
    return [
        proof.a,
        proof.b,
        proof.c,
        proof.input
    ];
}

module.exports = {
    // Initialization
    init,

    // Key management
    generateKeypair,
    derivePublicKey,

    // Note creation
    createNote,
    createEmptyNote,
    createSmartNote,

    // Proof generation
    generateMintProof,
    generateTransferProof,
    generateMakeOrderProof,
    generateTakeOrderProof,
    generateConvertProof,
    generateSettleOrderProof,

    // Proof verification
    verifyProof,

    // Utilities
    encryptNoteForRecipient,
    formatProofWithEncryptedNote,
    proofToArray,

    // Re-export constants
    constants: {
        ETH_TOKEN_TYPE: constants.ETH_TOKEN_TYPE,
        DAI_TOKEN_TYPE: constants.DAI_TOKEN_TYPE,
        EMPTY_NOTE_HASH: constants.EMPTY_NOTE_HASH
    }
};
