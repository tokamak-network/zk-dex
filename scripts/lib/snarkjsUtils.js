/**
 * snarkjsUtils.js
 * Replacement for dockerUtils.js - uses snarkjs for proof generation
 * Uses circomlibjs for BabyJubJub operations (compatible with circom circuits)
 */

const snarkjs = require('snarkjs');
const path = require('path');
const fs = require('fs');
const circomlibBabyJub = require('./circomlibBabyJub');

const CIRCUITS_DIR = path.join(__dirname, '../../circuits-circom/build');

// Re-export circomlibBabyJub for convenience
const { PrivateKey, PublicKey, getPublicKey, randomSecretKey, init: initBabyJub } = circomlibBabyJub;

/**
 * Convert BigInt to string for JSON serialization
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
    // No reordering needed!

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
    const wasmPath = path.join(CIRCUITS_DIR, `${circuitName}_js`, `${circuitName}.wasm`);
    const zkeyPath = path.join(CIRCUITS_DIR, `${circuitName}.zkey`);

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
 * Convert hex string to BigInt
 */
function hexToBigInt(hex) {
    if (typeof hex === 'bigint') return hex;
    if (typeof hex === 'number') return BigInt(hex);
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    return BigInt('0x' + cleanHex);
}

/**
 * Mask value to 254 bits (BN128 field constraint)
 */
function maskTo254Bits(value) {
    const mask = (BigInt(1) << BigInt(254)) - BigInt(1);
    return hexToBigInt(value) & mask;
}

/**
 * Compute note hash matching circuit computation (1536-bit SHA256)
 * The circuit uses 254-bit field elements padded to 256 bits with 2 leading zeros
 * @param {Object} note - Note object with owner0, owner1, value, token, viewingKey, salt
 * @returns {{h0: string, h1: string}} Hash split into two 128-bit parts
 */
function computeCircuitHash(note) {
    const crypto = require('crypto');

    // Helper to convert a field element (254 bits max) to 32 bytes (big-endian)
    function fieldTo32Bytes(val) {
        const bigVal = maskTo254Bits(val);
        const hex = bigVal.toString(16).padStart(64, '0');
        return Buffer.from(hex, 'hex');
    }

    // Helper to convert 128-bit value to 16 bytes
    function to16Bytes(val) {
        const bigVal = hexToBigInt(val) & ((BigInt(1) << BigInt(128)) - BigInt(1));
        const hex = bigVal.toString(16).padStart(32, '0');
        return Buffer.from(hex, 'hex');
    }

    // Build 192-byte (1536-bit) message matching circuit structure:
    // owner0 (32B) | owner1 (32B) | value (32B) | type (32B) | vk0||vk1 (32B) | salt (32B)
    const [vk0, vk1] = split256To128(note.viewingKey);

    const message = Buffer.concat([
        fieldTo32Bytes(note.owner0),      // 32 bytes
        fieldTo32Bytes(note.owner1),      // 32 bytes
        fieldTo32Bytes(note.value),       // 32 bytes
        fieldTo32Bytes(note.token),       // 32 bytes
        to16Bytes(vk0),                   // 16 bytes (vk high part)
        to16Bytes(vk1),                   // 16 bytes (vk low part)
        fieldTo32Bytes(note.salt)         // 32 bytes
    ]);

    // Compute SHA256
    const digest = crypto.createHash('sha256').update(message).digest('hex');

    // Split into two 128-bit parts
    return {
        h0: digest.slice(0, 32),  // First 128 bits (high)
        h1: digest.slice(32)      // Last 128 bits (low)
    };
}

/**
 * Split 256-bit value into two 128-bit values
 */
function split256To128(value) {
    const bigValue = hexToBigInt(value);
    const mask128 = (BigInt(1) << BigInt(128)) - BigInt(1);
    const low = bigValue & mask128;
    const high = bigValue >> BigInt(128);
    return [high.toString(), low.toString()];
}

/**
 * EMPTY_NOTE_HASH parts (precomputed)
 * EMPTY_NOTE_HASH = 0x5d89f056865052bcb89c910d2d62872e029fb273c3db03f8968a52a41593c1b5
 */
const EMPTY_NOTE_HASH_PARTS = ['124334422911111396289769072584791590702', '3487650632839358898875693501852664245'];

/**
 * Get note hash parts from note object
 * For null/undefined notes, returns the EMPTY_NOTE_HASH parts
 */
function getNoteHashParts(note) {
    if (!note) {
        return EMPTY_NOTE_HASH_PARTS;
    }
    const hash = note.hash ? note.hash() : note.noteHash;
    return split256To128(hash);
}

/**
 * Generate proof for MintNBurnNote circuit
 */
async function getMintNBurnProof(note, sk) {
    // Use circuit-compatible hash computation
    const circuitHash = computeCircuitHash(note);
    const nh0 = BigInt('0x' + circuitHash.h0).toString();
    const nh1 = BigInt('0x' + circuitHash.h1).toString();

    const [vk0, vk1] = split256To128(note.viewingKey);

    const inputs = {
        nh0,
        nh1,
        value: maskTo254Bits(note.value).toString(),
        tokenType: maskTo254Bits(note.token).toString(),
        owner0: maskTo254Bits(note.owner0).toString(),
        owner1: maskTo254Bits(note.owner1).toString(),
        vk0,
        vk1,
        salt: maskTo254Bits(note.salt).toString(),
        sk: maskTo254Bits(sk).toString()
    };

    return generateProof('mint_burn_note', inputs);
}

/**
 * Generate proof for TransferNote circuit
 */
async function getTransferProof(oldNote0, oldNote1, newNote, changeNote, sk0, sk1) {
    const [o0h0, o0h1] = getNoteHashParts(oldNote0);
    const [o1h0, o1h1] = getNoteHashParts(oldNote1);  // Now handles null correctly
    const [nh0, nh1] = getNoteHashParts(newNote);
    const [changeH0, changeH1] = getNoteHashParts(changeNote);

    const [o0vk0, o0vk1] = split256To128(oldNote0.viewingKey);
    const [o1vk0, o1vk1] = oldNote1 ? split256To128(oldNote1.viewingKey) : ['0', '0'];
    const [nVk0, nVk1] = split256To128(newNote.viewingKey);
    const [cVk0, cVk1] = split256To128(changeNote.viewingKey);

    const inputs = {
        // Public inputs
        o0h0, o0h1,
        o1h0, o1h1,
        nh0, nh1,
        changeH0, changeH1,

        // Old note 0
        o0Owner0: hexToBigInt(oldNote0.owner0).toString(),
        o0Owner1: hexToBigInt(oldNote0.owner1).toString(),
        o0Value: hexToBigInt(oldNote0.value).toString(),
        o0Type: hexToBigInt(oldNote0.token).toString(),
        o0Vk0: o0vk0,
        o0Vk1: o0vk1,
        o0Salt: hexToBigInt(oldNote0.salt).toString(),

        // Old note 1
        o1Owner0: oldNote1 ? hexToBigInt(oldNote1.owner0).toString() : '0',
        o1Owner1: oldNote1 ? hexToBigInt(oldNote1.owner1).toString() : '0',
        o1Value: oldNote1 ? hexToBigInt(oldNote1.value).toString() : '0',
        o1Type: oldNote1 ? hexToBigInt(oldNote1.token).toString() : '0',
        o1Vk0: o1vk0,
        o1Vk1: o1vk1,
        o1Salt: oldNote1 ? hexToBigInt(oldNote1.salt).toString() : '0',

        // New note
        nOwner0: hexToBigInt(newNote.owner0).toString(),
        nOwner1: hexToBigInt(newNote.owner1).toString(),
        nValue: hexToBigInt(newNote.value).toString(),
        nType: hexToBigInt(newNote.token).toString(),
        nVk0: nVk0,
        nVk1: nVk1,
        nSalt: hexToBigInt(newNote.salt).toString(),

        // Change note
        cOwner0: hexToBigInt(changeNote.owner0).toString(),
        cOwner1: hexToBigInt(changeNote.owner1).toString(),
        cValue: hexToBigInt(changeNote.value).toString(),
        cType: hexToBigInt(changeNote.token).toString(),
        cVk0: cVk0,
        cVk1: cVk1,
        cSalt: hexToBigInt(changeNote.salt).toString(),

        // Secret keys
        sk0: hexToBigInt(sk0).toString(),
        sk1: sk1 ? hexToBigInt(sk1).toString() : '0'
    };

    return generateProof('transfer_note', inputs);
}

/**
 * Generate proof for ConvertNote circuit
 */
async function getConvertProof(smartNote, originNote, newNote, sk) {
    const [smartH0, smartH1] = getNoteHashParts(smartNote);
    const [originH0, originH1] = getNoteHashParts(originNote);
    const [nh0, nh1] = getNoteHashParts(newNote);

    const [smartVk0, smartVk1] = split256To128(smartNote.viewingKey);
    const [originVk0, originVk1] = split256To128(originNote.viewingKey);
    const [nVk0, nVk1] = split256To128(newNote.viewingKey);

    const inputs = {
        // Public inputs
        smartH0, smartH1,
        originH0, originH1,
        nh0, nh1,

        // Smart note
        smartOwner0: hexToBigInt(smartNote.owner0).toString(),
        smartOwner1: hexToBigInt(smartNote.owner1).toString(),
        smartValue: hexToBigInt(smartNote.value).toString(),
        smartType: hexToBigInt(smartNote.token).toString(),
        smartVk0, smartVk1,
        smartSalt: hexToBigInt(smartNote.salt).toString(),

        // Origin note
        originOwner0: hexToBigInt(originNote.owner0).toString(),
        originOwner1: hexToBigInt(originNote.owner1).toString(),
        originValue: hexToBigInt(originNote.value).toString(),
        originType: hexToBigInt(originNote.token).toString(),
        originVk0, originVk1,
        originSalt: hexToBigInt(originNote.salt).toString(),

        // New note
        nOwner0: hexToBigInt(newNote.owner0).toString(),
        nOwner1: hexToBigInt(newNote.owner1).toString(),
        nValue: hexToBigInt(newNote.value).toString(),
        nType: hexToBigInt(newNote.token).toString(),
        nVk0, nVk1,
        nSalt: hexToBigInt(newNote.salt).toString(),

        sk: hexToBigInt(sk).toString()
    };

    return generateProof('convert_note', inputs);
}

/**
 * Generate proof for MakeOrder circuit
 */
async function getMakeOrderProof(makerNote, sk) {
    const [nh0, nh1] = getNoteHashParts(makerNote);
    const [vk0, vk1] = split256To128(makerNote.viewingKey);

    const inputs = {
        nh0, nh1,
        tokenType: hexToBigInt(makerNote.token).toString(),
        owner0: hexToBigInt(makerNote.owner0).toString(),
        owner1: hexToBigInt(makerNote.owner1).toString(),
        value: hexToBigInt(makerNote.value).toString(),
        vk0, vk1,
        salt: hexToBigInt(makerNote.salt).toString(),
        sk: hexToBigInt(sk).toString()
    };

    return generateProof('make_order', inputs);
}

/**
 * Generate proof for TakeOrder circuit
 */
async function getTakeOrderProof(parentNote, stakeNote, sk) {
    const [oh0, oh1] = getNoteHashParts(parentNote);
    const [nh0, nh1] = getNoteHashParts(stakeNote);

    const [oVk0, oVk1] = split256To128(parentNote.viewingKey);
    const [nVk0, nVk1] = split256To128(stakeNote.viewingKey);

    const inputs = {
        // Public inputs
        oh0, oh1,
        oType: hexToBigInt(parentNote.token).toString(),
        nh0, nh1,
        nOwner0: hexToBigInt(stakeNote.owner0).toString(),
        nOwner1: hexToBigInt(stakeNote.owner1).toString(),
        nType: hexToBigInt(stakeNote.token).toString(),

        // Parent note private
        oOwner0: hexToBigInt(parentNote.owner0).toString(),
        oOwner1: hexToBigInt(parentNote.owner1).toString(),
        oValue: hexToBigInt(parentNote.value).toString(),
        oVk0, oVk1,
        oSalt: hexToBigInt(parentNote.salt).toString(),

        // Stake note private
        nValue: hexToBigInt(stakeNote.value).toString(),
        nVk0, nVk1,
        nSalt: hexToBigInt(stakeNote.salt).toString(),

        sk: hexToBigInt(sk).toString()
    };

    return generateProof('take_order', inputs);
}

/**
 * Generate proof for SettleOrder circuit
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
    const [o0h0, o0h1] = getNoteHashParts(makerNote);
    const [o1h0, o1h1] = getNoteHashParts(takerStakeNote);
    const [n0h0, n0h1] = getNoteHashParts(rewardNote);
    const [n1h0, n1h1] = getNoteHashParts(paymentNote);
    const [n2h0, n2h1] = getNoteHashParts(changeNote);

    const [o0Vk0, o0Vk1] = split256To128(makerNote.viewingKey);
    const [o1Vk0, o1Vk1] = split256To128(takerStakeNote.viewingKey);
    const [n0Vk0, n0Vk1] = split256To128(rewardNote.viewingKey);
    const [n1Vk0, n1Vk1] = split256To128(paymentNote.viewingKey);
    const [n2Vk0, n2Vk1] = split256To128(changeNote.viewingKey);

    const inputs = {
        // Public inputs
        o0h0, o0h1,
        o0Type: hexToBigInt(makerNote.token).toString(),
        o1h0, o1h1,
        o1Type: hexToBigInt(takerStakeNote.token).toString(),
        n0h0, n0h1,
        n0Owner0: hexToBigInt(rewardNote.owner0).toString(),
        n0Owner1: hexToBigInt(rewardNote.owner1).toString(),
        n0Type: hexToBigInt(rewardNote.token).toString(),
        n1h0, n1h1,
        n1Owner0: hexToBigInt(paymentNote.owner0).toString(),
        n1Owner1: hexToBigInt(paymentNote.owner1).toString(),
        n1Type: hexToBigInt(paymentNote.token).toString(),
        n2h0, n2h1,
        n2Type: hexToBigInt(changeNote.token).toString(),
        price: hexToBigInt(price).toString(),

        // Maker note private
        o0Owner0: hexToBigInt(makerNote.owner0).toString(),
        o0Owner1: hexToBigInt(makerNote.owner1).toString(),
        o0Value: hexToBigInt(makerNote.value).toString(),
        o0Vk0, o0Vk1,
        o0Salt: hexToBigInt(makerNote.salt).toString(),

        // Taker stake note private
        o1Owner0: hexToBigInt(takerStakeNote.owner0).toString(),
        o1Owner1: hexToBigInt(takerStakeNote.owner1).toString(),
        o1Value: hexToBigInt(takerStakeNote.value).toString(),
        o1Vk0, o1Vk1,
        o1Salt: hexToBigInt(takerStakeNote.salt).toString(),

        // Reward note private
        n0Value: hexToBigInt(rewardNote.value).toString(),
        n0Vk0, n0Vk1,
        n0Salt: hexToBigInt(rewardNote.salt).toString(),

        // Payment note private
        n1Value: hexToBigInt(paymentNote.value).toString(),
        n1Vk0, n1Vk1,
        n1Salt: hexToBigInt(paymentNote.salt).toString(),

        // Change note private
        n2Owner0: hexToBigInt(changeNote.owner0).toString(),
        n2Owner1: hexToBigInt(changeNote.owner1).toString(),
        n2Value: hexToBigInt(changeNote.value).toString(),
        n2Vk0, n2Vk1,
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
 * Verify a proof locally (for testing)
 */
async function verifyProofLocal(circuitName, proof, publicSignals) {
    const vkeyPath = path.join(CIRCUITS_DIR, `${circuitName}_vk.json`);
    const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));

    // publicSignals is already in snarkjs format: [output, ...public_inputs]
    // No reordering needed

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
 * Check if circuits are initialized
 */
async function initialized() {
    const testWasm = path.join(CIRCUITS_DIR, 'mint_burn_note_js', 'mint_burn_note.wasm');
    return fs.existsSync(testWasm);
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

    // BabyJubJub (circomlib compatible)
    PrivateKey,
    PublicKey,
    getPublicKey,
    randomSecretKey,
    initBabyJub
};
