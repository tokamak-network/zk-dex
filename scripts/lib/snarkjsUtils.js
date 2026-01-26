/**
 * snarkjsUtils.js
 * Replacement for dockerUtils.js - uses snarkjs for proof generation
 * Uses circomlibjs for BabyJubJub and Poseidon operations (compatible with circom circuits)
 *
 * Poseidon Migration:
 * - Note hash: Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt) -> single field element
 * - Address: Poseidon(pk.x, pk.y) truncated to 160 bits
 * - ViewingKey: Poseidon(pk.x, pk.y) (full 254-bit hash, can derive address from it)
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
 * Convert hex string to BigInt
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
 * Mask value to 254 bits (BN128 field constraint)
 */
function maskTo254Bits(value) {
    const mask = (BigInt(1) << BigInt(254)) - BigInt(1);
    return hexToBigInt(value) & mask;
}

/**
 * Compute note hash using Poseidon
 * hash = Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)
 * @param {Object} note - Note object with ownerAddress, value, token, viewingKey, salt
 * @returns {Promise<string>} Hash as decimal string
 */
async function computeCircuitHash(note) {
    const [vk0, vk1] = split256To128(note.viewingKey);

    const hash = await poseidonHash([
        hexToBigInt(note.ownerAddress),
        hexToBigInt(note.value),
        hexToBigInt(note.token),
        BigInt(vk0),
        BigInt(vk1),
        hexToBigInt(note.salt)
    ]);

    return hash.toString();
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
 * EMPTY_NOTE_HASH (Poseidon version)
 * EMPTY_NOTE_HASH = Poseidon(0, 0, 0, 0, 0, 0)
 * This will be computed on first use
 */
let EMPTY_NOTE_HASH = null;

async function getEmptyNoteHash() {
    if (EMPTY_NOTE_HASH === null) {
        EMPTY_NOTE_HASH = await poseidonHash([0, 0, 0, 0, 0, 0]);
    }
    return EMPTY_NOTE_HASH.toString();
}

/**
 * Get note hash from note object using Poseidon
 * For null/undefined notes, returns the EMPTY_NOTE_HASH
 * Always computes Poseidon hash, ignoring any note.hash() method (which may use SHA256)
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
 * Generate proof for MintNBurnNote circuit (Poseidon version)
 * Public inputs: [noteHash, value, tokenType]
 */
async function getMintNBurnProof(note, sk) {
    const noteHash = await computeCircuitHash(note);
    const [vk0, vk1] = split256To128(note.viewingKey);

    const inputs = {
        noteHash,
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
 * Generate proof for TransferNote circuit (Poseidon version)
 * Public inputs: [o0Hash, o1Hash, newHash, changeHash]
 */
async function getTransferProof(oldNote0, oldNote1, newNote, changeNote, sk0, sk1) {
    const o0Hash = await getNoteHash(oldNote0);
    const o1Hash = await getNoteHash(oldNote1);
    const newHash = await getNoteHash(newNote);
    const changeHash = await getNoteHash(changeNote);

    const [o0vk0, o0vk1] = split256To128(oldNote0.viewingKey);
    const [o1vk0, o1vk1] = oldNote1 ? split256To128(oldNote1.viewingKey) : ['0', '0'];
    const [nVk0, nVk1] = split256To128(newNote.viewingKey);
    const [cVk0, cVk1] = split256To128(changeNote.viewingKey);

    const inputs = {
        // Public inputs
        o0Hash,
        o1Hash,
        newHash,
        changeHash,

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
 * Generate proof for ConvertNote circuit (Poseidon version)
 * Public inputs: [smartHash, originHash, newHash]
 */
async function getConvertProof(smartNote, originNote, newNote, sk) {
    const smartHash = await getNoteHash(smartNote);
    const originHash = await getNoteHash(originNote);
    const newHash = await getNoteHash(newNote);

    const [smartVk0, smartVk1] = split256To128(smartNote.viewingKey);
    const [originVk0, originVk1] = split256To128(originNote.viewingKey);
    const [nVk0, nVk1] = split256To128(newNote.viewingKey);

    const inputs = {
        // Public inputs
        smartHash,
        originHash,
        newHash,

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
 * Generate proof for MakeOrder circuit (Poseidon version)
 * Public inputs: [noteHash, tokenType]
 */
async function getMakeOrderProof(makerNote, sk) {
    const noteHash = await getNoteHash(makerNote);
    const [vk0, vk1] = split256To128(makerNote.viewingKey);

    const inputs = {
        noteHash,
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
 * Generate proof for TakeOrder circuit (Poseidon version)
 * Public inputs: [oldNoteHash, oldType, newNoteHash, newOwnerAddress, newType]
 * @param {Object} parentNote - Taker's parent note (normal note)
 * @param {Object} stakeNote - Smart note with owner = truncated hash of maker's note
 * @param {string} sk - Secret key of the taker
 */
async function getTakeOrderProof(parentNote, stakeNote, sk) {
    const oldNoteHash = await getNoteHash(parentNote);
    const newNoteHash = await getNoteHash(stakeNote);

    const [oVk0, oVk1] = split256To128(parentNote.viewingKey);
    const [nVk0, nVk1] = split256To128(stakeNote.viewingKey);

    const inputs = {
        // Public inputs
        oldNoteHash,
        oldType: hexToBigInt(parentNote.token).toString(),
        newNoteHash,
        newOwnerAddress: hexToBigInt(stakeNote.ownerAddress).toString(),  // 160-bit truncated maker hash
        newType: hexToBigInt(stakeNote.token).toString(),

        // Parent note private
        oldOwnerAddress: hexToBigInt(parentNote.ownerAddress).toString(),
        oldValue: hexToBigInt(parentNote.value).toString(),
        oldVk0: oVk0, oldVk1: oVk1,
        oldSalt: hexToBigInt(parentNote.salt).toString(),

        // Stake note private
        newValue: hexToBigInt(stakeNote.value).toString(),
        newVk0: nVk0, newVk1: nVk1,
        newSalt: hexToBigInt(stakeNote.salt).toString(),

        sk: hexToBigInt(sk).toString()
    };

    return generateProof('take_order', inputs);
}

/**
 * Generate proof for SettleOrder circuit (Poseidon version)
 * Public inputs: [o0Hash, o0Type, o1Hash, o1Type,
 *                 n0Hash, n0OwnerAddress, n0Type,
 *                 n1Hash, n1OwnerAddress, n1Type,
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

    const [o0Vk0, o0Vk1] = split256To128(makerNote.viewingKey);
    const [o1Vk0, o1Vk1] = split256To128(takerStakeNote.viewingKey);
    const [n0Vk0, n0Vk1] = split256To128(rewardNote.viewingKey);
    const [n1Vk0, n1Vk1] = split256To128(paymentNote.viewingKey);
    const [n2Vk0, n2Vk1] = split256To128(changeNote.viewingKey);

    const inputs = {
        // Public inputs
        o0Hash,
        o0Type: hexToBigInt(makerNote.token).toString(),
        o1Hash,
        o1Type: hexToBigInt(takerStakeNote.token).toString(),
        n0Hash,
        n0OwnerAddress: hexToBigInt(rewardNote.ownerAddress).toString(),
        n0Type: hexToBigInt(rewardNote.token).toString(),
        n1Hash,
        n1OwnerAddress: hexToBigInt(paymentNote.ownerAddress).toString(),
        n1Type: hexToBigInt(paymentNote.token).toString(),
        n2Hash,
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
 * Check if circuits are initialized
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

/**
 * Derive viewing key from BabyJubJub public key using Poseidon
 * viewingKey = Poseidon(pk.x, pk.y) = 254 bits (single field element)
 *
 * Relationship with ownerAddress:
 * - ownerAddress = viewingKey truncated to 160 bits
 *
 * @param {Object} publicKey - Public key with x, y coordinates
 * @returns {Promise<{vk: string, vk0: string, vk1: string}>} Viewing key (full and split)
 */
async function getViewingKeyFromPublicKey(publicKey) {
    // Poseidon hash of public key coordinates
    const hash = await poseidonHash([
        hexToBigInt(publicKey.x),
        hexToBigInt(publicKey.y)
    ]);

    // Full viewing key (254 bits)
    const vk = '0x' + hash.toString(16).padStart(64, '0');

    // Split into vk0 (high 128 bits) and vk1 (low 128 bits)
    const [vk0, vk1] = split256To128(hash);

    return { vk, vk0: '0x' + BigInt(vk0).toString(16).padStart(32, '0'), vk1: '0x' + BigInt(vk1).toString(16).padStart(32, '0') };
}

/**
 * Get smart note owner address from parent note hash
 * Simply truncate the Poseidon hash to 160 bits
 * @param {string} noteHash - Note hash (field element as decimal or hex string)
 * @returns {string} 160-bit address as hex string
 */
function getSmartNoteOwnerAddress(noteHash) {
    const hash = hexToBigInt(noteHash);
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

    // Address and viewing key utilities
    getAddressFromPublicKey,
    getViewingKeyFromPublicKey,
    getSmartNoteOwnerAddress,
    truncateTo160Bits,

    // BabyJubJub (circomlib compatible)
    PrivateKey,
    PublicKey,
    getPublicKey,
    randomSecretKey,
    initBabyJub
};
