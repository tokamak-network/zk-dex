/**
 * snarkjsUtils.js
 * Replacement for dockerUtils.js - uses snarkjs for proof generation
 * Uses circomlibjs for BabyJubJub and Poseidon operations (compatible with circom circuits)
 *
 * 7-input Poseidon note hash:
 * - Note hash: Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)
 * - Regular notes: owner0=pkX, owner1=pkY, vk0=pkX, vk1=pkY
 * - Smart notes: owner0=parentHash>>128, owner1=parentHash&MASK_128, vk0=owner0, vk1=owner1
 */

const snarkjs = require('snarkjs');
const path = require('path');
const fs = require('fs');
const circomlibBabyJub = require('./circomlibBabyJub');

const CIRCUITS_DIR = path.join(__dirname, '../../circuits-circom/build');

// Re-export circomlibBabyJub for convenience
const {
    PrivateKey, PublicKey, getPublicKey, randomSecretKey,
    init: initBabyJub, poseidonHash, truncateTo160Bits
} = circomlibBabyJub;

/**
 * Recursively convert all BigInt values in an object to their string representations for JSON serialization.
 * @param {bigint|Array|Object|*} obj - The value to convert; can be a BigInt, array, plain object, or primitive
 * @returns {string|Array|Object|*} A deep copy with all BigInt values replaced by their decimal string form
 */
function stringifyBigInts(obj) {
    if (typeof obj === 'bigint') {
        return obj.toString();
    }
    if (Array.isArray(obj)) {
        return obj.map(stringifyBigInts);
    }
    if (typeof obj === 'object' && obj !== null) {
        const result = {};
        for (const key in obj) {
            result[key] = stringifyBigInts(obj[key]);
        }
        return result;
    }
    return obj;
}

/**
 * Format proof for smart contract call (Groth16 format)
 * @param {Object} proof - snarkjs proof object
 * @param {Array} publicSignals - public signals array
 * @returns {Object} formatted proof for contract
 */
function formatProofForContract(proof, publicSignals) {
    // snarkjs Groth16 outputs: { pi_a, pi_b, pi_c }
    // Solidity expects: (uint[2] a, uint[2][2] b, uint[2] c, uint[] input)
    //
    // snarkjs returns public signals as [output, ...public_inputs]
    // This is the SAME order the Solidity verifier expects (circom outputs come first)

    return {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [
            [proof.pi_b[0][1], proof.pi_b[0][0]],  // Note: snarkjs outputs b in different order
            [proof.pi_b[1][1], proof.pi_b[1][0]]
        ],
        c: [proof.pi_c[0], proof.pi_c[1]],
        input: publicSignals
    };
}

/**
 * Generate proof for a circuit
 * @param {string} circuitName - name of the circuit (e.g., 'mint_burn_note')
 * @param {Object} inputs - circuit inputs
 * @returns {Promise<Object>} proof formatted for contract
 */
async function generateProof(circuitName, inputs) {
    const wasmPath = path.join(CIRCUITS_DIR, circuitName, `${circuitName}_js`, `${circuitName}.wasm`);
    const zkeyPath = path.join(CIRCUITS_DIR, circuitName, `${circuitName}.zkey`);

    // Check if files exist
    if (!fs.existsSync(wasmPath)) {
        throw new Error(`WASM file not found: ${wasmPath}. Run 'npm run compile' in circuits-circom first.`);
    }
    if (!fs.existsSync(zkeyPath)) {
        throw new Error(`zkey file not found: ${zkeyPath}. Run 'npm run setup' in circuits-circom first.`);
    }

    // Generate proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        stringifyBigInts(inputs),
        wasmPath,
        zkeyPath
    );

    return formatProofForContract(proof, publicSignals);
}

/**
 * Convert a hex string, number, or bigint to a BigInt value.
 * Handles 0x-prefixed hex strings, plain decimal strings, numbers, and existing bigints.
 * @param {string|number|bigint} hex - The value to convert
 * @returns {bigint} The value as a BigInt
 */
function hexToBigInt(hex) {
    if (typeof hex === 'bigint') return hex;
    if (typeof hex === 'number') return BigInt(hex);
    if (typeof hex === 'string') {
        const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
        // Handle decimal strings
        if (/^[0-9]+$/.test(cleanHex) && !hex.startsWith('0x')) {
            return BigInt(hex);
        }
        return BigInt('0x' + cleanHex);
    }
    throw new Error(`Cannot convert to BigInt: ${hex}`);
}

/**
 * Mask a value to 254 bits to fit within the BN128 finite field constraint.
 * @param {string|number|bigint} value - The value to mask (hex string, number, or bigint)
 * @returns {bigint} The value with only the lower 254 bits preserved
 */
function maskTo254Bits(value) {
    const mask = (BigInt(1) << BigInt(254)) - BigInt(1);
    return hexToBigInt(value) & mask;
}

/**
 * Compute note hash using Poseidon (7-input)
 * hash = Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)
 * @param {Object} note - Note object with owner0, owner1, value, token, vk0, vk1, salt
 * @returns {Promise<string>} Hash as decimal string
 */
async function computeCircuitHash(note) {
    const hash = await poseidonHash([
        hexToBigInt(note.owner0),
        hexToBigInt(note.owner1),
        hexToBigInt(note.value),
        hexToBigInt(note.token),
        hexToBigInt(note.vk0),
        hexToBigInt(note.vk1),
        hexToBigInt(note.salt)
    ]);

    return hash.toString();
}

/**
 * EMPTY_NOTE_HASH (Poseidon version, 7 zeros)
 * EMPTY_NOTE_HASH = Poseidon(0, 0, 0, 0, 0, 0, 0)
 * This will be computed on first use
 */
let EMPTY_NOTE_HASH = null;

/**
 * Compute and cache the Poseidon hash of an empty note (all-zero fields).
 * The result is Poseidon(0, 0, 0, 0, 0, 0, 0) and is cached after the first call.
 * @returns {Promise<string>} The empty note hash as a decimal string
 */
async function getEmptyNoteHash() {
    if (EMPTY_NOTE_HASH === null) {
        EMPTY_NOTE_HASH = await poseidonHash([0, 0, 0, 0, 0, 0, 0]);
    }
    return EMPTY_NOTE_HASH.toString();
}

/**
 * Get note hash from note object using Poseidon
 * For null/undefined notes, returns the EMPTY_NOTE_HASH
 */
async function getNoteHash(note) {
    if (!note) {
        return await getEmptyNoteHash();
    }
    // If note already has a computed Poseidon hash, use it
    if (note.poseidonHash) {
        return hexToBigInt(note.poseidonHash).toString();
    }
    // Always compute Poseidon hash from note fields
    return await computeCircuitHash(note);
}

/**
 * Reconstruct parentHash from a smart note's owner0/owner1 fields.
 * parentHash = owner0 * 2^128 + owner1
 * @param {Object} note - Note object with owner0, owner1
 * @returns {string} parentHash as decimal string
 */
function getParentHashFromNote(note) {
    const hi = hexToBigInt(note.owner0);
    const lo = hexToBigInt(note.owner1);
    return ((hi << BigInt(128)) + lo).toString();
}

/**
 * Generate proof for MintNBurnNote circuit
 * Circuit signals: noteHash, value, tokenType (public), owner0, owner1, vk0, vk1, salt, sk (private)
 * Public inputs: [noteHash, value, tokenType]
 */
async function getMintNBurnProof(note, sk) {
    const noteHash = await computeCircuitHash(note);

    const inputs = {
        noteHash,
        value: maskTo254Bits(note.value).toString(),
        tokenType: maskTo254Bits(note.token).toString(),
        owner0: hexToBigInt(note.owner0).toString(),
        owner1: hexToBigInt(note.owner1).toString(),
        vk0: hexToBigInt(note.vk0).toString(),
        vk1: hexToBigInt(note.vk1).toString(),
        salt: maskTo254Bits(note.salt).toString(),
        sk: maskTo254Bits(sk).toString()
    };

    return generateProof('mint_burn_note', inputs);
}

/**
 * Generate proof for TransferNote circuit
 * Circuit signals: 4 notes x (owner0, owner1, value, type, vk0, vk1, salt) + sk0, sk1
 * Public inputs: [o0Hash, o1Hash, newHash, changeHash]
 */
async function getTransferProof(oldNote0, oldNote1, newNote, changeNote, sk0, sk1) {
    const o0Hash = await getNoteHash(oldNote0);
    const o1Hash = await getNoteHash(oldNote1);
    const newHash = await getNoteHash(newNote);
    const changeHash = await getNoteHash(changeNote);

    const inputs = {
        // Public inputs
        o0Hash,
        o1Hash,
        newHash,
        changeHash,

        // Old note 0
        o0Owner0: hexToBigInt(oldNote0.owner0).toString(),
        o0Owner1: hexToBigInt(oldNote0.owner1).toString(),
        o0Value: hexToBigInt(oldNote0.value).toString(),
        o0Type: hexToBigInt(oldNote0.token).toString(),
        o0Vk0: hexToBigInt(oldNote0.vk0).toString(),
        o0Vk1: hexToBigInt(oldNote0.vk1).toString(),
        o0Salt: hexToBigInt(oldNote0.salt).toString(),

        // Old note 1
        o1Owner0: oldNote1 ? hexToBigInt(oldNote1.owner0).toString() : '0',
        o1Owner1: oldNote1 ? hexToBigInt(oldNote1.owner1).toString() : '0',
        o1Value: oldNote1 ? hexToBigInt(oldNote1.value).toString() : '0',
        o1Type: oldNote1 ? hexToBigInt(oldNote1.token).toString() : '0',
        o1Vk0: oldNote1 ? hexToBigInt(oldNote1.vk0).toString() : '0',
        o1Vk1: oldNote1 ? hexToBigInt(oldNote1.vk1).toString() : '0',
        o1Salt: oldNote1 ? hexToBigInt(oldNote1.salt).toString() : '0',

        // New note
        nOwner0: hexToBigInt(newNote.owner0).toString(),
        nOwner1: hexToBigInt(newNote.owner1).toString(),
        nValue: hexToBigInt(newNote.value).toString(),
        nType: hexToBigInt(newNote.token).toString(),
        nVk0: hexToBigInt(newNote.vk0).toString(),
        nVk1: hexToBigInt(newNote.vk1).toString(),
        nSalt: hexToBigInt(newNote.salt).toString(),

        // Change note
        cOwner0: hexToBigInt(changeNote.owner0).toString(),
        cOwner1: hexToBigInt(changeNote.owner1).toString(),
        cValue: hexToBigInt(changeNote.value).toString(),
        cType: hexToBigInt(changeNote.token).toString(),
        cVk0: hexToBigInt(changeNote.vk0).toString(),
        cVk1: hexToBigInt(changeNote.vk1).toString(),
        cSalt: hexToBigInt(changeNote.salt).toString(),

        // Secret keys
        sk0: hexToBigInt(sk0).toString(),
        sk1: sk1 ? hexToBigInt(sk1).toString() : '0'
    };

    return generateProof('transfer_note', inputs);
}

/**
 * Generate proof for ConvertNote circuit
 * Circuit signals: smart note (7 fields), origin note (7 fields), new note (7 fields), sk
 * Public inputs: [smartHash, originHash, newHash]
 */
async function getConvertProof(smartNote, originNote, newNote, sk) {
    const smartHash = await getNoteHash(smartNote);
    const originHash = await getNoteHash(originNote);
    const newHash = await getNoteHash(newNote);

    const inputs = {
        // Public inputs
        smartHash,
        originHash,
        newHash,

        // Smart note
        smartOwner0: hexToBigInt(smartNote.owner0).toString(),
        smartOwner1: hexToBigInt(smartNote.owner1).toString(),
        smartValue: hexToBigInt(smartNote.value).toString(),
        smartType: hexToBigInt(smartNote.token).toString(),
        smartVk0: hexToBigInt(smartNote.vk0).toString(),
        smartVk1: hexToBigInt(smartNote.vk1).toString(),
        smartSalt: hexToBigInt(smartNote.salt).toString(),

        // Origin note
        originOwner0: hexToBigInt(originNote.owner0).toString(),
        originOwner1: hexToBigInt(originNote.owner1).toString(),
        originValue: hexToBigInt(originNote.value).toString(),
        originType: hexToBigInt(originNote.token).toString(),
        originVk0: hexToBigInt(originNote.vk0).toString(),
        originVk1: hexToBigInt(originNote.vk1).toString(),
        originSalt: hexToBigInt(originNote.salt).toString(),

        // New note
        nOwner0: hexToBigInt(newNote.owner0).toString(),
        nOwner1: hexToBigInt(newNote.owner1).toString(),
        nValue: hexToBigInt(newNote.value).toString(),
        nType: hexToBigInt(newNote.token).toString(),
        nVk0: hexToBigInt(newNote.vk0).toString(),
        nVk1: hexToBigInt(newNote.vk1).toString(),
        nSalt: hexToBigInt(newNote.salt).toString(),

        sk: hexToBigInt(sk).toString()
    };

    return generateProof('convert_note', inputs);
}

/**
 * Generate proof for MakeOrder circuit
 * Circuit signals: noteHash, tokenType (public), owner0, owner1, value, vk0, vk1, salt, sk (private)
 * Public inputs: [noteHash, tokenType]
 */
async function getMakeOrderProof(makerNote, sk) {
    const noteHash = await getNoteHash(makerNote);

    const inputs = {
        noteHash,
        tokenType: hexToBigInt(makerNote.token).toString(),
        owner0: hexToBigInt(makerNote.owner0).toString(),
        owner1: hexToBigInt(makerNote.owner1).toString(),
        value: hexToBigInt(makerNote.value).toString(),
        vk0: hexToBigInt(makerNote.vk0).toString(),
        vk1: hexToBigInt(makerNote.vk1).toString(),
        salt: hexToBigInt(makerNote.salt).toString(),
        sk: hexToBigInt(sk).toString()
    };

    return generateProof('make_order', inputs);
}

/**
 * Generate proof for TakeOrder circuit
 * Circuit signals: oldNoteHash, oldType, newNoteHash, newParentHash, newType (public)
 *                  oldOwner0, oldOwner1, oldValue, oldVk0, oldVk1, oldSalt,
 *                  newValue, newVk0, newVk1, newSalt, sk (private)
 * Public inputs: [oldNoteHash, oldType, newNoteHash, newParentHash, newType]
 */
async function getTakeOrderProof(parentNote, stakeNote, sk) {
    const oldNoteHash = await getNoteHash(parentNote);
    const newNoteHash = await getNoteHash(stakeNote);

    const inputs = {
        // Public inputs
        oldNoteHash,
        oldType: hexToBigInt(parentNote.token).toString(),
        newNoteHash,
        newParentHash: getParentHashFromNote(stakeNote),
        newType: hexToBigInt(stakeNote.token).toString(),

        // Parent note private
        oldOwner0: hexToBigInt(parentNote.owner0).toString(),
        oldOwner1: hexToBigInt(parentNote.owner1).toString(),
        oldValue: hexToBigInt(parentNote.value).toString(),
        oldVk0: hexToBigInt(parentNote.vk0).toString(),
        oldVk1: hexToBigInt(parentNote.vk1).toString(),
        oldSalt: hexToBigInt(parentNote.salt).toString(),

        // Stake note private
        newValue: hexToBigInt(stakeNote.value).toString(),
        newVk0: hexToBigInt(stakeNote.vk0).toString(),
        newVk1: hexToBigInt(stakeNote.vk1).toString(),
        newSalt: hexToBigInt(stakeNote.salt).toString(),

        sk: hexToBigInt(sk).toString()
    };

    return generateProof('take_order', inputs);
}

/**
 * Generate proof for SettleOrder circuit
 * Public inputs: [o0Hash, o0Type, o1Hash, o1Type,
 *                 n0Hash, n0ParentHash, n0Type,
 *                 n1Hash, n1ParentHash, n1Type,
 *                 n2Hash, n2Type, price]
 */
async function getSettleOrderProof(
    makerNote,      // o0
    takerStakeNote, // o1
    rewardNote,     // n0
    paymentNote,    // n1
    changeNote,     // n2
    price,
    sk,
    q0, r0, q1, r1  // Division witnesses
) {
    const o0Hash = await getNoteHash(makerNote);
    const o1Hash = await getNoteHash(takerStakeNote);
    const n0Hash = await getNoteHash(rewardNote);
    const n1Hash = await getNoteHash(paymentNote);
    const n2Hash = await getNoteHash(changeNote);

    const inputs = {
        // Public inputs
        o0Hash,
        o0Type: hexToBigInt(makerNote.token).toString(),
        o1Hash,
        o1Type: hexToBigInt(takerStakeNote.token).toString(),
        n0Hash,
        n0ParentHash: getParentHashFromNote(rewardNote),
        n0Type: hexToBigInt(rewardNote.token).toString(),
        n1Hash,
        n1ParentHash: getParentHashFromNote(paymentNote),
        n1Type: hexToBigInt(paymentNote.token).toString(),
        n2Hash,
        n2Type: hexToBigInt(changeNote.token).toString(),
        price: hexToBigInt(price).toString(),

        // Maker note private (regular note)
        o0Owner0: hexToBigInt(makerNote.owner0).toString(),
        o0Owner1: hexToBigInt(makerNote.owner1).toString(),
        o0Value: hexToBigInt(makerNote.value).toString(),
        o0Vk0: hexToBigInt(makerNote.vk0).toString(),
        o0Vk1: hexToBigInt(makerNote.vk1).toString(),
        o0Salt: hexToBigInt(makerNote.salt).toString(),

        // Taker stake note private (smart note)
        o1Owner0: hexToBigInt(takerStakeNote.owner0).toString(),
        o1Owner1: hexToBigInt(takerStakeNote.owner1).toString(),
        o1Value: hexToBigInt(takerStakeNote.value).toString(),
        o1Vk0: hexToBigInt(takerStakeNote.vk0).toString(),
        o1Vk1: hexToBigInt(takerStakeNote.vk1).toString(),
        o1Salt: hexToBigInt(takerStakeNote.salt).toString(),

        // Reward note private (value, vk, salt only - owner comes from n0ParentHash split)
        n0Value: hexToBigInt(rewardNote.value).toString(),
        n0Vk0: hexToBigInt(rewardNote.vk0).toString(),
        n0Vk1: hexToBigInt(rewardNote.vk1).toString(),
        n0Salt: hexToBigInt(rewardNote.salt).toString(),

        // Payment note private (value, vk, salt only - owner comes from n1ParentHash split)
        n1Value: hexToBigInt(paymentNote.value).toString(),
        n1Vk0: hexToBigInt(paymentNote.vk0).toString(),
        n1Vk1: hexToBigInt(paymentNote.vk1).toString(),
        n1Salt: hexToBigInt(paymentNote.salt).toString(),

        // Change note private (full note)
        n2Owner0: hexToBigInt(changeNote.owner0).toString(),
        n2Owner1: hexToBigInt(changeNote.owner1).toString(),
        n2Value: hexToBigInt(changeNote.value).toString(),
        n2Vk0: hexToBigInt(changeNote.vk0).toString(),
        n2Vk1: hexToBigInt(changeNote.vk1).toString(),
        n2Salt: hexToBigInt(changeNote.salt).toString(),

        // Division witnesses
        q0: q0.toString(),
        r0: r0.toString(),
        q1: q1.toString(),
        r1: r1.toString(),

        sk: hexToBigInt(sk).toString()
    };

    return generateProof('settle_order', inputs);
}

/**
 * Verify a Groth16 proof locally using the circuit's verification key (for testing).
 * @param {string} circuitName - The name of the circuit (e.g., 'mint_burn_note', 'transfer_note')
 * @param {Object} proof - The formatted proof object containing a, b, and c arrays
 * @param {Array<string>} publicSignals - The array of public signal values
 * @returns {Promise<boolean>} True if the proof is valid, false otherwise
 */
async function verifyProofLocal(circuitName, proof, publicSignals) {
    const vkeyPath = path.join(CIRCUITS_DIR, circuitName, `${circuitName}_vkey.json`);
    const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));

    // Reconstruct proof object from formatted proof
    const proofObj = {
        pi_a: [proof.a[0], proof.a[1], '1'],
        pi_b: [
            [proof.b[0][1], proof.b[0][0]],
            [proof.b[1][1], proof.b[1][0]],
            ['1', '0']
        ],
        pi_c: [proof.c[0], proof.c[1], '1'],
        protocol: 'groth16'
    };

    return snarkjs.groth16.verify(vkey, publicSignals, proofObj);
}

/**
 * Check if the circuit build artifacts (WASM files) are available on disk.
 * Tests for the existence of the mint_burn_note WASM file as a proxy for all circuits.
 * @returns {Promise<boolean>} True if the circuit WASM files exist, false otherwise
 */
async function initialized() {
    const testWasm = path.join(CIRCUITS_DIR, 'mint_burn_note', 'mint_burn_note_js', 'mint_burn_note.wasm');
    return fs.existsSync(testWasm);
}

/**
 * Derive 160-bit address from BabyJubJub public key using Poseidon
 * address = Poseidon(pk.x, pk.y) truncated to 160 bits
 * @param {Object} publicKey - Public key with x, y coordinates
 * @returns {Promise<string>} 160-bit address as hex string (40 chars, with 0x prefix)
 */
async function getAddressFromPublicKey(publicKey) {
    // Validate input
    if (!publicKey || !publicKey.x || !publicKey.y) {
        throw new Error(`Invalid publicKey: ${JSON.stringify(publicKey)}`);
    }

    // Poseidon hash of public key coordinates
    const hash = await poseidonHash([
        hexToBigInt(publicKey.x),
        hexToBigInt(publicKey.y)
    ]);

    // Truncate to 160 bits
    const address = truncateTo160Bits(hash);
    return '0x' + address.toString(16).padStart(40, '0');
}

module.exports = {
    // Proof generation
    getMintNBurnProof,
    getTransferProof,
    getConvertProof,
    getMakeOrderProof,
    getTakeOrderProof,
    getSettleOrderProof,
    verifyProofLocal,
    initialized,
    generateProof,
    formatProofForContract,

    // Hash utilities
    computeCircuitHash,
    getNoteHash,
    getEmptyNoteHash,
    poseidonHash,
    getParentHashFromNote,

    // Address utilities
    getAddressFromPublicKey,
    truncateTo160Bits,

    // BabyJubJub (circomlib compatible)
    PrivateKey,
    PublicKey,
    getPublicKey,
    randomSecretKey,
    initBabyJub
};
