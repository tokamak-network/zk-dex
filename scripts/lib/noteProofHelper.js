/**
 * noteProofHelper.js
 * Integration helper between Note.js and snarkjsUtils.js
 *
 * This module provides:
 * - Note creation with circomlib-compatible public keys
 * - Proof generation from Note objects
 * - Hash format conversion utilities
 */

const Web3Utils = require('web3-utils');
const crypto = require('crypto');
const { Note, constants, init: initNote, getSmartNoteOwner } = require('./Note');
const snarkjsUtils = require('./snarkjsUtils');
const circomlibBabyJub = require('./circomlibBabyJub');

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
 * Convert value to hex string (handles BigInt)
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
 * Derive 160-bit address from BabyJubJub public key using Poseidon
 * address = Poseidon(pk.x, pk.y) truncated to 160 bits
 * @param {{x: string, y: string}} pk - Public key
 * @returns {Promise<string>} 160-bit address (40 hex chars with 0x prefix)
 */
async function deriveAddressFromPK(pk) {
    return await snarkjsUtils.getAddressFromPublicKey(pk);
}

/**
 * Create a new note with a circomlib-compatible owner public key
 *
 * Viewing key derivation:
 * - viewingKey = SHA256(pk.x || pk.y) = 256 bits
 * - ownerAddress = viewingKey[96:256] = last 160 bits
 *
 * This relationship allows:
 * - Anyone with the viewing key can derive the owner address
 * - Only the secret key holder can prove ownership and spend
 *
 * @param {string} sk - Secret key of the owner
 * @param {string|number|bigint} value - Note value
 * @param {string} tokenType - Token type (ETH or DAI)
 * @param {string} viewingKey - Optional viewing key (if null, derived from pk)
 * @param {string} salt - Optional salt (random if not provided)
 * @returns {Promise<{note: Note, sk: string}>}
 */
async function createNote(sk, value, tokenType = constants.ETH_TOKEN_TYPE, viewingKey = null, salt = null) {
    const pk = await derivePublicKey(sk);

    // Derive 160-bit address from public key using Poseidon
    const ownerAddress = await deriveAddressFromPK(pk);

    // Derive viewing key from public key if not provided
    // viewingKey = Poseidon(pk.x, pk.y) = 254-bit field element
    // Relationship: ownerAddress = truncate160(viewingKey)
    if (!viewingKey) {
        const vkData = await snarkjsUtils.getViewingKeyFromPublicKey(pk);
        viewingKey = vkData.vk;  // Use 'vk' which contains the full Poseidon hash
    }

    // Generate random salt if not provided (masked to 254 bits for circuit compatibility)
    if (!salt) {
        // Generate 32 bytes but mask to 254 bits to fit in BN128 field
        const saltBigInt = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
        const mask254 = (BigInt(1) << BigInt(254)) - BigInt(1);
        salt = '0x' + (saltBigInt & mask254).toString(16).padStart(64, '0');
    }

    // Convert value to hex string (handles BigInt)
    const valueHex = toHexString(value);

    // Note constructor already calls padLeft, no need to double-pad
    const note = new Note(
        ownerAddress,
        valueHex,
        tokenType,
        viewingKey,
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
 * Create a smart note (stake note) for TakeOrder
 * Smart notes have ownerAddress = truncated 160-bit hash of another note
 *
 * Viewing key derivation for smart notes:
 * - viewingKey = parentNoteHash = 256 bits
 * - ownerAddress = truncated(parentNoteHash) = h0[96:128] + h1 = 160 bits
 *
 * This maintains the same relationship as normal notes:
 * - ownerAddress is embedded within the viewing key
 *
 * @param {Note} ownerNote - The note whose hash will be the owner (e.g., maker note)
 * @param {string|number|bigint} value - Note value
 * @param {string} tokenType - Token type
 * @param {string} viewingKey - Optional viewing key (if null, derived from owner note hash)
 * @param {string} salt - Optional salt (random if not provided)
 * @returns {Note}
 */
function createSmartNote(ownerNote, value, tokenType, viewingKey = null, salt = null) {
    // Generate random salt if not provided
    if (!salt) {
        const saltBigInt = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
        const mask254 = (BigInt(1) << BigInt(254)) - BigInt(1);
        salt = '0x' + (saltBigInt & mask254).toString(16).padStart(64, '0');
    }

    // Get owner note hash (Poseidon, sync after init)
    const ownerHash = ownerNote.hash();

    // Derive ownerAddress as truncated hash (lower 160 bits)
    const ownerAddress = getSmartNoteOwner(ownerHash);

    // Derive viewing key from owner note hash if not provided
    if (!viewingKey) {
        viewingKey = ownerHash;
    }

    // Convert value to hex string (handles BigInt)
    const valueHex = toHexString(value);

    const note = new Note(
        ownerAddress,
        valueHex,
        tokenType,
        viewingKey,
        salt
    );

    return note;
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
 * Format proof for contract call with note encryption
 * @param {Object} proof - The proof object
 * @param {Note} note - The note to encrypt
 * @param {string} encKey - Encryption key
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
    deriveAddressFromPK,

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
    formatProofWithEncryptedNote,
    proofToArray,

    // Re-export constants
    constants: {
        ETH_TOKEN_TYPE: constants.ETH_TOKEN_TYPE,
        DAI_TOKEN_TYPE: constants.DAI_TOKEN_TYPE,
        EMPTY_NOTE_HASH: constants.EMPTY_NOTE_HASH
    }
};
