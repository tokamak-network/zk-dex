/**
 * Browser-side account cryptography module
 * Uses Web Crypto API for AES-256-GCM and scrypt-js for key derivation
 * BabyJubJub operations via circomlibjs (browser-compatible)
 */

import { scrypt } from 'scrypt-js'
import { buildBabyjub, type BabyJub } from 'circomlibjs'
import { poseidonHash, truncateTo160Bits } from './poseidon'

// BabyJubJub instance (initialized lazily)
let babyJub: BabyJub | null = null

// BN128 field prime - circuits represent all signals as field elements mod p.
// If sk >= p, the circuit uses (sk mod p) for Num2Bits decomposition,
// so the browser must also reduce sk mod p before scalar multiplication.
export const BN128_FIELD_PRIME = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617')

/**
 * Normalize a bigint to a valid BN128 field element.
 * Applies modulo reduction consistently across all cryptographic operations.
 *
 * Security: Ensures consistent field reduction behavior (Issue 3.3)
 *
 * @param value - The value to normalize
 * @returns The value reduced modulo BN128_FIELD_PRIME
 */
export function normalizeFieldElement(value: bigint): bigint {
  return value % BN128_FIELD_PRIME
}

/**
 * Generate cryptographically secure random bytes with entropy verification.
 *
 * Security: Detects CSPRNG failures that could compromise key generation (Issue 3.5)
 *
 * @param length - Number of random bytes to generate
 * @returns A Uint8Array containing cryptographically secure random bytes
 * @throws Error if secure random number generator is unavailable or produces all zeros
 */
export function getSecureRandomBytes(length: number): Uint8Array {
  if (!crypto || !crypto.getRandomValues) {
    throw new Error('Secure random number generator not available')
  }

  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  // Simple entropy check: all zeros indicates CSPRNG failure
  const sum = bytes.reduce((acc, val) => acc + val, 0)
  if (sum === 0) {
    throw new Error('Random number generator produced all zeros - possible CSPRNG failure')
  }

  return bytes
}

/**
 * Attempt to wipe sensitive data from memory.
 *
 * Security: Best-effort memory wiping for secret keys (Issue 3.4)
 * Note: JavaScript doesn't guarantee memory wiping, but this provides defense-in-depth.
 *
 * @param key - The Uint8Array to wipe
 */
export function wipeKey(key: Uint8Array): void {
  // Overwrite with random data first
  crypto.getRandomValues(key)
  // Then clear with zeros
  key.fill(0)
}

export interface Keystore {
  crypto: {
    cipher: string
    ciphertext: string
    cipherparams: {
      iv: string
    }
    kdf: string
    kdfparams: {
      n: number
      r: number
      p: number
      dklen: number
      salt: string
    }
    mac: string
  }
  version: number
}

export interface BabyJubJubPublicKey {
  x: string
  y: string
}

export interface AccountCreationResult {
  address: string
  publicKey: BabyJubJubPublicKey
  keystore: Keystore
}

export interface UnlockedAccount {
  secretKey: string
  publicKey: BabyJubJubPublicKey
  address: string
}

/**
 * Initialize BabyJubJub (call once before using crypto operations)
 */
export async function initCrypto(): Promise<void> {
  if (!babyJub) {
    babyJub = await buildBabyjub()
  }
}

/**
 * Generate a random secret key within the BN128 field.
 * Produces 32 random bytes and reduces modulo BN128_FIELD_PRIME
 * to guarantee the key is a valid field element.
 *
 * @returns The secret key as a 0x-prefixed, zero-padded 64-character hex string
 */
function generateSecretKey(): string {
  const randomBytes = getSecureRandomBytes(32)

  // Reduce modulo BN128 field prime to ensure sk is a valid field element.
  // This matches the backend which uses % subOrder (subOrder < p).
  const skBigInt = normalizeFieldElement(BigInt('0x' + bytesToHex(randomBytes)))

  return '0x' + skBigInt.toString(16).padStart(64, '0')
}

/**
 * Derive public key from secret key using BabyJubJub
 *
 * IMPORTANT: sk is reduced mod BN128 field prime before scalar multiplication.
 * Circuits receive signal inputs as field elements (mod p), so the circuit's
 * Num2Bits(254) decomposes (sk mod p). The browser must use the same reduced
 * value to produce a matching public key.
 */
export async function derivePublicKey(sk: string): Promise<BabyJubJubPublicKey> {
  await initCrypto()
  if (!babyJub) throw new Error('BabyJubJub not initialized')

  // Consistent field reduction using normalizeFieldElement helper
  const skBigInt = normalizeFieldElement(BigInt(sk))

  const pubKey = babyJub.mulPointEscalar(babyJub.Base8, skBigInt)

  return {
    x: '0x' + babyJub.F.toObject(pubKey[0]).toString(16).padStart(64, '0'),
    y: '0x' + babyJub.F.toObject(pubKey[1]).toString(16).padStart(64, '0')
  }
}

/**
 * Derive 160-bit address from public key using Poseidon
 * address = Poseidon(pk.x, pk.y) truncated to 160 bits
 */
export async function deriveAddress(pk: BabyJubJubPublicKey): Promise<string> {
  const hash = await poseidonHash([BigInt(pk.x), BigInt(pk.y)])
  const address = truncateTo160Bits(hash)
  return '0x' + address.toString(16).padStart(40, '0')
}

/**
 * Create a new BabyJubJub account in the browser
 */
export async function createAccount(passphrase: string): Promise<AccountCreationResult> {
  await initCrypto()

  // Generate keypair
  const sk = generateSecretKey()
  const pk = await derivePublicKey(sk)
  const address = await deriveAddress(pk)

  // Encrypt secret key
  const keystore = await encryptSecretKey(sk, passphrase)

  return {
    address: address.slice(2), // Remove '0x' prefix for consistency
    publicKey: pk,
    keystore
  }
}

/**
 * Unlock an account to get the secret key (browser-only, no server call)
 */
export async function unlockAccount(passphrase: string, keystore: Keystore): Promise<UnlockedAccount> {
  // Decrypt secret key
  const secretKey = await decryptSecretKey(keystore, passphrase)

  // Derive public key
  const pk = await derivePublicKey(secretKey)

  // Derive address
  const address = await deriveAddress(pk)

  return {
    secretKey,
    publicKey: pk,
    address
  }
}

/**
 * Encrypt a secret key using scrypt key derivation and AES-256-GCM symmetric encryption.
 * Produces a Keystore object containing the ciphertext, IV, salt, scrypt parameters,
 * and the GCM authentication tag (stored as `mac`).
 *
 * @param secretKey - The secret key to encrypt, as a hex string (with or without 0x prefix)
 * @param passphrase - The user-supplied passphrase used for key derivation
 * @returns A Keystore object containing all data needed for later decryption
 */
async function encryptSecretKey(secretKey: string, passphrase: string): Promise<Keystore> {
  // Generate random salt and IV with entropy verification
  const salt = getSecureRandomBytes(32)
  const iv = getSecureRandomBytes(16)

  // Derive key using scrypt
  const passphraseBytes = new TextEncoder().encode(passphrase)
  const derivedKey = await scrypt(passphraseBytes, salt, 16384, 8, 1, 32)

  // Import key for AES-GCM (convert to ArrayBuffer for Web Crypto API)
  const derivedKeyBuffer = new Uint8Array(derivedKey).buffer
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    derivedKeyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  // Encrypt secret key
  const skHex = secretKey.startsWith('0x') ? secretKey.slice(2) : secretKey
  const skBytes = hexToBytes(skHex)

  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv).buffer },
    cryptoKey,
    new Uint8Array(skBytes).buffer
  )

  // AES-GCM appends auth tag to ciphertext
  const encryptedArray = new Uint8Array(encryptedData)
  const ciphertext = encryptedArray.slice(0, -16)
  const authTag = encryptedArray.slice(-16)

  return {
    crypto: {
      cipher: 'aes-256-gcm',
      ciphertext: bytesToHex(ciphertext),
      cipherparams: {
        iv: bytesToHex(iv)
      },
      kdf: 'scrypt',
      kdfparams: {
        n: 16384,
        r: 8,
        p: 1,
        dklen: 32,
        salt: bytesToHex(salt)
      },
      mac: bytesToHex(authTag)
    },
    version: 1
  }
}

/**
 * Decrypt a secret key from an encrypted Keystore using scrypt key derivation
 * and AES-256-GCM decryption. Throws if the passphrase is incorrect.
 *
 * @param keystore - The Keystore object containing encrypted secret key data
 * @param passphrase - The user-supplied passphrase used during encryption
 * @returns The decrypted secret key as a 0x-prefixed hex string
 */
async function decryptSecretKey(keystore: Keystore, passphrase: string): Promise<string> {
  const { crypto: c } = keystore

  // Derive key using scrypt
  const salt = hexToBytes(c.kdfparams.salt)
  const passphraseBytes = new TextEncoder().encode(passphrase)
  const derivedKey = await scrypt(passphraseBytes, salt, c.kdfparams.n, c.kdfparams.r, c.kdfparams.p, c.kdfparams.dklen)

  // Import key for AES-GCM (convert to ArrayBuffer for Web Crypto API)
  const derivedKeyBuffer = new Uint8Array(derivedKey).buffer
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    derivedKeyBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  // Reconstruct encrypted data (ciphertext + auth tag)
  const ciphertext = hexToBytes(c.ciphertext)
  const authTag = hexToBytes(c.mac)
  const encryptedData = new Uint8Array(ciphertext.length + authTag.length)
  encryptedData.set(ciphertext, 0)
  encryptedData.set(authTag, ciphertext.length)

  // Decrypt
  const iv = hexToBytes(c.cipherparams.iv)

  try {
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv).buffer },
      cryptoKey,
      new Uint8Array(encryptedData).buffer
    )

    return '0x' + bytesToHex(new Uint8Array(decryptedData))
  } catch {
    throw new Error('Failed to decrypt: wrong passphrase')
  }
}

/**
 * Get the BabyJubJub instance (lazy-initialized singleton)
 */
export async function getBabyJub(): Promise<BabyJub> {
  await initCrypto()
  if (!babyJub) throw new Error('BabyJubJub not initialized')
  return babyJub
}

/**
 * Convert a Uint8Array to a lowercase hex string (no 0x prefix).
 *
 * @param bytes - The byte array to convert
 * @returns The hex-encoded string representation of the bytes
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Convert a hex string to a Uint8Array.
 * Accepts hex strings with or without the 0x prefix.
 *
 * @param hex - The hex string to convert
 * @returns A Uint8Array containing the decoded bytes
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}
