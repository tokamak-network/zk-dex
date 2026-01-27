/**
 * 픽스처 생성 스크립트
 *
 * 실제 BabyJubJub, Poseidon 모듈로 테스트에 필요한 실데이터를 계산.
 * 실행: npx tsx vapp/src/test-utils/generateFixtures.ts
 * 출력을 fixtures.ts에 하드코딩.
 */

import { buildBabyjub } from 'circomlibjs'
import { buildPoseidon } from 'circomlibjs'

const BN128_FIELD_PRIME = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617')

async function main() {
  const babyJub = await buildBabyjub()
  const poseidon = await buildPoseidon() as ((inputs: bigint[]) => Uint8Array) & {
    F: { toObject: (val: Uint8Array) => bigint }
  }

  function poseidonHash(inputs: bigint[]): bigint {
    const hash = poseidon(inputs)
    return poseidon.F.toObject(hash)
  }

  function truncateTo160Bits(value: bigint): bigint {
    const MASK_160 = (BigInt(1) << BigInt(160)) - BigInt(1)
    return value & MASK_160
  }

  function split256To128(value: bigint): [bigint, bigint] {
    const mask128 = (BigInt(1) << BigInt(128)) - BigInt(1)
    const low = value & mask128
    const high = value >> BigInt(128)
    return [high, low]
  }

  function hexPad64(n: bigint): string {
    return '0x' + n.toString(16).padStart(64, '0')
  }

  function hexPad40(n: bigint): string {
    return n.toString(16).padStart(40, '0')
  }

  // --- 계정 생성 ---
  const secretKeys = [
    { name: 'ALICE', sk: BigInt('0xcafebabe') },
    { name: 'BOB', sk: BigInt('0xdeadbeef') },
    { name: 'CAROL', sk: BigInt('0x1234abcd') },
  ]

  interface AccountData {
    name: string
    sk: bigint
    skHex: string
    pk: { x: bigint; y: bigint }
    pkHex: { x: string; y: string }
    vk: bigint
    vkHex: string
    address: bigint
    addressHex: string
    address0x: string
  }

  const accounts: AccountData[] = []

  for (const k of secretKeys) {
    const skReduced = k.sk % BN128_FIELD_PRIME
    const pubKey = babyJub.mulPointEscalar(babyJub.Base8, skReduced)
    const pkX = babyJub.F.toObject(pubKey[0])
    const pkY = babyJub.F.toObject(pubKey[1])

    const vk = poseidonHash([pkX, pkY])
    const address = truncateTo160Bits(vk)

    accounts.push({
      name: k.name,
      sk: k.sk,
      skHex: hexPad64(k.sk),
      pk: { x: pkX, y: pkY },
      pkHex: { x: hexPad64(pkX), y: hexPad64(pkY) },
      vk,
      vkHex: hexPad64(vk),
      address,
      addressHex: hexPad40(address),
      address0x: '0x' + hexPad40(address),
    })
  }

  // --- 노트 생성 ---
  interface NoteFixture {
    label: string
    ownerName: string
    ownerAddress: bigint
    value: bigint
    valueHex: string
    token: bigint
    tokenStr: string
    state: string
    isSmart: string
    salt: bigint
    saltHex: string
    viewingKey: bigint
    vkHex: string
    hash: bigint
    hashStr: string // decimal string (computeCircuitHash output)
    hashHex: string
  }

  const ETH = BigInt(0)
  const DAI = BigInt(1)
  const ONE_ETH = BigInt('1000000000000000000')
  const HUNDRED_DAI = BigInt('100000000000000000000')
  const TWO_ETH = BigInt('2000000000000000000')
  const FIFTY_DAI = BigInt('50000000000000000000')

  const alice = accounts[0]
  const bob = accounts[1]

  const saltBase = BigInt('0xe2e0')
  const salts = Array.from({ length: 8 }, (_, i) => saltBase + BigInt(i + 1))

  async function computeNoteHash(ownerAddr: bigint, value: bigint, token: bigint, vk: bigint, salt: bigint): Promise<bigint> {
    const [vk0, vk1] = split256To128(vk)
    return poseidonHash([ownerAddr, value, token, vk0, vk1, salt])
  }

  const noteSpecs = [
    { label: 'NOTE_ALICE_ETH_VALID', owner: alice, value: ONE_ETH, token: ETH, state: '0x1', isSmart: '0x0', saltIdx: 0 },
    { label: 'NOTE_ALICE_DAI_VALID', owner: alice, value: HUNDRED_DAI, token: DAI, state: '0x1', isSmart: '0x0', saltIdx: 1 },
    { label: 'NOTE_ALICE_ETH_SPENT', owner: alice, value: ONE_ETH, token: ETH, state: '0x3', isSmart: '0x0', saltIdx: 2 },
    { label: 'NOTE_ALICE_DAI_VALID_2', owner: alice, value: FIFTY_DAI, token: DAI, state: '0x1', isSmart: '0x0', saltIdx: 3 },
    { label: 'NOTE_BOB_ETH_VALID', owner: bob, value: TWO_ETH, token: ETH, state: '0x1', isSmart: '0x0', saltIdx: 4 },
    { label: 'NOTE_BOB_DAI_VALID', owner: bob, value: HUNDRED_DAI, token: DAI, state: '0x1', isSmart: '0x0', saltIdx: 5 },
    { label: 'NOTE_ALICE_INVALID', owner: alice, value: ONE_ETH, token: ETH, state: '0x0', isSmart: '0x0', saltIdx: 6 },
    { label: 'NOTE_ALICE_SMART', owner: alice, value: ONE_ETH, token: ETH, state: '0x1', isSmart: '0x1', saltIdx: 7 },
  ]

  const notes: NoteFixture[] = []

  for (const spec of noteSpecs) {
    const salt = salts[spec.saltIdx]
    const hash = await computeNoteHash(spec.owner.address, spec.value, spec.token, spec.owner.vk, salt)
    notes.push({
      label: spec.label,
      ownerName: spec.owner.name,
      ownerAddress: spec.owner.address,
      value: spec.value,
      valueHex: hexPad64(spec.value),
      token: spec.token,
      tokenStr: spec.token === BigInt(0) ? '0x0' : '0x1',
      state: spec.state,
      isSmart: spec.isSmart,
      salt,
      saltHex: hexPad64(salt),
      viewingKey: spec.owner.vk,
      vkHex: spec.owner.vkHex,
      hash,
      hashStr: hash.toString(),
      hashHex: hexPad64(hash),
    })
  }

  // --- 출력 ---
  console.log('// ═══════════════════════════════════════════')
  console.log('// AUTO-GENERATED — do not edit manually')
  console.log('// Regenerate: npx tsx vapp/src/test-utils/generateFixtures.ts')
  console.log('// ═══════════════════════════════════════════')
  console.log()

  console.log('// ─── Accounts ───')
  for (const a of accounts) {
    console.log(`// ${a.name}`)
    console.log(`export const ${a.name}_SK = '${a.skHex}'`)
    console.log(`export const ${a.name}_PK = { x: '${a.pkHex.x}', y: '${a.pkHex.y}' }`)
    console.log(`export const ${a.name}_ADDRESS = '${a.addressHex}'`)
    console.log(`export const ${a.name}_ADDRESS_0X = '${a.address0x}'`)
    console.log(`export const ${a.name}_VK = '${a.vkHex}'`)
    console.log()
  }

  console.log('// ─── Salts ───')
  salts.forEach((s, i) => {
    console.log(`export const SALT_${i + 1} = '${hexPad64(s)}'`)
  })
  console.log()

  console.log('// ─── Notes ───')
  for (const n of notes) {
    console.log(`export const ${n.label} = {`)
    console.log(`  hash: '${n.hashStr}',`)
    console.log(`  hashHex: '${n.hashHex}',`)
    console.log(`  owner: ${n.ownerName}_ADDRESS,`)
    console.log(`  ownerAddress: ${n.ownerName}_ADDRESS_0X,`)
    console.log(`  value: '${n.valueHex}',`)
    console.log(`  token: '${n.tokenStr}',`)
    console.log(`  state: '${n.state}',`)
    console.log(`  isSmart: '${n.isSmart}',`)
    console.log(`  salt: SALT_${n.label.includes('ALICE') && n.label.includes('ETH_VALID') && !n.label.includes('SPENT') && !n.label.includes('INVALID') && !n.label.includes('SMART') ? '1' :
      n.label.includes('DAI_VALID') && !n.label.includes('_2') && n.ownerName === 'ALICE' ? '2' :
      n.label.includes('SPENT') ? '3' :
      n.label.includes('DAI_VALID_2') ? '4' :
      n.label.includes('BOB_ETH') ? '5' :
      n.label.includes('BOB_DAI') ? '6' :
      n.label.includes('INVALID') ? '7' :
      n.label.includes('SMART') ? '8' : '?'},`)
    console.log(`  viewingKey: ${n.ownerName}_VK,`)
    console.log(`}`)
    console.log()
  }
}

main().catch(console.error)
