/**
 * poseidon 단위 테스트
 *
 * 테스트 항목:
 * - poseidonHash 결정성
 * - poseidonHash 다른 입력 → 다른 해시
 * - poseidonHash 다양한 입력 타입 (bigint, string, number)
 * - truncateTo160Bits 동작
 */

import { describe, it, expect } from 'vitest'
import { poseidonHash, truncateTo160Bits } from './poseidon'

describe('poseidon', () => {
  describe('poseidonHash', () => {
    it('동일 입력 → 동일 해시 (결정적)', async () => {
      const hash1 = await poseidonHash([1n, 2n, 3n])
      const hash2 = await poseidonHash([1n, 2n, 3n])
      expect(hash1).toBe(hash2)
    })

    it('다른 입력 → 다른 해시', async () => {
      const hash1 = await poseidonHash([1n, 2n, 3n])
      const hash2 = await poseidonHash([1n, 2n, 4n])
      expect(hash1).not.toBe(hash2)
    })

    it('bigint 입력', async () => {
      const hash = await poseidonHash([100n, 200n])
      expect(typeof hash).toBe('bigint')
      expect(hash > 0n).toBe(true)
    })

    it('number 입력', async () => {
      const hashNum = await poseidonHash([100, 200])
      const hashBig = await poseidonHash([100n, 200n])
      expect(hashNum).toBe(hashBig)
    })

    it('hex string 입력 (0x 접두)', async () => {
      const hashHex = await poseidonHash(['0x64', '0xc8']) // 100, 200
      const hashBig = await poseidonHash([100n, 200n])
      expect(hashHex).toBe(hashBig)
    })

    it('decimal string 입력', async () => {
      const hashStr = await poseidonHash(['100', '200'])
      const hashBig = await poseidonHash([100n, 200n])
      expect(hashStr).toBe(hashBig)
    })

    it('단일 입력', async () => {
      const hash = await poseidonHash([42n])
      expect(typeof hash).toBe('bigint')
      expect(hash > 0n).toBe(true)
    })

    it('6개 입력 (노트 해시 크기)', async () => {
      const hash = await poseidonHash([0n, 0n, 0n, 0n, 0n, 0n])
      expect(typeof hash).toBe('bigint')
      expect(hash > 0n).toBe(true)
    })
  })

  describe('truncateTo160Bits', () => {
    it('160비트 이하 값은 변하지 않음', () => {
      const value = (1n << 160n) - 1n // max 160-bit value
      expect(truncateTo160Bits(value)).toBe(value)
    })

    it('160비트 미만 값은 변하지 않음', () => {
      expect(truncateTo160Bits(0n)).toBe(0n)
      expect(truncateTo160Bits(1n)).toBe(1n)
      expect(truncateTo160Bits(0xdeadbeefn)).toBe(0xdeadbeefn)
    })

    it('160비트 초과 값은 하위 160비트만 남김', () => {
      const above = (1n << 161n) | 0xabcn
      const expected = 0xabcn
      expect(truncateTo160Bits(above)).toBe(expected)
    })

    it('254비트 값 절단', () => {
      const large = (1n << 254n) - 1n
      const mask160 = (1n << 160n) - 1n
      expect(truncateTo160Bits(large)).toBe(large & mask160)
    })
  })
})
