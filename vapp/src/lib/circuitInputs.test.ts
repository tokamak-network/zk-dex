/**
 * circuitInputs 단위 테스트
 *
 * 테스트 항목:
 * - hexToBigInt 다양한 입력
 * - maskTo254Bits 동작
 * - generateSalt 형식
 * - computeCircuitHash 결정성
 * - getNoteHash null/undefined → 빈 노트 해시
 * - prepareMintInputs 필드 완전성
 */

import { describe, it, expect } from 'vitest'
import {
  hexToBigInt,
  maskTo254Bits,
  generateSalt,
  computeCircuitHash,
  getNoteHash,
  getEmptyNoteHash,
  prepareMintInputs,
  prepareTransferInputs,
  prepareMakeOrderInputs,
  type NoteData
} from './circuitInputs'

function createTestNote(overrides?: Partial<NoteData>): NoteData {
  return {
    pkX: '0x2b52e1908bed7b1f474026b72e1c887e2c2462cf33b20b5b562e8bc096ee7083',
    pkY: '0x14f9761fff9429e5e33dc8b4b43627276fab15d753d758a24b51f1e75ec10a95',
    value: '0x0de0b6b3a7640000', // 1 ETH
    token: '0x00',
    salt: '0x' + 'abcdef01'.padStart(64, '0'),
    ...overrides
  }
}

describe('circuitInputs', () => {
  describe('hexToBigInt', () => {
    it('bigint 입력 그대로 반환', () => {
      expect(hexToBigInt(42n)).toBe(42n)
    })

    it('number 입력 변환', () => {
      expect(hexToBigInt(42)).toBe(42n)
    })

    it('0x hex string 변환', () => {
      expect(hexToBigInt('0xff')).toBe(255n)
      expect(hexToBigInt('0x0')).toBe(0n)
      expect(hexToBigInt('0x0de0b6b3a7640000')).toBe(1000000000000000000n)
    })

    it('decimal string 변환', () => {
      expect(hexToBigInt('42')).toBe(42n)
      expect(hexToBigInt('0')).toBe(0n)
    })

    it('hex string without 0x prefix 변환', () => {
      expect(hexToBigInt('ff')).toBe(255n)
    })
  })

  describe('maskTo254Bits', () => {
    it('254비트 이하 값 변하지 않음', () => {
      expect(maskTo254Bits(0n)).toBe(0n)
      expect(maskTo254Bits(1n)).toBe(1n)
      expect(maskTo254Bits('0xff')).toBe(255n)
    })

    it('256비트 값 → 상위 2비트 제거', () => {
      const full256 = (1n << 256n) - 1n
      const expected = (1n << 254n) - 1n
      expect(maskTo254Bits(full256)).toBe(expected)
    })

    it('정확히 254비트 값은 변하지 않음', () => {
      const val = (1n << 254n) - 1n
      expect(maskTo254Bits(val)).toBe(val)
    })
  })

  describe('generateSalt', () => {
    it('0x 접두사 + 64 hex 문자 (32바이트)', () => {
      const salt = generateSalt()
      expect(salt.startsWith('0x')).toBe(true)
      expect(salt.length).toBe(66) // 0x + 64
    })

    it('254비트 이내', () => {
      const salt = generateSalt()
      const val = BigInt(salt)
      expect(val < (1n << 254n)).toBe(true)
    })

    it('매번 다른 값 생성', () => {
      const salt1 = generateSalt()
      const salt2 = generateSalt()
      expect(salt1).not.toBe(salt2)
    })
  })

  describe('computeCircuitHash', () => {
    it('동일 노트 → 동일 해시 (결정적)', async () => {
      const note = createTestNote()
      const hash1 = await computeCircuitHash(note)
      const hash2 = await computeCircuitHash(note)
      expect(hash1).toBe(hash2)
    })

    it('다른 노트 → 다른 해시', async () => {
      const note1 = createTestNote({ value: '0x01' })
      const note2 = createTestNote({ value: '0x02' })
      const hash1 = await computeCircuitHash(note1)
      const hash2 = await computeCircuitHash(note2)
      expect(hash1).not.toBe(hash2)
    })

    it('해시가 decimal string 형식', async () => {
      const hash = await computeCircuitHash(createTestNote())
      expect(/^[0-9]+$/.test(hash)).toBe(true)
      expect(BigInt(hash) > 0n).toBe(true)
    })
  })

  describe('getNoteHash', () => {
    it('null → 빈 노트 해시', async () => {
      const hash = await getNoteHash(null)
      const emptyHash = await getEmptyNoteHash()
      expect(hash).toBe(emptyHash)
    })

    it('undefined → 빈 노트 해시', async () => {
      const hash = await getNoteHash(undefined)
      const emptyHash = await getEmptyNoteHash()
      expect(hash).toBe(emptyHash)
    })

    it('noteHash 필드가 있으면 그 값을 사용', async () => {
      const note = createTestNote({ noteHash: '0xabcd' })
      const hash = await getNoteHash(note)
      expect(hash).toBe(BigInt('0xabcd').toString())
    })

    it('noteHash 없으면 computeCircuitHash 사용', async () => {
      const note = createTestNote()
      const hash = await getNoteHash(note)
      const expected = await computeCircuitHash(note)
      expect(hash).toBe(expected)
    })
  })

  describe('getEmptyNoteHash', () => {
    it('결정적 값', async () => {
      const h1 = await getEmptyNoteHash()
      const h2 = await getEmptyNoteHash()
      expect(h1).toBe(h2)
    })

    it('decimal string 형식', async () => {
      const h = await getEmptyNoteHash()
      expect(/^[0-9]+$/.test(h)).toBe(true)
    })
  })

  describe('prepareMintInputs', () => {
    it('모든 필수 필드 포함', async () => {
      const note = createTestNote()
      const sk = '0x00000000000000000000000000000000000000000000000000000000cafebabe'
      const inputs = await prepareMintInputs(note, sk)

      expect(inputs.noteHash).toBeTruthy()
      expect(inputs.value).toBeTruthy()
      expect(inputs.tokenType).toBeDefined()
      expect(inputs.owner0).toBeTruthy()
      expect(inputs.owner1).toBeTruthy()
      expect(inputs.vk0).toBeTruthy()
      expect(inputs.vk1).toBeTruthy()
      expect(inputs.salt).toBeTruthy()
      expect(inputs.sk).toBeTruthy()
    })

    it('모든 값이 decimal string', async () => {
      const note = createTestNote()
      const sk = '0xcafebabe'
      const inputs = await prepareMintInputs(note, sk)

      for (const [, val] of Object.entries(inputs)) {
        expect(/^[0-9]+$/.test(val)).toBe(true)
      }
    })
  })

  describe('prepareTransferInputs', () => {
    it('모든 필수 필드 포함', async () => {
      const note0 = createTestNote()
      const newNote = createTestNote({ value: '0x0a', salt: '0x' + 'ff'.repeat(32) })
      const changeNote = createTestNote({ value: '0x0b', salt: '0x' + 'ee'.repeat(32) })
      const sk0 = '0xcafebabe'

      const inputs = await prepareTransferInputs(note0, null, newNote, changeNote, sk0, null)

      expect(inputs.o0Hash).toBeTruthy()
      expect(inputs.o1Hash).toBeTruthy()
      expect(inputs.newHash).toBeTruthy()
      expect(inputs.changeHash).toBeTruthy()
      expect(inputs.sk0).toBeTruthy()
      expect(inputs.sk1).toBe('0')
    })

    it('두 번째 노트 null일 때 기본값 0', async () => {
      const note0 = createTestNote()
      const newNote = createTestNote({ value: '0x0a', salt: '0x' + 'ff'.repeat(32) })
      const changeNote = createTestNote({ value: '0x0b', salt: '0x' + 'ee'.repeat(32) })

      const inputs = await prepareTransferInputs(note0, null, newNote, changeNote, '0xcafe', null)

      expect(inputs.o1Owner0).toBe('0')
      expect(inputs.o1Owner1).toBe('0')
      expect(inputs.o1Value).toBe('0')
      expect(inputs.o1Type).toBe('0')
      expect(inputs.o1Vk0).toBe('0')
      expect(inputs.o1Vk1).toBe('0')
      expect(inputs.o1Salt).toBe('0')
    })
  })

  describe('prepareMakeOrderInputs', () => {
    it('모든 필수 필드 포함', async () => {
      const note = createTestNote()
      const sk = '0xcafebabe'
      const inputs = await prepareMakeOrderInputs(note, sk)

      expect(inputs.noteHash).toBeTruthy()
      expect(inputs.tokenType).toBeDefined()
      expect(inputs.owner0).toBeTruthy()
      expect(inputs.owner1).toBeTruthy()
      expect(inputs.value).toBeTruthy()
      expect(inputs.vk0).toBeTruthy()
      expect(inputs.vk1).toBeTruthy()
      expect(inputs.salt).toBeTruthy()
      expect(inputs.sk).toBeTruthy()
    })
  })
})
