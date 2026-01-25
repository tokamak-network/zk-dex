import { encodeRlp, decodeRlp, hexlify, getBytes } from 'ethers'

export interface EncodedNoteData {
  owner0: string
  owner1: string
  value: string
  token: string
  viewingKey: string
  salt: string
}

/**
 * Encode note data to bytes for on-chain storage
 * Uses RLP encoding to pack all note fields
 */
export function encodeNoteData(noteData: EncodedNoteData): string {
  const fields = [
    noteData.owner0,
    noteData.owner1,
    noteData.value,
    noteData.token,
    noteData.viewingKey || '0x0',
    noteData.salt
  ]
  return encodeRlp(fields)
}

/**
 * Decode note data from on-chain bytes
 * Returns null for old format notes (32 bytes, owner0 only) which cannot be recovered
 */
export function decodeNoteData(encodedHex: string): EncodedNoteData | null {
  try {
    // Check if this is old format (32 bytes = 64 hex chars + 0x prefix = 66 chars)
    // Old format stored only owner0, so we can't recover the full note data
    if (encodedHex.length === 66) {
      // Old format - cannot decode, return null silently
      return null
    }

    const decoded = decodeRlp(encodedHex) as string[]

    if (!Array.isArray(decoded) || decoded.length < 6) {
      // Invalid format
      return null
    }

    return {
      owner0: decoded[0],
      owner1: decoded[1],
      value: decoded[2],
      token: decoded[3],
      viewingKey: decoded[4],
      salt: decoded[5]
    }
  } catch (err) {
    // Failed to decode - likely old format or corrupted data
    // Silently return null instead of logging error for expected cases
    return null
  }
}

/**
 * Check if note belongs to account by comparing public key
 */
export function isNoteOwner(
  noteData: EncodedNoteData,
  accountPublicKey: { x: string; y: string }
): boolean {
  // Normalize to compare
  const noteOwner0 = BigInt(noteData.owner0)
  const noteOwner1 = BigInt(noteData.owner1)
  const pubKeyX = BigInt(accountPublicKey.x)
  const pubKeyY = BigInt(accountPublicKey.y)

  return noteOwner0 === pubKeyX && noteOwner1 === pubKeyY
}
