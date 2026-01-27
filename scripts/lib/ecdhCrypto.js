/**
 * ecdhCrypto.js
 * ECDH encryption/decryption for BabyJubJub notes (Node.js environment)
 *
 * Uses ECDH key agreement on BabyJubJub + AES-256-GCM for symmetric encryption.
 * Compatible with the browser version (vapp/src/lib/ecdhCrypto.ts).
 *
 * On-chain format:
 *   0x01 || epk_x(32B) || epk_y(32B) || nonce(12B) || ciphertext || authTag(16B)
 */

const crypto = require('crypto');
const circomlibBabyJub = require('./circomlibBabyJub');

/** Version byte for ECDH encrypted data */
const ECDH_VERSION = 0x01;

/** Minimum length of ECDH encrypted data: 1(ver) + 32(epk_x) + 32(epk_y) + 12(nonce) + 1(min ct) + 16(tag) = 94 bytes */
const ECDH_MIN_BYTES = 94;

/**
 * Convert a bigint to a 32-byte big-endian Buffer.
 * @param {bigint} value - The bigint value to convert
 * @returns {Buffer} A 32-byte Buffer containing the big-endian representation of the value
 */
function bigIntToBuffer32(value) {
    const hex = value.toString(16).padStart(64, '0');
    return Buffer.from(hex, 'hex');
}

/**
 * Derive AES-256 key from ECDH shared secret using SHA-256.
 * key = SHA-256(shared_x_32bytes || shared_y_32bytes)
 * @param {{x: bigint, y: bigint}} sharedPoint - The ECDH shared secret point on the BabyJubJub curve
 * @returns {Buffer} A 32-byte AES-256 key derived from the SHA-256 hash of the concatenated coordinates
 */
function deriveAESKey(sharedPoint) {
    const xBuf = bigIntToBuffer32(sharedPoint.x);
    const yBuf = bigIntToBuffer32(sharedPoint.y);
    return crypto.createHash('sha256')
        .update(Buffer.concat([xBuf, yBuf]))
        .digest();
}

/**
 * Encrypt data for a recipient using ECDH + AES-256-GCM
 *
 * @param {Buffer|Uint8Array} plaintext - Data to encrypt
 * @param {{x: bigint, y: bigint}} recipientPk - Recipient's BabyJubJub public key
 * @returns {Promise<string>} Encrypted data as hex string: 0x01 || epk_x || epk_y || nonce || ciphertext || authTag
 */
async function encryptForRecipient(plaintext, recipientPk) {
    // 1. Generate ephemeral keypair
    const esk = await circomlibBabyJub.randomSecretKey();
    const epk = await circomlibBabyJub.getPublicKey(esk);

    // 2. ECDH shared secret: esk * recipientPk
    const shared = await circomlibBabyJub.mulPointScalar(recipientPk, esk);

    // 3. Derive AES key from shared secret via SHA-256
    const keyMaterial = deriveAESKey(shared);

    // 4. Generate random nonce (12 bytes for AES-GCM)
    const nonce = crypto.randomBytes(12);

    // 5. AES-256-GCM encrypt
    const cipher = crypto.createCipheriv('aes-256-gcm', keyMaterial, nonce);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag(); // 16 bytes

    // 6. Serialize: version(1) || epk_x(32) || epk_y(32) || nonce(12) || ciphertext || authTag(16)
    const epkXBuf = bigIntToBuffer32(epk.x);
    const epkYBuf = bigIntToBuffer32(epk.y);

    const output = Buffer.concat([
        Buffer.from([ECDH_VERSION]),
        epkXBuf,
        epkYBuf,
        nonce,
        ciphertext,
        authTag
    ]);

    return '0x' + output.toString('hex');
}

/**
 * Decrypt ECDH-encrypted data using the recipient's secret key
 *
 * @param {string} encryptedHex - Encrypted data as hex string (with 0x prefix)
 * @param {string|bigint} sk - Recipient's secret key
 * @returns {Promise<Buffer|null>} Decrypted plaintext bytes, or null if decryption fails
 */
async function decryptWithSecretKey(encryptedHex, sk) {
    try {
        const buf = Buffer.from(encryptedHex.replace('0x', ''), 'hex');

        if (buf.length < ECDH_MIN_BYTES) return null;
        if (buf[0] !== ECDH_VERSION) return null;

        // Parse: version(1) || epk_x(32) || epk_y(32) || nonce(12) || ciphertext || authTag(16)
        const epkX = BigInt('0x' + buf.slice(1, 33).toString('hex'));
        const epkY = BigInt('0x' + buf.slice(33, 65).toString('hex'));
        const nonce = buf.slice(65, 77);
        const ciphertextAndTag = buf.slice(77);
        const ciphertext = ciphertextAndTag.slice(0, -16);
        const authTag = ciphertextAndTag.slice(-16);

        // ECDH shared secret: sk * epk
        let skBigInt;
        if (typeof sk === 'string') {
            skBigInt = BigInt(sk.startsWith('0x') ? sk : '0x' + sk);
        } else {
            skBigInt = sk;
        }
        const shared = await circomlibBabyJub.mulPointScalar({ x: epkX, y: epkY }, skBigInt);

        // Derive AES key from shared secret
        const keyMaterial = deriveAESKey(shared);

        // AES-256-GCM decrypt
        const decipher = crypto.createDecipheriv('aes-256-gcm', keyMaterial, nonce);
        decipher.setAuthTag(authTag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

        return plaintext;
    } catch (e) {
        // Decryption failure = wrong key or corrupted data
        return null;
    }
}

/**
 * Check if a hex-encoded bytes blob is ECDH-encrypted (starts with version byte 0x01).
 * @param {string} hex - The hex-encoded string to check (with or without 0x prefix)
 * @returns {boolean} True if the data has the ECDH version prefix and meets the minimum length requirement
 */
function isECDHEncrypted(hex) {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (clean.length < ECDH_MIN_BYTES * 2) return false;
    return clean.slice(0, 2) === '01';
}

module.exports = {
    encryptForRecipient,
    decryptWithSecretKey,
    isECDHEncrypted,
    ECDH_VERSION,
    ECDH_MIN_BYTES
};
