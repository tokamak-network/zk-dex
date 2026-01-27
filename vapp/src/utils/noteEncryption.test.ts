/**
 * noteEncryption 단위 테스트
 *
 * 테스트 항목:
 * - encodeNoteData + decodeNoteData ECDH 라운드트립
 * - 레거시 RLP 평문 디코딩 (하위 호환)
 * - 잘못된 키로 decodeNoteData 실패
 * - 엣지 케이스 (빈 입력, 짧은 입력, 잘못된 형식)
 * - isNoteOwner 주소 비교
 */

import { describe, it, expect } from 'vitest'
import { encodeNoteData, decodeNoteData, isNoteOwner, deriveAddressFromPublicKey, type EncodedNoteData } from './noteEncryption'
import { derivePublicKey, BN128_FIELD_PRIME } from '@/lib/accountCrypto'
import { isECDHEncrypted } from '@/lib/ecdhCrypto'
import { encodeRlp } from 'ethers'

const TEST_SK = '0x00000000000000000000000000000000000000000000000000000000cafebabe'
const WRONG_SK = '0x0000000000000000000000000000000000000000000000000000000012345678'

/** 테스트용 노트 데이터 */
function createTestNoteData(overrides?: Partial<EncodedNoteData>): EncodedNoteData {
  return {
    ownerAddress: '0xd8a3f85aa09feebc667f6f612ed6b434322f9ffe',
    value: '0x0de0b6b3a7640000', // 1 ETH
    token: '0x00',
    viewingKey: '0x00',
    salt: '0x' + 'abcdef01'.padStart(64, '0'),
    ...overrides
  }
}

describe('noteEncryption', () => {
  describe('encodeNoteData + decodeNoteData 라운드트립', () => {
    it('ECDH 암호화 → 올바른 키로 복호화 → 원본 데이터 복원', async () => {
      const pk = await derivePublicKey(TEST_SK)
      const noteData = createTestNoteData()

      const encoded = await encodeNoteData(noteData, pk)

      // 출력이 ECDH 형식인지 확인
      expect(isECDHEncrypted(encoded)).toBe(true)
      expect(encoded.startsWith('0x01')).toBe(true)

      // 올바른 키로 복호화
      const decoded = await decodeNoteData(encoded, TEST_SK)
      expect(decoded).not.toBeNull()

      // 각 필드의 BigInt 값이 일치하는지 확인 (hex 표현이 다를 수 있으므로)
      expect(BigInt(decoded!.ownerAddress)).toBe(BigInt(noteData.ownerAddress))
      expect(BigInt(decoded!.value)).toBe(BigInt(noteData.value))
      expect(BigInt(decoded!.token)).toBe(BigInt(noteData.token))
      expect(BigInt(decoded!.salt)).toBe(BigInt(noteData.salt))
    })

    it('다양한 토큰 타입으로 라운드트립', async () => {
      const pk = await derivePublicKey(TEST_SK)

      // ETH (0x0)
      const ethNote = createTestNoteData({ token: '0x00' })
      const encEth = await encodeNoteData(ethNote, pk)
      const decEth = await decodeNoteData(encEth, TEST_SK)
      expect(decEth).not.toBeNull()
      expect(BigInt(decEth!.token)).toBe(0n)

      // DAI (0x1)
      const daiNote = createTestNoteData({ token: '0x01' })
      const encDai = await encodeNoteData(daiNote, pk)
      const decDai = await decodeNoteData(encDai, TEST_SK)
      expect(decDai).not.toBeNull()
      expect(BigInt(decDai!.token)).toBe(1n)
    })

    it('큰 값의 노트 라운드트립', async () => {
      const pk = await derivePublicKey(TEST_SK)
      const bigValue = '0x' + (10n ** 30n).toString(16) // 매우 큰 값
      const noteData = createTestNoteData({ value: bigValue })

      const encoded = await encodeNoteData(noteData, pk)
      const decoded = await decodeNoteData(encoded, TEST_SK)

      expect(decoded).not.toBeNull()
      expect(BigInt(decoded!.value)).toBe(BigInt(bigValue))
    })
  })

  describe('복호화 실패 케이스', () => {
    it('잘못된 키로 decodeNoteData 시 null 반환', async () => {
      const pk = await derivePublicKey(TEST_SK)
      const noteData = createTestNoteData()

      const encoded = await encodeNoteData(noteData, pk)
      const decoded = await decodeNoteData(encoded, WRONG_SK)

      expect(decoded).toBeNull()
    })

    it('ECDH 형식이지만 secretKey 없이 decodeNoteData 시 null 반환', async () => {
      const pk = await derivePublicKey(TEST_SK)
      const noteData = createTestNoteData()

      const encoded = await encodeNoteData(noteData, pk)
      const decoded = await decodeNoteData(encoded)

      expect(decoded).toBeNull()
    })

    it('빈 문자열 입력 시 null 반환', async () => {
      const decoded = await decodeNoteData('')
      expect(decoded).toBeNull()
    })

    it('짧은 32바이트 해시 입력 시 null 반환', async () => {
      const shortHash = '0x' + 'ab'.repeat(32)
      const decoded = await decodeNoteData(shortHash)
      expect(decoded).toBeNull()
    })
  })

  describe('레거시 RLP 평문 하위 호환', () => {
    it('5-필드 RLP 평문 디코딩 (secretKey 없이)', async () => {
      // 직접 RLP 인코딩한 레거시 데이터 생성
      const fields = [
        '0xd8a3f85aa09feebc667f6f612ed6b434322f9ffe', // ownerAddress
        '0x0de0b6b3a7640000',                          // value (1 ETH)
        '0x00',                                         // token
        '0x00',                                         // viewingKey
        '0x' + 'ab'.repeat(16)                          // salt
      ]
      const rlpEncoded = encodeRlp(fields)

      // 레거시 RLP은 ECDH가 아님
      expect(isECDHEncrypted(rlpEncoded)).toBe(false)

      // secretKey 없이 디코딩 가능
      const decoded = await decodeNoteData(rlpEncoded)
      expect(decoded).not.toBeNull()
      expect(BigInt(decoded!.ownerAddress)).toBe(BigInt(fields[0]))
      expect(BigInt(decoded!.value)).toBe(BigInt(fields[1]))
    })

    it('5-필드 RLP 평문에 secretKey 전달해도 정상 동작', async () => {
      const fields = [
        '0xd8a3f85aa09feebc667f6f612ed6b434322f9ffe',
        '0x0de0b6b3a7640000',
        '0x00',
        '0x00',
        '0x' + 'cd'.repeat(16)
      ]
      const rlpEncoded = encodeRlp(fields)

      // secretKey를 줘도 레거시 경로로 정상 디코딩
      const decoded = await decodeNoteData(rlpEncoded, TEST_SK)
      expect(decoded).not.toBeNull()
      expect(BigInt(decoded!.value)).toBe(BigInt(fields[1]))
    })
  })

  describe('isNoteOwner', () => {
    it('공개키에서 파생된 주소와 노트 소유자 주소가 일치하면 true', async () => {
      const pk = await derivePublicKey(TEST_SK)
      const address = await deriveAddressFromPublicKey(pk.x, pk.y)

      const noteData = createTestNoteData({ ownerAddress: address })
      const result = await isNoteOwner(noteData, pk)
      expect(result).toBe(true)
    })

    it('다른 주소이면 false', async () => {
      const pk = await derivePublicKey(TEST_SK)
      const noteData = createTestNoteData({ ownerAddress: '0x0000000000000000000000000000000000000001' })

      const result = await isNoteOwner(noteData, pk)
      expect(result).toBe(false)
    })
  })

  describe('deriveAddressFromPublicKey', () => {
    it('동일 공개키에서 항상 동일 주소 파생 (결정적)', async () => {
      const pk = await derivePublicKey(TEST_SK)

      const addr1 = await deriveAddressFromPublicKey(pk.x, pk.y)
      const addr2 = await deriveAddressFromPublicKey(pk.x, pk.y)

      expect(addr1).toBe(addr2)
      expect(addr1.startsWith('0x')).toBe(true)
      expect(addr1.length).toBe(42) // 0x + 40 hex chars = 160 bits
    })

    it('다른 공개키에서는 다른 주소 파생', async () => {
      const pkA = await derivePublicKey(TEST_SK)
      const pkB = await derivePublicKey(WRONG_SK)

      const addrA = await deriveAddressFromPublicKey(pkA.x, pkA.y)
      const addrB = await deriveAddressFromPublicKey(pkB.x, pkB.y)

      expect(addrA).not.toBe(addrB)
    })
  })
})
