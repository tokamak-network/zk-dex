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
 * Compute note hash matching circuit computation (1184-bit SHA256)
 * Hash format: SHA256(ownerAddress(160) || value(256) || type(256) || vk0(128) || vk1(128) || salt(256))
 * @param {Object} note - Note object with ownerAddress, value, token, viewingKey, salt
 * @returns {{h0: string, h1: string}} Hash split into two 128-bit parts
 */
function computeCircuitHash(note) {
    const crypto = require('crypto');

    // Helper to convert a 160-bit address to 20 bytes (big-endian)
    function addressTo20Bytes(val) {
        const bigVal = hexToBigInt(val) & ((BigInt(1) << BigInt(160)) - BigInt(1));
        const hex = bigVal.toString(16).padStart(40, '0');
        return Buffer.from(hex, 'hex');
    }

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

    // Build 148-byte (1184-bit) message matching circuit structure:
    // ownerAddress (20B) | value (32B) | type (32B) | vk0 (16B) | vk1 (16B) | salt (32B)
    const [vk0, vk1] = split256To128(note.viewingKey);

    const message = Buffer.concat([
        addressTo20Bytes(note.ownerAddress),  // 20 bytes (160 bits)
        fieldTo32Bytes(note.value),           // 32 bytes
        fieldTo32Bytes(note.token),           // 32 bytes
        to16Bytes(vk0),                       // 16 bytes (vk high part)
        to16Bytes(vk1),                       // 16 bytes (vk low part)
        fieldTo32Bytes(note.salt)             // 32 bytes
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
        ownerAddress: hexToBigInt(note.ownerAddress).toString(),
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
        o0OwnerAddress: hexToBigInt(oldNote0.ownerAddress).toString(),
        o0Value: hexToBigInt(oldNote0.value).toString(),
        o0Type: hexToBigInt(oldNote0.token).toString(),
        o0Vk0: o0vk0,
        o0Vk1: o0vk1,
        o0Salt: hexToBigInt(oldNote0.salt).toString(),

        // Old note 1
        o1OwnerAddress: oldNote1 ? hexToBigInt(oldNote1.ownerAddress).toString() : '0',
        o1Value: oldNote1 ? hexToBigInt(oldNote1.value).toString() : '0',
        o1Type: oldNote1 ? hexToBigInt(oldNote1.token).toString() : '0',
        o1Vk0: o1vk0,
        o1Vk1: o1vk1,
        o1Salt: oldNote1 ? hexToBigInt(oldNote1.salt).toString() : '0',

        // New note
        nOwnerAddress: hexToBigInt(newNote.ownerAddress).toString(),
        nValue: hexToBigInt(newNote.value).toString(),
        nType: hexToBigInt(newNote.token).toString(),
        nVk0: nVk0,
        nVk1: nVk1,
        nSalt: hexToBigInt(newNote.salt).toString(),

        // Change note
        cOwnerAddress: hexToBigInt(changeNote.ownerAddress).toString(),
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

        // Smart note (ownerAddress is truncated hash of origin note)
        smartOwnerAddress: hexToBigInt(smartNote.ownerAddress).toString(),
        smartValue: hexToBigInt(smartNote.value).toString(),
        smartType: hexToBigInt(smartNote.token).toString(),
        smartVk0, smartVk1,
        smartSalt: hexToBigInt(smartNote.salt).toString(),

        // Origin note
        originOwnerAddress: hexToBigInt(originNote.ownerAddress).toString(),
        originValue: hexToBigInt(originNote.value).toString(),
        originType: hexToBigInt(originNote.token).toString(),
        originVk0, originVk1,
        originSalt: hexToBigInt(originNote.salt).toString(),

        // New note
        nOwnerAddress: hexToBigInt(newNote.ownerAddress).toString(),
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
        ownerAddress: hexToBigInt(makerNote.ownerAddress).toString(),
        value: hexToBigInt(makerNote.value).toString(),
        vk0, vk1,
        salt: hexToBigInt(makerNote.salt).toString(),
        sk: hexToBigInt(sk).toString()
    };

    return generateProof('make_order', inputs);
}

/**
 * Generate proof for TakeOrder circuit
 * @param {Object} parentNote - Taker's parent note (normal note)
 * @param {Object} stakeNote - Smart note with owner = truncated hash of maker's note
 * @param {string} sk - Secret key of the taker
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
        nOwnerAddress: hexToBigInt(stakeNote.ownerAddress).toString(),  // 160-bit truncated maker hash
        nType: hexToBigInt(stakeNote.token).toString(),

        // Parent note private
        oOwnerAddress: hexToBigInt(parentNote.ownerAddress).toString(),
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
        n0OwnerAddress: hexToBigInt(rewardNote.ownerAddress).toString(),
        n0Type: hexToBigInt(rewardNote.token).toString(),
        n1h0, n1h1,
        n1OwnerAddress: hexToBigInt(paymentNote.ownerAddress).toString(),
        n1Type: hexToBigInt(paymentNote.token).toString(),
        n2h0, n2h1,
        n2Type: hexToBigInt(changeNote.token).toString(),
        price: hexToBigInt(price).toString(),

        // Maker note private
        o0OwnerAddress: hexToBigInt(makerNote.ownerAddress).toString(),
        o0Value: hexToBigInt(makerNote.value).toString(),
        o0Vk0, o0Vk1,
        o0Salt: hexToBigInt(makerNote.salt).toString(),

        // Taker stake note private (ownerAddress is truncated hash of maker note)
        o1OwnerAddress: hexToBigInt(takerStakeNote.ownerAddress).toString(),
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
        n2OwnerAddress: hexToBigInt(changeNote.ownerAddress).toString(),
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

/**
 * Derive 160-bit address from BabyJubJub public key
 * address = SHA256(pk.x || pk.y)[96:256] (last 160 bits)
 * @param {Object} publicKey - Public key with x, y coordinates
 * @returns {string} 160-bit address as hex string (40 chars, no 0x prefix)
 */
function getAddressFromPublicKey(publicKey) {
    const crypto = require('crypto');

    // Convert coordinates to 32 bytes each (256 bits, padded from 254-bit field elements)
    const pkX = hexToBigInt(publicKey.x);
    const pkY = hexToBigInt(publicKey.y);

    const xHex = pkX.toString(16).padStart(64, '0');
    const yHex = pkY.toString(16).padStart(64, '0');

    // Concatenate: pk.x (32B) || pk.y (32B) = 64 bytes
    const message = Buffer.concat([
        Buffer.from(xHex, 'hex'),
        Buffer.from(yHex, 'hex')
    ]);

    // SHA256 hash
    const digest = crypto.createHash('sha256').update(message).digest('hex');

    // Take last 160 bits (40 hex chars) = bits[96:256]
    return digest.slice(-40);
}

/**
 * Get smart note owner address from parent note hash
 * Takes the last 160 bits of the 256-bit hash
 * @param {string} noteHash - 256-bit note hash (64 hex chars)
 * @returns {string} 160-bit address (40 hex chars)
 */
function getSmartNoteOwnerAddress(noteHash) {
    const cleanHash = noteHash.startsWith('0x') ? noteHash.slice(2) : noteHash;
    const padded = cleanHash.padStart(64, '0');
    return padded.slice(-40);
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

    // Address utilities
    getAddressFromPublicKey,
    getSmartNoteOwnerAddress,

    // BabyJubJub (circomlib compatible)
    PrivateKey,
    PublicKey,
    getPublicKey,
    randomSecretKey,
    initBabyJub
};
