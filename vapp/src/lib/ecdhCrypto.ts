/**
 * ECDH encryption/decryption for BabyJubJub notes
 *
 * Uses ECDH key agreement on BabyJubJub + AES-256-GCM for symmetric encryption.
 * Browser environment: Web Crypto API for AES-GCM and SHA-256.
 *
 * On-chain format:
 *   0x01 || epk_x(32B) || epk_y(32B) || nonce(12B) || ciphertext || authTag(16B)
 */

import { getBabyJub, BN128_FIELD_PRIME, bytesToHex, hexToBytes } from './accountCrypto'

/** Version byte for ECDH encrypted data */
const ECDH_VERSION = 0x01

/** Minimum length of ECDH encrypted data: 1(ver) + 32(epk_x) + 32(epk_y) + 12(nonce) + 1(min ct) + 16(tag) = 94 bytes */
const ECDH_MIN_BYTES = 94

/**
 * Convert a bigint to a 32-byte big-endian Uint8Array.
 * The value is zero-padded on the left to fill exactly 32 bytes.
 *
 * @param value - The bigint value to convert (must fit in 256 bits)
 * @returns A 32-byte Uint8Array in big-endian byte order
 */
function bigIntToBytes32(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(64, '0')
  return hexToBytes(hex)
}

/**
 * Generate an ephemeral keypair on BabyJubJub for ECDH key exchange.
 * The ephemeral secret key (esk) is a random scalar reduced mod BN128_FIELD_PRIME,
 * and the ephemeral public key (epk) is computed as esk * Base8.
 *
 * @returns An object containing the ephemeral secret key (esk) and public key (epk) with x, y coordinates as bigints
 */
async function generateEphemeralKeypair(): Promise<{ esk: bigint; epk: { x: bigint; y: bigint } }> {
  const babyJub = await getBabyJub()

  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  const esk = BigInt('0x' + bytesToHex(randomBytes)) % BN128_FIELD_PRIME

  const epkPoint = babyJub.mulPointEscalar(babyJub.Base8, esk)

  return {
    esk,
    epk: {
      x: babyJub.F.toObject(epkPoint[0]),
      y: babyJub.F.toObject(epkPoint[1])
    }
  }
}

/**
 * Compute the ECDH shared secret by performing scalar multiplication on BabyJubJub.
 * The result is scalar * point, yielding a new curve point.
 *
 * @param scalar - The scalar multiplier (e.g., a secret key or ephemeral secret key)
 * @param point - The BabyJubJub curve point to multiply, with x and y as bigints
 * @returns The resulting curve point with x and y coordinates as bigints
 */
async function computeSharedSecret(
  scalar: bigint,
  point: { x: bigint; y: bigint }
): Promise<{ x: bigint; y: bigint }> {
  const babyJub = await getBabyJub()

  const p: [unknown, unknown] = [babyJub.F.e(point.x), babyJub.F.e(point.y)]
  const result = babyJub.mulPointEscalar(p, scalar)

  return {
    x: babyJub.F.toObject(result[0]),
    y: babyJub.F.toObject(result[1])
  }
}

/**
 * Derive an AES-256-GCM CryptoKey from an ECDH shared secret point.
 * The key material is computed as SHA-256(shared_x_32bytes || shared_y_32bytes),
 * then imported as a non-extractable AES-GCM key via the Web Crypto API.
 *
 * @param sharedPoint - The ECDH shared secret curve point with x and y as bigints
 * @param usage - The permitted key usages (e.g., ['encrypt'] or ['decrypt'])
 * @returns A CryptoKey suitable for AES-256-GCM operations
 */
async function deriveAESKey(
  sharedPoint: { x: bigint; y: bigint },
  usage: KeyUsage[]
): Promise<CryptoKey> {
  const xBytes = bigIntToBytes32(sharedPoint.x)
  const yBytes = bigIntToBytes32(sharedPoint.y)
  const concat = new Uint8Array(64)
  concat.set(xBytes, 0)
  concat.set(yBytes, 32)

  const keyMaterial = await crypto.subtle.digest('SHA-256', concat)

  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM' },
    false,
    usage
  )
}

/**
 * Encrypt data for a recipient using ECDH + AES-256-GCM
 *
 * @param plaintext - Data to encrypt
 * @param recipientPk - Recipient's BabyJubJub public key {x, y} as hex strings
 * @returns Encrypted data as hex string: 0x01 || epk_x || epk_y || nonce || ciphertext || authTag
 */
export async function encryptForRecipient(
  plaintext: Uint8Array,
  recipientPk: { x: string; y: string }
): Promise<string> {
  // 1. Generate ephemeral keypair
  const { esk, epk } = await generateEphemeralKeypair()

  // 2. ECDH shared secret
  const recipientPoint = {
    x: BigInt(recipientPk.x),
    y: BigInt(recipientPk.y)
  }
  const shared = await computeSharedSecret(esk, recipientPoint)

  // 3. Derive AES key
  const aesKey = await deriveAESKey(shared, ['encrypt'])

  // 4. Generate random nonce (12 bytes for AES-GCM)
  const nonce = new Uint8Array(12)
  crypto.getRandomValues(nonce)

  // 5. AES-256-GCM encrypt
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    new Uint8Array(plaintext).buffer as ArrayBuffer
  )

  // AES-GCM appends 16-byte auth tag to ciphertext
  const encryptedArray = new Uint8Array(encryptedData)

  // 6. Serialize: version(1) || epk_x(32) || epk_y(32) || nonce(12) || ciphertext+authTag
  const epkXBytes = bigIntToBytes32(epk.x)
  const epkYBytes = bigIntToBytes32(epk.y)

  const output = new Uint8Array(1 + 32 + 32 + 12 + encryptedArray.length)
  output[0] = ECDH_VERSION
  output.set(epkXBytes, 1)
  output.set(epkYBytes, 33)
  output.set(nonce, 65)
  output.set(encryptedArray, 77)

  return '0x' + bytesToHex(output)
}

/**
 * Decrypt ECDH-encrypted data using the recipient's secret key
 *
 * @param encryptedHex - Encrypted data as hex string (with 0x prefix)
 * @param sk - Recipient's secret key as hex string
 * @returns Decrypted plaintext bytes, or null if decryption fails (wrong key)
 */
export async function decryptWithSecretKey(
  encryptedHex: string,
  sk: string
): Promise<Uint8Array | null> {
  try {
    const data = hexToBytes(encryptedHex.startsWith('0x') ? encryptedHex.slice(2) : encryptedHex)

    if (data.length < ECDH_MIN_BYTES) return null
    if (data[0] !== ECDH_VERSION) return null

    // Parse: version(1) || epk_x(32) || epk_y(32) || nonce(12) || ciphertext+authTag
    const epkX = BigInt('0x' + bytesToHex(data.slice(1, 33)))
    const epkY = BigInt('0x' + bytesToHex(data.slice(33, 65)))
    const nonce = data.slice(65, 77)
    const ciphertextAndTag = data.slice(77)

    // ECDH shared secret: sk * epk
    let skBigInt = BigInt(sk)
    if (skBigInt >= BN128_FIELD_PRIME) {
      skBigInt = skBigInt % BN128_FIELD_PRIME
    }
    const shared = await computeSharedSecret(skBigInt, { x: epkX, y: epkY })

    // Derive AES key
    const aesKey = await deriveAESKey(shared, ['decrypt'])

    // AES-256-GCM decrypt
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce },
      aesKey,
      ciphertextAndTag
    )

    return new Uint8Array(decryptedData)
  } catch {
    // Decryption failure = wrong key or corrupted data
    return null
  }
}

/**
 * Check if a hex-encoded bytes blob is ECDH-encrypted (starts with version byte 0x01)
 */
export function isECDHEncrypted(hex: string): boolean {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  if (clean.length < ECDH_MIN_BYTES * 2) return false
  return clean.slice(0, 2) === '01'
}
