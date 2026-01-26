/**
 * Browser-side Poseidon hash module
 * Shared singleton for all modules that need Poseidon hashing
 */

import { buildPoseidon } from 'circomlibjs'

let poseidon: any = null
let initPromise: Promise<any> | null = null

async function init() {
  if (poseidon) {
    return poseidon
  }
  // Prevent concurrent buildPoseidon() calls
  if (!initPromise) {
    initPromise = buildPoseidon().then(p => {
      poseidon = p
      return p
    })
  }
  return initPromise
}

/**
 * Compute Poseidon hash of field elements
 * @param inputs Array of field elements (bigint, string, or number)
 * @returns Hash as bigint
 */
export async function poseidonHash(inputs: (bigint | string | number)[]): Promise<bigint> {
  const p = await init()
  const bigInputs = inputs.map(x => {
    if (typeof x === 'bigint') return x
    if (typeof x === 'number') return BigInt(x)
    if (typeof x === 'string') {
      if (x.startsWith('0x')) return BigInt(x)
      if (/^[0-9]+$/.test(x)) return BigInt(x)
      return BigInt('0x' + x)
    }
    throw new Error(`Invalid Poseidon input type: ${typeof x}`)
  })
  const hash = p(bigInputs)
  return p.F.toObject(hash)
}

/**
 * Truncate a field element to 160 bits (for address derivation)
 */
export function truncateTo160Bits(value: bigint): bigint {
  const MASK_160 = (BigInt(1) << BigInt(160)) - BigInt(1)
  return value & MASK_160
}
