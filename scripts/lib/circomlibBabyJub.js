/**
 * circomlibBabyJub.js
 * BabyJubJub wrapper using circomlibjs for compatibility with circom circuits
 *
 * This replaces the babyjubjub npm package which uses a different base point
 * than circomlib circuits.
 */

const { buildBabyjub, buildEddsa } = require('circomlibjs');

// Singleton instances
let babyJub = null;
let eddsa = null;
let F = null;

/**
 * Initialize the BabyJubJub library
 * Must be called before using any other functions
 */
async function init() {
    if (!babyJub) {
        babyJub = await buildBabyjub();
        eddsa = await buildEddsa();
        F = babyJub.F;
    }
    return { babyJub, eddsa, F };
}

/**
 * Get the field element constructor
 */
async function getF() {
    await init();
    return F;
}

/**
 * Get the BabyJubJub instance
 */
async function getBabyJub() {
    await init();
    return babyJub;
}

/**
 * Derive public key from private key (secret key)
 * @param {string|bigint|Buffer} sk - Secret key
 * @returns {Promise<{x: bigint, y: bigint}>} Public key point
 */
async function getPublicKey(sk) {
    await init();

    // Convert sk to appropriate format
    let skBigInt;
    if (typeof sk === 'string') {
        skBigInt = BigInt(sk.startsWith('0x') ? sk : '0x' + sk);
    } else if (typeof sk === 'bigint') {
        skBigInt = sk;
    } else if (Buffer.isBuffer(sk)) {
        skBigInt = BigInt('0x' + sk.toString('hex'));
    } else {
        throw new Error('Invalid secret key format');
    }

    // circomlibjs uses Base8 point for scalar multiplication
    // Base8 = [
    //   5299619240641551281634865583518297030282874472190772894086521144482721001553,
    //   16950150798460657717958625567821834550301663161624707787222815936182638968203
    // ]
    const pubKey = babyJub.mulPointEscalar(babyJub.Base8, skBigInt);

    return {
        x: F.toObject(pubKey[0]),
        y: F.toObject(pubKey[1])
    };
}

/**
 * Verify that a public key corresponds to a secret key
 * @param {object} pubKey - Public key {x, y}
 * @param {string|bigint} sk - Secret key
 * @returns {Promise<boolean>} True if valid
 */
async function verifyPublicKey(pubKey, sk) {
    const derivedPk = await getPublicKey(sk);
    return derivedPk.x === pubKey.x && derivedPk.y === pubKey.y;
}

/**
 * Add two points on the BabyJubJub curve
 * @param {object} p1 - First point {x, y}
 * @param {object} p2 - Second point {x, y}
 * @returns {Promise<{x: bigint, y: bigint}>} Sum point
 */
async function addPoints(p1, p2) {
    await init();

    const point1 = [F.e(p1.x), F.e(p1.y)];
    const point2 = [F.e(p2.x), F.e(p2.y)];
    const result = babyJub.addPoint(point1, point2);

    return {
        x: F.toObject(result[0]),
        y: F.toObject(result[1])
    };
}

/**
 * Multiply a point by a scalar
 * @param {object} point - Point {x, y}
 * @param {string|bigint} scalar - Scalar value
 * @returns {Promise<{x: bigint, y: bigint}>} Result point
 */
async function mulPointScalar(point, scalar) {
    await init();

    let scalarBigInt;
    if (typeof scalar === 'string') {
        scalarBigInt = BigInt(scalar.startsWith('0x') ? scalar : '0x' + scalar);
    } else {
        scalarBigInt = scalar;
    }

    const p = [F.e(point.x), F.e(point.y)];
    const result = babyJub.mulPointEscalar(p, scalarBigInt);

    return {
        x: F.toObject(result[0]),
        y: F.toObject(result[1])
    };
}

/**
 * Check if a point is on the BabyJubJub curve
 * @param {object} point - Point {x, y}
 * @returns {Promise<boolean>} True if on curve
 */
async function isOnCurve(point) {
    await init();
    const p = [F.e(point.x), F.e(point.y)];
    return babyJub.inCurve(p);
}

/**
 * Get the Base8 generator point (same as circomlib)
 * @returns {Promise<{x: bigint, y: bigint}>} Base8 point
 */
async function getBase8() {
    await init();
    return {
        x: F.toObject(babyJub.Base8[0]),
        y: F.toObject(babyJub.Base8[1])
    };
}

/**
 * Get the subgroup order
 * @returns {Promise<bigint>} Subgroup order
 */
async function getSubOrder() {
    await init();
    return babyJub.subOrder;
}

/**
 * Pack a point into a buffer (for hashing)
 * @param {object} point - Point {x, y}
 * @returns {Promise<Buffer>} Packed point
 */
async function packPoint(point) {
    await init();
    const p = [F.e(point.x), F.e(point.y)];
    return babyJub.packPoint(p);
}

/**
 * Unpack a buffer into a point
 * @param {Buffer} packed - Packed point
 * @returns {Promise<{x: bigint, y: bigint}>} Point
 */
async function unpackPoint(packed) {
    await init();
    const result = babyJub.unpackPoint(packed);
    return {
        x: F.toObject(result[0]),
        y: F.toObject(result[1])
    };
}

/**
 * Generate a random secret key
 * @returns {Promise<bigint>} Random secret key
 */
async function randomSecretKey() {
    await init();
    const crypto = require('crypto');
    const randomBytes = crypto.randomBytes(32);
    const sk = BigInt('0x' + randomBytes.toString('hex')) % babyJub.subOrder;
    return sk;
}

/**
 * Convert a public key to address format (first 160 bits of hash)
 * This is a helper for deriving note addresses
 * @param {object} pubKey - Public key {x, y}
 * @returns {Promise<string>} Address as hex string
 */
async function pubKeyToAddress(pubKey) {
    const crypto = require('crypto');

    // Pack the public key
    const xHex = pubKey.x.toString(16).padStart(64, '0');
    const yHex = pubKey.y.toString(16).padStart(64, '0');

    // SHA256 hash of concatenated coordinates
    const hash = crypto.createHash('sha256')
        .update(Buffer.from(xHex + yHex, 'hex'))
        .digest('hex');

    // Return first 40 characters (160 bits)
    return '0x' + hash.slice(0, 40);
}

// Export class-like interface for compatibility with existing code
class PrivateKey {
    constructor(sk) {
        if (typeof sk === 'string') {
            this.sk = BigInt(sk.startsWith('0x') ? sk : '0x' + sk);
        } else if (typeof sk === 'bigint') {
            this.sk = sk;
        } else {
            throw new Error('Invalid secret key format');
        }
    }

    static async random() {
        const sk = await randomSecretKey();
        return new PrivateKey(sk);
    }

    toString() {
        return '0x' + this.sk.toString(16).padStart(64, '0');
    }
}

class PublicKey {
    constructor(x, y) {
        this.x = typeof x === 'bigint' ? x : BigInt(x);
        this.y = typeof y === 'bigint' ? y : BigInt(y);
    }

    static async fromPrivate(privateKey) {
        const sk = privateKey instanceof PrivateKey ? privateKey.sk : privateKey;
        const pk = await getPublicKey(sk);
        return new PublicKey(pk.x, pk.y);
    }

    async verify(privateKey) {
        const sk = privateKey instanceof PrivateKey ? privateKey.sk : privateKey;
        return await verifyPublicKey({ x: this.x, y: this.y }, sk);
    }

    toArray() {
        return [
            '0x' + this.x.toString(16).padStart(64, '0'),
            '0x' + this.y.toString(16).padStart(64, '0')
        ];
    }
}

module.exports = {
    // Initialization
    init,
    getF,
    getBabyJub,

    // Core functions
    getPublicKey,
    verifyPublicKey,
    addPoints,
    mulPointScalar,
    isOnCurve,
    getBase8,
    getSubOrder,
    packPoint,
    unpackPoint,
    randomSecretKey,
    pubKeyToAddress,

    // Class interface
    PrivateKey,
    PublicKey
};
