/**
 * Circuit Input Preparation Module (Poseidon version, 7-input hash)
 *
 * Prepares circuit inputs from note data for proof generation.
 * Uses Poseidon hash with 7 inputs: (owner0, owner1, value, tokenType, vk0, vk1, salt)
 *
 * Regular notes:
 *   owner0 = pkX, owner1 = pkY (BabyJubJub public key)
 *   vk0 = pkX, vk1 = pkY (viewing key = public key)
 *
 * Smart notes:
 *   owner0 = parentHash >> 128, owner1 = parentHash & MASK_128
 *   vk0 = owner0, vk1 = owner1 (viewing key = parent hash split)
 */

import { poseidonHash } from './poseidon'

/**
 * Note data interface (pk-based, regular notes)
 */
export interface NoteData {
  pkX: string
  pkY: string
  value: string | bigint
  token: string | bigint
  salt: string | bigint
  noteHash?: string
}

/**
 * Smart note data interface (parentHash-based, for DEX orders)
 */
export interface SmartNoteData {
  parentHash: string
  value: string | bigint
  token: string | bigint
  salt: string | bigint
  noteHash?: string
}

/**
 * Time-lock note data interface (8 inputs)
 */
export interface TimeLockNoteData {
  pkX: string
  pkY: string
  value: string | bigint
  tokenType: string | bigint
  salt: string | bigint
  unlockTime: string | bigint
  lockType: string | bigint
  vk: string | bigint
  noteHash?: string
}

/**
 * Formatted circuit inputs (all values as strings)
 */
export type CircuitInputs = Record<string, string>

/**
 * EMPTY_NOTE_HASH = Poseidon(0, 0, 0, 0, 0, 0, 0)
 * Computed lazily on first use
 */
let _emptyNoteHash: string | null = null

/**
 * Compute and cache the empty note hash, defined as Poseidon(0, 0, 0, 0, 0, 0, 0).
 *
 * @returns The empty note hash as a decimal string
 */
export async function getEmptyNoteHash(): Promise<string> {
  if (_emptyNoteHash === null) {
    const hash = await poseidonHash([0, 0, 0, 0, 0, 0, 0])
    _emptyNoteHash = hash.toString()
  }
  return _emptyNoteHash
}

/**
 * Convert a hex string, decimal string, number, or bigint to a BigInt.
 *
 * @param value - The value to convert (hex string, decimal string, number, or bigint)
 * @returns The value as a BigInt
 */
export function hexToBigInt(value: string | bigint | number): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') return BigInt(value)
  const cleanHex = value.startsWith('0x') ? value.slice(2) : value
  if (/^[0-9]+$/.test(cleanHex) && !value.startsWith('0x')) {
    return BigInt(value)
  }
  return BigInt('0x' + cleanHex)
}

/**
 * Mask a value to 254 bits by applying a bitwise AND with (2^254 - 1).
 *
 * @param value - The value to mask, as a hex string or bigint
 * @returns The value truncated to 254 bits as a BigInt
 */
export function maskTo254Bits(value: string | bigint): bigint {
  const mask = (BigInt(1) << BigInt(254)) - BigInt(1)
  return hexToBigInt(value) & mask
}

/**
 * Split a field element into two 128-bit halves.
 * Used for encoding parentHash into (owner0, owner1) for smart notes.
 *
 * @param hash - The full hash value as bigint
 * @returns { hi, lo } where hi = hash >> 128 and lo = hash & MASK_128
 */
export function split128(hash: bigint): { hi: bigint; lo: bigint } {
  const MASK_128 = (1n << 128n) - 1n
  return {
    hi: hash >> 128n,
    lo: hash & MASK_128
  }
}

/**
 * Compute note hash using Poseidon (regular note, 7 inputs)
 * hash = Poseidon(pkX, pkY, value, tokenType, pkX, pkY, salt)
 * For regular notes, vk0=pkX and vk1=pkY.
 */
export async function computeCircuitHash(note: NoteData): Promise<string> {
  const pkX = hexToBigInt(note.pkX)
  const pkY = hexToBigInt(note.pkY)
  const hash = await poseidonHash([
    pkX,
    pkY,
    hexToBigInt(note.value),
    hexToBigInt(note.token),
    pkX,  // vk0 = pkX
    pkY,  // vk1 = pkY
    hexToBigInt(note.salt)
  ])
  return hash.toString()
}

/**
 * Compute smart note hash using Poseidon (7 inputs)
 * Splits parentHash into (hi, lo) and uses:
 * hash = Poseidon(hi, lo, value, tokenType, hi, lo, salt)
 * For smart notes, owner = vk = parentHash split.
 */
export async function computeSmartNoteHash(note: SmartNoteData): Promise<string> {
  const parentHashBigInt = hexToBigInt(note.parentHash)
  const { hi, lo } = split128(parentHashBigInt)
  const hash = await poseidonHash([
    hi,       // owner0
    lo,       // owner1
    hexToBigInt(note.value),
    hexToBigInt(note.token),
    hi,       // vk0 = owner0
    lo,       // vk1 = owner1
    hexToBigInt(note.salt)
  ])
  return hash.toString()
}

/**
 * Compute time-lock note hash using Poseidon (8 inputs)
 * hash = Poseidon(pkX, pkY, value, tokenType, salt, unlockTime, lockType, vk)
 */
export async function computeTimeLockNoteHash(note: TimeLockNoteData): Promise<string> {
  const hash = await poseidonHash([
    hexToBigInt(note.pkX),
    hexToBigInt(note.pkY),
    hexToBigInt(note.value),
    hexToBigInt(note.tokenType),
    hexToBigInt(note.salt),
    hexToBigInt(note.unlockTime),
    hexToBigInt(note.lockType),
    hexToBigInt(note.vk)
  ])
  return hash.toString()
}

/**
 * Get note hash from NoteData using Poseidon.
 * For null/undefined notes, returns the EMPTY_NOTE_HASH.
 */
export async function getNoteHash(note: NoteData | null | undefined): Promise<string> {
  if (!note) {
    return await getEmptyNoteHash()
  }

  if (note.noteHash) {
    return hexToBigInt(note.noteHash).toString()
  }

  return await computeCircuitHash(note)
}

/**
 * Get smart note hash from SmartNoteData using Poseidon.
 * For null/undefined notes, returns the EMPTY_NOTE_HASH.
 */
export async function getSmartNoteHash(note: SmartNoteData | null | undefined): Promise<string> {
  if (!note) {
    return await getEmptyNoteHash()
  }

  if (note.noteHash) {
    return hexToBigInt(note.noteHash).toString()
  }

  return await computeSmartNoteHash(note)
}

/**
 * Prepare inputs for MintNBurnNote circuit
 * Circuit signals: noteHash, value, tokenType, owner0, owner1, vk0, vk1, salt, sk
 */
export async function prepareMintInputs(note: NoteData, secretKey: string): Promise<CircuitInputs> {
  const noteHash = await computeCircuitHash(note)
  const pkX = hexToBigInt(note.pkX).toString()
  const pkY = hexToBigInt(note.pkY).toString()

  return {
    noteHash,
    value: maskTo254Bits(note.value).toString(),
    tokenType: maskTo254Bits(note.token).toString(),
    owner0: pkX,
    owner1: pkY,
    vk0: pkX,   // vk = pk for regular notes
    vk1: pkY,
    salt: maskTo254Bits(note.salt).toString(),
    sk: maskTo254Bits(secretKey).toString()
  }
}

/**
 * Prepare inputs for TransferNote circuit
 * All 4 notes use the same 7-input hash format.
 */
export async function prepareTransferInputs(
  oldNote0: NoteData,
  oldNote1: NoteData | null,
  newNote: NoteData,
  changeNote: NoteData,
  sk0: string,
  sk1: string | null
): Promise<CircuitInputs> {
  const o0Hash = await getNoteHash(oldNote0)
  const o1Hash = await getNoteHash(oldNote1)
  const newHash = await getNoteHash(newNote)
  const changeHash = await getNoteHash(changeNote)

  const o0PkX = hexToBigInt(oldNote0.pkX).toString()
  const o0PkY = hexToBigInt(oldNote0.pkY).toString()
  const nPkX = hexToBigInt(newNote.pkX).toString()
  const nPkY = hexToBigInt(newNote.pkY).toString()
  const cPkX = hexToBigInt(changeNote.pkX).toString()
  const cPkY = hexToBigInt(changeNote.pkY).toString()

  return {
    // Public inputs
    o0Hash,
    o1Hash,
    newHash,
    changeHash,

    // Old note 0 (7 fields)
    o0Owner0: o0PkX,
    o0Owner1: o0PkY,
    o0Value: hexToBigInt(oldNote0.value).toString(),
    o0Type: hexToBigInt(oldNote0.token).toString(),
    o0Vk0: o0PkX,
    o0Vk1: o0PkY,
    o0Salt: hexToBigInt(oldNote0.salt).toString(),

    // Old note 1 (7 fields, all 0 if null)
    o1Owner0: oldNote1 ? hexToBigInt(oldNote1.pkX).toString() : '0',
    o1Owner1: oldNote1 ? hexToBigInt(oldNote1.pkY).toString() : '0',
    o1Value: oldNote1 ? hexToBigInt(oldNote1.value).toString() : '0',
    o1Type: oldNote1 ? hexToBigInt(oldNote1.token).toString() : '0',
    o1Vk0: oldNote1 ? hexToBigInt(oldNote1.pkX).toString() : '0',
    o1Vk1: oldNote1 ? hexToBigInt(oldNote1.pkY).toString() : '0',
    o1Salt: oldNote1 ? hexToBigInt(oldNote1.salt).toString() : '0',

    // New note (7 fields)
    nOwner0: nPkX,
    nOwner1: nPkY,
    nValue: hexToBigInt(newNote.value).toString(),
    nType: hexToBigInt(newNote.token).toString(),
    nVk0: nPkX,
    nVk1: nPkY,
    nSalt: hexToBigInt(newNote.salt).toString(),

    // Change note (7 fields)
    cOwner0: cPkX,
    cOwner1: cPkY,
    cValue: hexToBigInt(changeNote.value).toString(),
    cType: hexToBigInt(changeNote.token).toString(),
    cVk0: cPkX,
    cVk1: cPkY,
    cSalt: hexToBigInt(changeNote.salt).toString(),

    // Secret keys
    sk0: hexToBigInt(sk0).toString(),
    sk1: sk1 ? hexToBigInt(sk1).toString() : '0'
  }
}

/**
 * Prepare inputs for MakeOrder circuit
 * Circuit signals: noteHash, tokenType, owner0, owner1, value, vk0, vk1, salt, sk
 */
export async function prepareMakeOrderInputs(makerNote: NoteData, secretKey: string): Promise<CircuitInputs> {
  const noteHash = await getNoteHash(makerNote)
  const pkX = hexToBigInt(makerNote.pkX).toString()
  const pkY = hexToBigInt(makerNote.pkY).toString()

  return {
    noteHash,
    tokenType: hexToBigInt(makerNote.token).toString(),
    owner0: pkX,
    owner1: pkY,
    value: hexToBigInt(makerNote.value).toString(),
    vk0: pkX,
    vk1: pkY,
    salt: hexToBigInt(makerNote.salt).toString(),
    sk: hexToBigInt(secretKey).toString()
  }
}

/**
 * Prepare inputs for TakeOrder circuit
 * - Old note: regular (pk-based)
 * - New note: smart (parentHash split into owner, vk derived)
 */
export async function prepareTakeOrderInputs(
  parentNote: NoteData,
  stakeNote: SmartNoteData,
  secretKey: string
): Promise<CircuitInputs> {
  const oldNoteHash = await getNoteHash(parentNote)
  const newNoteHash = await getSmartNoteHash(stakeNote)
  const parentHashBigInt = hexToBigInt(stakeNote.parentHash)
  const { hi, lo } = split128(parentHashBigInt)

  const oldPkX = hexToBigInt(parentNote.pkX).toString()
  const oldPkY = hexToBigInt(parentNote.pkY).toString()

  return {
    // Public inputs
    oldNoteHash,
    oldType: hexToBigInt(parentNote.token).toString(),
    newNoteHash,
    newParentHash: parentHashBigInt.toString(),
    newType: hexToBigInt(stakeNote.token).toString(),

    // Old note private (7 fields)
    oldOwner0: oldPkX,
    oldOwner1: oldPkY,
    oldValue: hexToBigInt(parentNote.value).toString(),
    oldVk0: oldPkX,
    oldVk1: oldPkY,
    oldSalt: hexToBigInt(parentNote.salt).toString(),

    // New note private (vk0/vk1 = parentHash split)
    newValue: hexToBigInt(stakeNote.value).toString(),
    newVk0: hi.toString(),
    newVk1: lo.toString(),
    newSalt: hexToBigInt(stakeNote.salt).toString(),

    sk: hexToBigInt(secretKey).toString()
  }
}

/**
 * Prepare inputs for SettleOrder circuit
 * - Maker note (o0): regular note
 * - All other notes: smart notes (parentHash split)
 */
export async function prepareSettleOrderInputs(
  makerNote: NoteData,
  takerStakeNote: SmartNoteData,
  rewardNote: SmartNoteData,
  paymentNote: SmartNoteData,
  changeNote: SmartNoteData,
  price: string | bigint,
  secretKey: string,
  q0: string | bigint,
  r0: string | bigint,
  q1: string | bigint,
  r1: string | bigint
): Promise<CircuitInputs> {
  const o0Hash = await getNoteHash(makerNote)
  const o1Hash = await getSmartNoteHash(takerStakeNote)
  const n0Hash = await getSmartNoteHash(rewardNote)
  const n1Hash = await getSmartNoteHash(paymentNote)
  const n2Hash = await getSmartNoteHash(changeNote)

  // Split parentHashes for smart notes
  const o1Split = split128(hexToBigInt(takerStakeNote.parentHash))
  const n2Split = split128(hexToBigInt(changeNote.parentHash))

  const o0PkX = hexToBigInt(makerNote.pkX).toString()
  const o0PkY = hexToBigInt(makerNote.pkY).toString()

  return {
    // Public inputs
    o0Hash,
    o0Type: hexToBigInt(makerNote.token).toString(),
    o1Hash,
    o1Type: hexToBigInt(takerStakeNote.token).toString(),
    n0Hash,
    n0ParentHash: hexToBigInt(rewardNote.parentHash).toString(),
    n0Type: hexToBigInt(rewardNote.token).toString(),
    n1Hash,
    n1ParentHash: hexToBigInt(paymentNote.parentHash).toString(),
    n1Type: hexToBigInt(paymentNote.token).toString(),
    n2Hash,
    n2Type: hexToBigInt(changeNote.token).toString(),
    price: hexToBigInt(price).toString(),

    // Maker note private (regular, 7 fields)
    o0Owner0: o0PkX,
    o0Owner1: o0PkY,
    o0Value: hexToBigInt(makerNote.value).toString(),
    o0Vk0: o0PkX,
    o0Vk1: o0PkY,
    o0Salt: hexToBigInt(makerNote.salt).toString(),

    // Taker stake note private (smart, split parentHash)
    o1Owner0: o1Split.hi.toString(),
    o1Owner1: o1Split.lo.toString(),
    o1Value: hexToBigInt(takerStakeNote.value).toString(),
    o1Vk0: o1Split.hi.toString(),
    o1Vk1: o1Split.lo.toString(),
    o1Salt: hexToBigInt(takerStakeNote.salt).toString(),

    // Reward note private (smart, parentHash split done by circuit via n0ParentHash)
    n0Value: hexToBigInt(rewardNote.value).toString(),
    n0Vk0: split128(hexToBigInt(rewardNote.parentHash)).hi.toString(),
    n0Vk1: split128(hexToBigInt(rewardNote.parentHash)).lo.toString(),
    n0Salt: hexToBigInt(rewardNote.salt).toString(),

    // Payment note private (smart, parentHash split done by circuit via n1ParentHash)
    n1Value: hexToBigInt(paymentNote.value).toString(),
    n1Vk0: split128(hexToBigInt(paymentNote.parentHash)).hi.toString(),
    n1Vk1: split128(hexToBigInt(paymentNote.parentHash)).lo.toString(),
    n1Salt: hexToBigInt(paymentNote.salt).toString(),

    // Change note private (smart, split parentHash)
    n2Owner0: n2Split.hi.toString(),
    n2Owner1: n2Split.lo.toString(),
    n2Value: hexToBigInt(changeNote.value).toString(),
    n2Vk0: n2Split.hi.toString(),
    n2Vk1: n2Split.lo.toString(),
    n2Salt: hexToBigInt(changeNote.salt).toString(),

    // Division witnesses
    q0: hexToBigInt(q0).toString(),
    r0: hexToBigInt(r0).toString(),
    q1: hexToBigInt(q1).toString(),
    r1: hexToBigInt(r1).toString(),

    sk: hexToBigInt(secretKey).toString()
  }
}

/**
 * Prepare inputs for the ConvertNote circuit.
 * - Smart note: parentHash split into (owner0, owner1)
 * - Origin note: regular (pk-based)
 * - New note: regular (pk-based)
 */
export async function prepareConvertInputs(
  smartNote: SmartNoteData,
  originNote: NoteData,
  newNote: NoteData,
  secretKey: string
): Promise<CircuitInputs> {
  const smartHash = await getSmartNoteHash(smartNote)
  const originHash = await getNoteHash(originNote)
  const newHash = await getNoteHash(newNote)

  const smartSplit = split128(hexToBigInt(smartNote.parentHash))
  const originPkX = hexToBigInt(originNote.pkX).toString()
  const originPkY = hexToBigInt(originNote.pkY).toString()
  const nPkX = hexToBigInt(newNote.pkX).toString()
  const nPkY = hexToBigInt(newNote.pkY).toString()

  return {
    // Public inputs
    smartHash,
    originHash,
    newHash,

    // Smart note (7 fields, owner = parentHash split, vk = owner)
    smartOwner0: smartSplit.hi.toString(),
    smartOwner1: smartSplit.lo.toString(),
    smartValue: hexToBigInt(smartNote.value).toString(),
    smartType: hexToBigInt(smartNote.token).toString(),
    smartVk0: smartSplit.hi.toString(),
    smartVk1: smartSplit.lo.toString(),
    smartSalt: hexToBigInt(smartNote.salt).toString(),

    // Origin note (7 fields, regular, vk = pk)
    originOwner0: originPkX,
    originOwner1: originPkY,
    originValue: hexToBigInt(originNote.value).toString(),
    originType: hexToBigInt(originNote.token).toString(),
    originVk0: originPkX,
    originVk1: originPkY,
    originSalt: hexToBigInt(originNote.salt).toString(),

    // New note (7 fields, regular, vk = pk)
    nOwner0: nPkX,
    nOwner1: nPkY,
    nValue: hexToBigInt(newNote.value).toString(),
    nType: hexToBigInt(newNote.token).toString(),
    nVk0: nPkX,
    nVk1: nPkY,
    nSalt: hexToBigInt(newNote.salt).toString(),

    sk: hexToBigInt(secretKey).toString()
  }
}

/**
 * Generate a cryptographically random salt for note creation.
 * Produces 32 random bytes and masks the result to 254 bits.
 *
 * @returns A 0x-prefixed, zero-padded 64-character hex string representing the 254-bit salt
 */
export function generateSalt(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const masked = maskTo254Bits('0x' + hex)
  return '0x' + masked.toString(16).padStart(64, '0')
}
