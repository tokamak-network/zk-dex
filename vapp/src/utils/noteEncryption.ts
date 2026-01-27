import { encodeRlp, decodeRlp } from 'ethers'
import { poseidonHash, truncateTo160Bits } from '@/lib/poseidon'
import { encryptForRecipient, decryptWithSecretKey, isECDHEncrypted } from '@/lib/ecdhCrypto'
import { hexToBytes } from '@/lib/accountCrypto'

export interface EncodedNoteData {
  ownerAddress: string  // 160-bit address (40 hex chars)
  value: string
  token: string
  viewingKey: string
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
 */
function toHexString(value: string | bigint | number | undefined | null): string {
  if (value === undefined || value === null || value === '' || value === '0') return '0x00'

  let hex: string

  if (typeof value === 'bigint' || typeof value === 'number') {
    hex = BigInt(value).toString(16)
  } else if (value.startsWith('0x')) {
    hex = value.slice(2)
  } else if (/^[0-9]+$/.test(value)) {
    hex = BigInt(value).toString(16)
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
 * RLP-encode note fields (internal helper, produces plaintext bytes)
 */
function rlpEncodeNoteFields(noteData: EncodedNoteData): string {
  const fields = [
    toHexString(noteData.ownerAddress),
    toHexString(noteData.value),
    toHexString(noteData.token),
    toHexString(noteData.viewingKey),
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
 * Decode RLP-encoded note data (legacy plaintext or decrypted ECDH payload)
 */
async function decodeRlpNoteData(rlpHex: string): Promise<EncodedNoteData | null> {
  try {
    const decoded = decodeRlp(rlpHex) as string[]

    if (!Array.isArray(decoded)) {
      return null
    }

    // New format: 5 fields [ownerAddress, value, token, viewingKey, salt]
    if (decoded.length === 5) {
      return {
        ownerAddress: decoded[0],
        value: decoded[1],
        token: decoded[2],
        viewingKey: decoded[3],
        salt: decoded[4]
      }
    }

    // Legacy format: 6 fields [owner0, owner1, value, token, viewingKey, salt]
    // Convert to new format by deriving address from public key
    if (decoded.length === 6) {
      const legacyData: LegacyEncodedNoteData = {
        owner0: decoded[0],
        owner1: decoded[1],
        value: decoded[2],
        token: decoded[3],
        viewingKey: decoded[4],
        salt: decoded[5]
      }
      // Derive address from public key: Poseidon(pk.x, pk.y) truncated to 160 bits
      const address = await deriveAddressFromPublicKey(legacyData.owner0, legacyData.owner1)
      return {
        ownerAddress: address,
        value: legacyData.value,
        token: legacyData.token,
        viewingKey: legacyData.viewingKey,
        salt: legacyData.salt
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Derive 160-bit address from BabyJubJub public key using Poseidon
 * address = Poseidon(pk.x, pk.y) truncated to 160 bits
 */
export async function deriveAddressFromPublicKey(pkX: string, pkY: string): Promise<string> {
  const hash = await poseidonHash([BigInt(pkX), BigInt(pkY)])
  const address = truncateTo160Bits(hash)
  return '0x' + address.toString(16).padStart(40, '0')
}

/**
 * Check if note belongs to account by comparing addresses
 * (Used for legacy RLP plaintext notes where decryption is not needed)
 */
export async function isNoteOwner(
  noteData: EncodedNoteData,
  accountPublicKey: { x: string; y: string }
): Promise<boolean> {
  // Derive address from account's public key using Poseidon
  const accountAddress = await deriveAddressFromPublicKey(accountPublicKey.x, accountPublicKey.y)

  // Normalize both to BigInt for comparison
  const noteOwnerAddress = BigInt(noteData.ownerAddress)
  const accountAddr = BigInt(accountAddress)

  return noteOwnerAddress === accountAddr
}

/**
 * Check if note is a smart note by comparing owner with a note hash
 * Smart notes have ownerAddress = truncated hash of another note
 */
export function isSmartNoteOwner(noteData: EncodedNoteData, parentNoteHash: string): boolean {
  // Get last 160 bits of parent note hash
  const cleanHash = parentNoteHash.startsWith('0x') ? parentNoteHash.slice(2) : parentNoteHash
  const truncatedHash = '0x' + cleanHash.padStart(64, '0').slice(-40)

  const noteOwner = BigInt(noteData.ownerAddress)
  const expectedOwner = BigInt(truncatedHash)

  return noteOwner === expectedOwner
}
