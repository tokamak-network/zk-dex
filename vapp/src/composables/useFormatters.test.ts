/**
 * useFormatters 단위 테스트
 *
 * 테스트 항목:
 * - padLeft
 * - hexToNumberString
 * - toNumberString
 * - formatAddress
 * - orderState / noteState / transferNoteType / orderType / tokenType / isSmartNote
 * - abbreviate / formatZkAddress / abbreviateZk
 * - formatTimestamp
 */

import { describe, it, expect } from 'vitest'
import { useFormatters } from './useFormatters'

const {
  padLeft,
  hexToNumberString,
  toNumberString,
  formatAddress,
  formatZkAddress,
  orderState,
  noteState,
  transferNoteType,
  orderType,
  tokenType,
  isSmartNote,
  abbreviate,
  abbreviateZk,
  formatTimestamp
} = useFormatters()

describe('useFormatters', () => {
  describe('padLeft', () => {
    it('숫자를 지정 길이로 패딩 (length/2 바이트)', () => {
      // padLeft(1, 64) → zeroPadValue(hex, 32) → 32바이트 = 64 hex chars
      const result = padLeft(1, 64)
      expect(result.length).toBe(66) // 0x + 64
      expect(result).toBe('0x' + '0'.repeat(63) + '1')
    })

    it('20바이트 (주소 길이) 패딩', () => {
      const result = padLeft(0xff, 40) // 40/2 = 20 bytes
      expect(result.length).toBe(42) // 0x + 40
      expect(result).toBe('0x' + '0'.repeat(38) + 'ff')
    })
  })

  describe('hexToNumberString', () => {
    it('hex → decimal string', () => {
      expect(hexToNumberString('0x0')).toBe('0')
      expect(hexToNumberString('0xff')).toBe('255')
      expect(hexToNumberString('0x0de0b6b3a7640000')).toBe('1000000000000000000')
    })
  })

  describe('toNumberString', () => {
    it('bigint → string', () => {
      expect(toNumberString(42n)).toBe('42')
    })

    it('number → string', () => {
      expect(toNumberString(42)).toBe('42')
    })

    it('string → string', () => {
      expect(toNumberString('hello')).toBe('hello')
    })
  })

  describe('formatAddress', () => {
    it('20바이트로 패딩된 주소 반환', () => {
      const addr = formatAddress(1)
      expect(addr.startsWith('0x')).toBe(true)
      expect(addr.length).toBe(42) // 0x + 40
    })

    it('hex string 입력', () => {
      const addr = formatAddress('0xff')
      expect(addr).toBe('0x00000000000000000000000000000000000000ff')
    })

    it('bigint 입력', () => {
      const addr = formatAddress(0xdeadbeefn)
      expect(addr).toBe('0x00000000000000000000000000000000deadbeef')
    })
  })

  describe('orderState', () => {
    it('0x0 → CREATED', () => expect(orderState('0x0')).toBe('CREATED'))
    it('0x1 → TAKEN', () => expect(orderState('0x1')).toBe('TAKEN'))
    it('0x2 → SETTLED', () => expect(orderState('0x2')).toBe('SETTLED'))
    it('unknown → empty', () => expect(orderState('0x9')).toBe(''))
  })

  describe('noteState', () => {
    it('0x0 → INVALID', () => expect(noteState('0x0')).toBe('INVALID'))
    it('0x1 → VALID', () => expect(noteState('0x1')).toBe('VALID'))
    it('0x2 → TRADING', () => expect(noteState('0x2')).toBe('TRADING'))
    it('0x3 → SPENT', () => expect(noteState('0x3')).toBe('SPENT'))
    it('unknown → empty', () => expect(noteState('0x9')).toBe(''))
  })

  describe('transferNoteType', () => {
    it('0x0 → Send', () => expect(transferNoteType('0x0')).toBe('Send'))
    it('0x1 → Receive', () => expect(transferNoteType('0x1')).toBe('Receive'))
    it('unknown → empty', () => expect(transferNoteType('0x9')).toBe(''))
  })

  describe('orderType', () => {
    it('0x0 → Sell', () => expect(orderType('0x0')).toBe('Sell'))
    it('0x1 → Buy', () => expect(orderType('0x1')).toBe('Buy'))
    it('unknown → empty', () => expect(orderType('0x9')).toBe(''))
  })

  describe('tokenType', () => {
    it('0x0 → ETH', () => expect(tokenType('0x0')).toBe('ETH'))
    it('0x1 → DAI', () => expect(tokenType('0x1')).toBe('DAI'))
    it('패딩된 0x00 → ETH', () => expect(tokenType('0x00')).toBe('ETH'))
    it('패딩된 0x01 → DAI', () => expect(tokenType('0x01')).toBe('DAI'))
    it('unknown → empty', () => expect(tokenType('0x9')).toBe(''))
    it('빈 문자열 → ETH', () => expect(tokenType('')).toBe('ETH'))
  })

  describe('isSmartNote', () => {
    it('0x0 → false', () => expect(isSmartNote('0x0')).toBe(false))
    it('0x1 → true', () => expect(isSmartNote('0x1')).toBe(true))
    it('unknown → empty', () => expect(isSmartNote('0x9')).toBe(''))
  })

  describe('abbreviate', () => {
    it('긴 주소 축약', () => {
      const addr = '0xd8a3f85aa09feebc667f6f612ed6b434322f9ffe'
      expect(abbreviate(addr)).toBe('0xd8a3...9ffe')
    })

    it('빈 문자열 → 빈 문자열', () => {
      expect(abbreviate('')).toBe('')
    })
  })

  describe('formatZkAddress', () => {
    it('0x 접두사 → zk0x 접두사', () => {
      expect(formatZkAddress('0xabcd')).toBe('zk0xabcd')
    })

    it('0x 없는 주소 → zk0x 접두사', () => {
      expect(formatZkAddress('abcd')).toBe('zk0xabcd')
    })

    it('빈 문자열 → 빈 문자열', () => {
      expect(formatZkAddress('')).toBe('')
    })
  })

  describe('abbreviateZk', () => {
    it('긴 zk 주소 축약', () => {
      const addr = '0xd8a3f85aa09feebc667f6f612ed6b434322f9ffe'
      const result = abbreviateZk(addr)
      expect(result.startsWith('zk0x')).toBe(true)
      expect(result).toContain('...')
    })

    it('빈 문자열 → 빈 문자열', () => {
      expect(abbreviateZk('')).toBe('')
    })
  })

  describe('formatTimestamp', () => {
    it('유닉스 타임스탬프 → 날짜 문자열', () => {
      // 2024-01-15 12:30:00 UTC
      const ts = 1705318200
      const result = formatTimestamp(ts)
      // 형식: YYYY-MM-DD HH:MM
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    })

    it('0 → -', () => {
      expect(formatTimestamp(0)).toBe('-')
    })

    it('undefined → -', () => {
      expect(formatTimestamp(undefined)).toBe('-')
    })
  })
})
