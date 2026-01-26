/**
 * Circuit Input Preparation Module (Poseidon version)
 *
 * Prepares circuit inputs from note data for proof generation.
 * Uses Poseidon hash (single field element) instead of SHA256 (h0/h1 split).
 */

import { poseidonHash, truncateTo160Bits } from './poseidon'

/**
 * Note data interface
 */
export interface NoteData {
  ownerAddress: string
  value: string | bigint
  token: string | bigint
  viewingKey: string
  salt: string | bigint
  noteHash?: string
}

/**
 * Formatted circuit inputs (all values as strings)
 */
export type CircuitInputs = Record<string, string>

/**
 * EMPTY_NOTE_HASH = Poseidon(0, 0, 0, 0, 0, 0)
 * Computed lazily on first use
 */
let _emptyNoteHash: string | null = null

export async function getEmptyNoteHash(): Promise<string> {
  if (_emptyNoteHash === null) {
    const hash = await poseidonHash([0, 0, 0, 0, 0, 0])
    _emptyNoteHash = hash.toString()
  }
  return _emptyNoteHash
}

/**
 * Convert hex string or bigint to BigInt
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
 * Mask value to 254 bits (BN128 field constraint)
 */
export function maskTo254Bits(value: string | bigint): bigint {
  const mask = (BigInt(1) << BigInt(254)) - BigInt(1)
  return hexToBigInt(value) & mask
}

/**
 * Split 256-bit value into two 128-bit values [high, low]
 * Still needed for viewingKey split (vk0, vk1)
 */
export function split256To128(value: string | bigint): [string, string] {
  const bigValue = hexToBigInt(value)
  const mask128 = (BigInt(1) << BigInt(128)) - BigInt(1)
  const low = bigValue & mask128
  const high = bigValue >> BigInt(128)
  return [high.toString(), low.toString()]
}

/**
 * Compute note hash using Poseidon
 * hash = Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)
 * Returns a single field element as decimal string
 */
export async function computeCircuitHash(note: NoteData): Promise<string> {
  const [vk0, vk1] = split256To128(note.viewingKey)

  const hash = await poseidonHash([
    hexToBigInt(note.ownerAddress),
    hexToBigInt(note.value),
    hexToBigInt(note.token),
    BigInt(vk0),
    BigInt(vk1),
    hexToBigInt(note.salt)
  ])

  return hash.toString()
}

/**
 * Get note hash from note object using Poseidon
 * For null/undefined notes, returns the EMPTY_NOTE_HASH
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
 * Prepare inputs for MintNBurnNote circuit (Poseidon version)
 * Circuit signals: noteHash, value, tokenType, ownerAddress, vk0, vk1, salt, sk
 */
export async function prepareMintInputs(note: NoteData, secretKey: string): Promise<CircuitInputs> {
  const noteHash = await computeCircuitHash(note)
  const [vk0, vk1] = split256To128(note.viewingKey)

  return {
    noteHash,
    value: maskTo254Bits(note.value).toString(),
    tokenType: maskTo254Bits(note.token).toString(),
    ownerAddress: hexToBigInt(note.ownerAddress).toString(),
    vk0,
    vk1,
    salt: maskTo254Bits(note.salt).toString(),
    sk: maskTo254Bits(secretKey).toString()
  }
}

/**
 * Prepare inputs for TransferNote circuit (Poseidon version)
 * Circuit signals: o0Hash, o1Hash, newHash, changeHash, + private inputs
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

  const [o0Vk0, o0Vk1] = split256To128(oldNote0.viewingKey)
  const [o1Vk0, o1Vk1] = oldNote1 ? split256To128(oldNote1.viewingKey) : ['0', '0']
  const [nVk0, nVk1] = split256To128(newNote.viewingKey)
  const [cVk0, cVk1] = split256To128(changeNote.viewingKey)

  return {
    // Public inputs
    o0Hash,
    o1Hash,
    newHash,
    changeHash,

    // Old note 0
    o0OwnerAddress: hexToBigInt(oldNote0.ownerAddress).toString(),
    o0Value: hexToBigInt(oldNote0.value).toString(),
    o0Type: hexToBigInt(oldNote0.token).toString(),
    o0Vk0,
    o0Vk1,
    o0Salt: hexToBigInt(oldNote0.salt).toString(),

    // Old note 1
    o1OwnerAddress: oldNote1 ? hexToBigInt(oldNote1.ownerAddress).toString() : '0',
    o1Value: oldNote1 ? hexToBigInt(oldNote1.value).toString() : '0',
    o1Type: oldNote1 ? hexToBigInt(oldNote1.token).toString() : '0',
    o1Vk0,
    o1Vk1,
    o1Salt: oldNote1 ? hexToBigInt(oldNote1.salt).toString() : '0',

    // New note
    nOwnerAddress: hexToBigInt(newNote.ownerAddress).toString(),
    nValue: hexToBigInt(newNote.value).toString(),
    nType: hexToBigInt(newNote.token).toString(),
    nVk0,
    nVk1,
    nSalt: hexToBigInt(newNote.salt).toString(),

    // Change note
    cOwnerAddress: hexToBigInt(changeNote.ownerAddress).toString(),
    cValue: hexToBigInt(changeNote.value).toString(),
    cType: hexToBigInt(changeNote.token).toString(),
    cVk0,
    cVk1,
    cSalt: hexToBigInt(changeNote.salt).toString(),

    // Secret keys
    sk0: hexToBigInt(sk0).toString(),
    sk1: sk1 ? hexToBigInt(sk1).toString() : '0'
  }
}

/**
 * Prepare inputs for MakeOrder circuit (Poseidon version)
 * Circuit signals: noteHash, tokenType, ownerAddress, value, vk0, vk1, salt, sk
 */
export async function prepareMakeOrderInputs(makerNote: NoteData, secretKey: string): Promise<CircuitInputs> {
  const noteHash = await getNoteHash(makerNote)
  const [vk0, vk1] = split256To128(makerNote.viewingKey)

  return {
    noteHash,
    tokenType: hexToBigInt(makerNote.token).toString(),
    ownerAddress: hexToBigInt(makerNote.ownerAddress).toString(),
    value: hexToBigInt(makerNote.value).toString(),
    vk0,
    vk1,
    salt: hexToBigInt(makerNote.salt).toString(),
    sk: hexToBigInt(secretKey).toString()
  }
}

/**
 * Prepare inputs for TakeOrder circuit (Poseidon version)
 * Circuit signals: oldNoteHash, oldType, newNoteHash, newOwnerAddress, newType,
 *   oldOwnerAddress, oldValue, oldVk0, oldVk1, oldSalt,
 *   newValue, newVk0, newVk1, newSalt, sk
 */
export async function prepareTakeOrderInputs(
  parentNote: NoteData,
  stakeNote: NoteData,
  secretKey: string
): Promise<CircuitInputs> {
  const oldNoteHash = await getNoteHash(parentNote)
  const newNoteHash = await getNoteHash(stakeNote)

  const [oldVk0, oldVk1] = split256To128(parentNote.viewingKey)
  const [newVk0, newVk1] = split256To128(stakeNote.viewingKey)

  return {
    // Public inputs
    oldNoteHash,
    oldType: hexToBigInt(parentNote.token).toString(),
    newNoteHash,
    newOwnerAddress: hexToBigInt(stakeNote.ownerAddress).toString(),
    newType: hexToBigInt(stakeNote.token).toString(),

    // Parent note private
    oldOwnerAddress: hexToBigInt(parentNote.ownerAddress).toString(),
    oldValue: hexToBigInt(parentNote.value).toString(),
    oldVk0,
    oldVk1,
    oldSalt: hexToBigInt(parentNote.salt).toString(),

    // Stake note private
    newValue: hexToBigInt(stakeNote.value).toString(),
    newVk0,
    newVk1,
    newSalt: hexToBigInt(stakeNote.salt).toString(),

    sk: hexToBigInt(secretKey).toString()
  }
}

/**
 * Prepare inputs for SettleOrder circuit (Poseidon version)
 * Circuit signals: o0Hash, o0Type, o1Hash, o1Type, n0Hash, n0OwnerAddress, n0Type,
 *   n1Hash, n1OwnerAddress, n1Type, n2Hash, n2Type, price, + private inputs
 */
export async function prepareSettleOrderInputs(
  makerNote: NoteData,
  takerStakeNote: NoteData,
  rewardNote: NoteData,
  paymentNote: NoteData,
  changeNote: NoteData,
  price: string | bigint,
  secretKey: string,
  q0: string | bigint,
  r0: string | bigint,
  q1: string | bigint,
  r1: string | bigint
): Promise<CircuitInputs> {
  const o0Hash = await getNoteHash(makerNote)
  const o1Hash = await getNoteHash(takerStakeNote)
  const n0Hash = await getNoteHash(rewardNote)
  const n1Hash = await getNoteHash(paymentNote)
  const n2Hash = await getNoteHash(changeNote)

  const [o0Vk0, o0Vk1] = split256To128(makerNote.viewingKey)
  const [o1Vk0, o1Vk1] = split256To128(takerStakeNote.viewingKey)
  const [n0Vk0, n0Vk1] = split256To128(rewardNote.viewingKey)
  const [n1Vk0, n1Vk1] = split256To128(paymentNote.viewingKey)
  const [n2Vk0, n2Vk1] = split256To128(changeNote.viewingKey)

  return {
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
    o0Vk0,
    o0Vk1,
    o0Salt: hexToBigInt(makerNote.salt).toString(),

    // Taker stake note private
    o1OwnerAddress: hexToBigInt(takerStakeNote.ownerAddress).toString(),
    o1Value: hexToBigInt(takerStakeNote.value).toString(),
    o1Vk0,
    o1Vk1,
    o1Salt: hexToBigInt(takerStakeNote.salt).toString(),

    // Reward note private
    n0Value: hexToBigInt(rewardNote.value).toString(),
    n0Vk0,
    n0Vk1,
    n0Salt: hexToBigInt(rewardNote.salt).toString(),

    // Payment note private
    n1Value: hexToBigInt(paymentNote.value).toString(),
    n1Vk0,
    n1Vk1,
    n1Salt: hexToBigInt(paymentNote.salt).toString(),

    // Change note private
    n2OwnerAddress: hexToBigInt(changeNote.ownerAddress).toString(),
    n2Value: hexToBigInt(changeNote.value).toString(),
    n2Vk0,
    n2Vk1,
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
 * Prepare inputs for ConvertNote circuit (Poseidon version)
 * Circuit signals: smartHash, originHash, newHash, + private inputs
 */
export async function prepareConvertInputs(
  smartNote: NoteData,
  originNote: NoteData,
  newNote: NoteData,
  secretKey: string
): Promise<CircuitInputs> {
  const smartHash = await getNoteHash(smartNote)
  const originHash = await getNoteHash(originNote)
  const newHash = await getNoteHash(newNote)

  const [smartVk0, smartVk1] = split256To128(smartNote.viewingKey)
  const [originVk0, originVk1] = split256To128(originNote.viewingKey)
  const [nVk0, nVk1] = split256To128(newNote.viewingKey)

  return {
    // Public inputs
    smartHash,
    originHash,
    newHash,

    // Smart note
    smartOwnerAddress: hexToBigInt(smartNote.ownerAddress).toString(),
    smartValue: hexToBigInt(smartNote.value).toString(),
    smartType: hexToBigInt(smartNote.token).toString(),
    smartVk0,
    smartVk1,
    smartSalt: hexToBigInt(smartNote.salt).toString(),

    // Origin note
    originOwnerAddress: hexToBigInt(originNote.ownerAddress).toString(),
    originValue: hexToBigInt(originNote.value).toString(),
    originType: hexToBigInt(originNote.token).toString(),
    originVk0,
    originVk1,
    originSalt: hexToBigInt(originNote.salt).toString(),

    // New note
    nOwnerAddress: hexToBigInt(newNote.ownerAddress).toString(),
    nValue: hexToBigInt(newNote.value).toString(),
    nType: hexToBigInt(newNote.token).toString(),
    nVk0,
    nVk1,
    nSalt: hexToBigInt(newNote.salt).toString(),

    sk: hexToBigInt(secretKey).toString()
  }
}

/**
 * Get smart note owner address from parent note hash
 * Simply truncate the Poseidon hash to 160 bits
 */
export function getSmartNoteOwnerAddress(noteHash: string): string {
  const hash = hexToBigInt(noteHash)
  const address = truncateTo160Bits(hash)
  return '0x' + address.toString(16).padStart(40, '0')
}

/**
 * Generate a random salt (254 bits for BN128 field compatibility)
 */
export function generateSalt(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const masked = maskTo254Bits('0x' + hex)
  return '0x' + masked.toString(16).padStart(64, '0')
}
