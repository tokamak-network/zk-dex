import { encodeRlp, decodeRlp } from 'ethers'
import { poseidonHash, truncateTo160Bits } from '@/lib/poseidon'
import { encryptForRecipient, decryptWithSecretKey, isECDHEncrypted } from '@/lib/ecdhCrypto'
import { hexToBytes } from '@/lib/accountCrypto'

export interface EncodedNoteData {
  pkX: string    // BabyJubJub public key X coordinate
  pkY: string    // BabyJubJub public key Y coordinate
  value: string
  token: string
  salt: string
}

// Legacy format for backwards compatibility during migration
export interface LegacyEncodedNoteData {
  owner0: string
  owner1: string
  value: string
  token: string
  viewingKey: string
  salt: string
}

/**
 * Convert a value to a hex string suitable for RLP encoding.
 * Handles decimal strings, hex strings, and bigint values.
 *
 * @param value - The value to convert, which may be a decimal string, hex string
 *   (with 0x prefix), bigint, number, undefined, or null
 * @returns A 0x-prefixed, even-length hex string ready for RLP encoding.
 *   Returns '0x00' for falsy or zero values.
 */
function toHexString(value: string | bigint | number | undefined | null): string {
  // Handle falsy values and explicit zeros
  if (value === undefined || value === null || value === '' || value === '0' || value === 0 || value === 0n) {
    return '0x00'
  }

  // Handle '0x', '0x0', '0x00' etc
  if (typeof value === 'string' && value.startsWith('0x')) {
    const cleanHex = value.slice(2)
    if (cleanHex === '' || cleanHex === '0' || cleanHex === '00' || BigInt('0x' + (cleanHex || '0')) === 0n) {
      return '0x00'
    }
  }

  let hex: string

  if (typeof value === 'bigint' || typeof value === 'number') {
    const bigVal = BigInt(value)
    if (bigVal === 0n) return '0x00'
    hex = bigVal.toString(16)
  } else if (value.startsWith('0x')) {
    hex = value.slice(2)
  } else if (/^[0-9]+$/.test(value)) {
    const bigVal = BigInt(value)
    if (bigVal === 0n) return '0x00'
    hex = bigVal.toString(16)
  } else {
    hex = value
  }

  // ethers v6 encodeRlp requires even-length hex strings
  if (hex.length % 2 !== 0) {
    hex = '0' + hex
  }

  return '0x' + hex
}

/**
 * RLP-encode note fields (internal helper, produces plaintext bytes).
 * Encodes 5 fields: [pkX, pkY, value, token, salt]
 *
 * @param noteData - The note data containing pkX, pkY, value, token,
 *   and salt fields to encode
 * @returns An RLP-encoded hex string representing the serialized note fields
 */
function rlpEncodeNoteFields(noteData: EncodedNoteData): string {
  const fields = [
    toHexString(noteData.pkX),
    toHexString(noteData.pkY),
    toHexString(noteData.value),
    toHexString(noteData.token),
    toHexString(noteData.salt)
  ]
  return encodeRlp(fields)
}

/**
 * Encode note data to ECDH-encrypted bytes for on-chain storage.
 * Encrypts RLP-encoded note data with the recipient's BabyJubJub public key.
 *
 * @param noteData - Note fields to encode
 * @param recipientPk - Recipient's BabyJubJub public key {x, y} as hex strings
 * @returns ECDH-encrypted hex string: 0x01 || epk || nonce || ciphertext || authTag
 */
export async function encodeNoteData(
  noteData: EncodedNoteData,
  recipientPk: { x: string; y: string }
): Promise<string> {
  // RLP-encode note fields to get plaintext
  const rlpHex = rlpEncodeNoteFields(noteData)
  const plaintext = hexToBytes(rlpHex.startsWith('0x') ? rlpHex.slice(2) : rlpHex)

  // ECDH encrypt for recipient
  return encryptForRecipient(plaintext, recipientPk)
}

/**
 * Decode note data from on-chain bytes.
 * Supports:
 *   - ECDH encrypted format (0x01 prefix) — requires secretKey
 *   - Legacy RLP plaintext (0xc0-0xff prefix) — no secretKey needed
 *   - Legacy 6-field RLP format
 *
 * @param encodedHex - On-chain encrypted/encoded note data
 * @param secretKey - Recipient's secret key (required for ECDH, optional for legacy)
 * @returns Decoded note data, or null if decryption/decoding fails
 */
export async function decodeNoteData(
  encodedHex: string,
  secretKey?: string
): Promise<EncodedNoteData | null> {
  try {
    // Check if this is very old format (32 bytes = 64 hex chars + 0x prefix = 66 chars)
    if (encodedHex.length === 66) {
      return null
    }

    // ECDH encrypted format: starts with version byte 0x01
    if (isECDHEncrypted(encodedHex)) {
      if (!secretKey) return null

      const plaintext = await decryptWithSecretKey(encodedHex, secretKey)
      if (!plaintext) return null

      // Plaintext is RLP-encoded note data
      const rlpHex = '0x' + Array.from(plaintext).map(b => b.toString(16).padStart(2, '0')).join('')
      return decodeRlpNoteData(rlpHex)
    }

    // Legacy RLP plaintext format
    return decodeRlpNoteData(encodedHex)
  } catch {
    return null
  }
}

/**
 * Decode RLP-encoded note data.
 * Supports both the current 5-field format [pkX, pkY, value, token, salt]
 * and the legacy 6-field format [owner0, owner1, value, token, viewingKey, salt].
 *
 * @param rlpHex - A 0x-prefixed hex string containing RLP-encoded note data
 * @returns The decoded note data as an EncodedNoteData object, or null if
 *   decoding fails or the field count is unrecognized
 */
function decodeRlpNoteData(rlpHex: string): EncodedNoteData | null {
  try {
    const decoded = decodeRlp(rlpHex) as string[]

    if (!Array.isArray(decoded)) {
      return null
    }

    // New format: 5 fields [pkX, pkY, value, token, salt]
    if (decoded.length === 5) {
      return {
        pkX: decoded[0],
        pkY: decoded[1],
        value: decoded[2],
        token: decoded[3],
        salt: decoded[4]
      }
    }

    // Legacy format: 6 fields [owner0, owner1, value, token, viewingKey, salt]
    // owner0 = pk.x, owner1 = pk.y — map directly to pkX/pkY
    if (decoded.length === 6) {
      const legacyData: LegacyEncodedNoteData = {
        owner0: decoded[0],
        owner1: decoded[1],
        value: decoded[2],
        token: decoded[3],
        viewingKey: decoded[4],
        salt: decoded[5]
      }
      return {
        pkX: legacyData.owner0,
        pkY: legacyData.owner1,
        value: legacyData.value,
        token: legacyData.token,
        salt: legacyData.salt
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Derive 160-bit address from BabyJubJub public key using Poseidon.
 * address = Poseidon(pk.x, pk.y) truncated to 160 bits.
 * Kept for potential account display uses.
 */
export async function deriveAddressFromPublicKey(pkX: string, pkY: string): Promise<string> {
  const hash = await poseidonHash([BigInt(pkX), BigInt(pkY)])
  const address = truncateTo160Bits(hash)
  return '0x' + address.toString(16).padStart(40, '0')
}

/**
 * Check if note belongs to account by comparing BabyJubJub public keys directly.
 * Kept as async for API compatibility, but the comparison is synchronous.
 */
export async function isNoteOwner(
  noteData: EncodedNoteData,
  accountPublicKey: { x: string; y: string }
): Promise<boolean> {
  const notePkX = BigInt(noteData.pkX)
  const notePkY = BigInt(noteData.pkY)
  const accountPkX = BigInt(accountPublicKey.x)
  const accountPkY = BigInt(accountPublicKey.y)
  return notePkX === accountPkX && notePkY === accountPkY
}

/**
 * Check if note is a smart note by comparing pkX with a parent note hash.
 * Smart notes don't use pk-based EncodedNoteData — they're a different format.
 * This function is kept for backwards compatibility but may need rethinking.
 * For now, just compare the first field (which would be parentHash in smart notes).
 */
export function isSmartNoteOwner(noteData: EncodedNoteData, parentNoteHash: string): boolean {
  const notePkX = BigInt(noteData.pkX)
  const expectedHash = BigInt(parentNoteHash)
  return notePkX === expectedHash
}
