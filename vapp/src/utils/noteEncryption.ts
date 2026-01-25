import { encodeRlp, decodeRlp, sha256 } from 'ethers'

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
 * Encode note data to bytes for on-chain storage
 * Uses RLP encoding: [ownerAddress, value, token, viewingKey, salt]
 */
export function encodeNoteData(noteData: EncodedNoteData): string {
  const fields = [
    noteData.ownerAddress,
    noteData.value,
    noteData.token,
    noteData.viewingKey || '0x0',
    noteData.salt
  ]
  return encodeRlp(fields)
}

/**
 * Decode note data from on-chain bytes
 * Supports both new format (5 fields) and legacy format (6 fields)
 * Returns null for undecodable data
 */
export function decodeNoteData(encodedHex: string): EncodedNoteData | null {
  try {
    // Check if this is very old format (32 bytes = 64 hex chars + 0x prefix = 66 chars)
    if (encodedHex.length === 66) {
      return null
    }

    const decoded = decodeRlp(encodedHex) as string[]

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
      // Derive address from public key: SHA256(pk.x || pk.y)[96:256]
      const address = deriveAddressFromPublicKey(legacyData.owner0, legacyData.owner1)
      return {
        ownerAddress: address,
        value: legacyData.value,
        token: legacyData.token,
        viewingKey: legacyData.viewingKey,
        salt: legacyData.salt
      }
    }

    return null
  } catch (err) {
    return null
  }
}

/**
 * Derive 160-bit address from BabyJubJub public key
 * address = SHA256(pk.x || pk.y)[96:256] (last 160 bits)
 */
export function deriveAddressFromPublicKey(pkX: string, pkY: string): string {
  // Pad to 32 bytes each (256 bits)
  const xBig = BigInt(pkX)
  const yBig = BigInt(pkY)
  const xHex = xBig.toString(16).padStart(64, '0')
  const yHex = yBig.toString(16).padStart(64, '0')

  // Concatenate and hash
  const data = '0x' + xHex + yHex
  const hash = sha256(data)

  // Take last 160 bits (40 hex chars)
  return '0x' + hash.slice(-40)
}

/**
 * Check if note belongs to account by comparing addresses
 */
export function isNoteOwner(
  noteData: EncodedNoteData,
  accountPublicKey: { x: string; y: string }
): boolean {
  // Derive address from account's public key
  const accountAddress = deriveAddressFromPublicKey(accountPublicKey.x, accountPublicKey.y)

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
