/**
 * ECDH 암호화 단위 테스트
 *
 * 테스트 항목:
 * - 암호화/복호화 라운드트립
 * - 잘못된 키로 복호화 실패
 * - isECDHEncrypted 형식 판별
 * - 다양한 평문 크기
 * - 출력 데이터 형식 검증
 */

import { describe, it, expect } from 'vitest'
import { encryptForRecipient, decryptWithSecretKey, isECDHEncrypted } from './ecdhCrypto'
import { derivePublicKey, bytesToHex, hexToBytes, BN128_FIELD_PRIME } from './accountCrypto'

/** 테스트용 고정 시크릿 키 (BN128 필드 내 값) */
const TEST_SK_A = '0x' + (BN128_FIELD_PRIME - 1n).toString(16) // 큰 값 테스트
const TEST_SK_B = '0x00000000000000000000000000000000000000000000000000000000deadbeef'

describe('ecdhCrypto', () => {
  describe('isECDHEncrypted', () => {
    it('ECDH 형식 데이터를 올바르게 식별', () => {
      // 94바이트 이상 + 0x01 시작 = ECDH
      const fakeEcdh = '0x01' + 'aa'.repeat(93) // 1 + 93 = 94 bytes
      expect(isECDHEncrypted(fakeEcdh)).toBe(true)
    })

    it('레거시 RLP 데이터를 ECDH가 아닌 것으로 식별', () => {
      // RLP은 0xc0-0xff로 시작
      const fakeRlp = '0xc8' + 'bb'.repeat(100)
      expect(isECDHEncrypted(fakeRlp)).toBe(false)
    })

    it('너무 짧은 데이터는 ECDH가 아님', () => {
      expect(isECDHEncrypted('0x01aabb')).toBe(false)
      expect(isECDHEncrypted('0x')).toBe(false)
      expect(isECDHEncrypted('0x01')).toBe(false)
    })

    it('0x01이 아닌 버전 바이트는 ECDH가 아님', () => {
      const fakeData = '0x02' + 'aa'.repeat(93)
      expect(isECDHEncrypted(fakeData)).toBe(false)
    })

    it('0x 접두사 없이도 동작', () => {
      const noPrefix = '01' + 'aa'.repeat(93)
      expect(isECDHEncrypted(noPrefix)).toBe(true)
    })
  })

  describe('encrypt → decrypt 라운드트립', () => {
    it('기본 라운드트립: 암호화 후 올바른 키로 복호화', async () => {
      const pk = await derivePublicKey(TEST_SK_A)
      const plaintext = new TextEncoder().encode('hello babyjubjub ecdh')

      const encrypted = await encryptForRecipient(plaintext, pk)
      expect(encrypted.startsWith('0x01')).toBe(true)
      expect(isECDHEncrypted(encrypted)).toBe(true)

      const decrypted = await decryptWithSecretKey(encrypted, TEST_SK_A)
      expect(decrypted).not.toBeNull()
      expect(new TextDecoder().decode(decrypted!)).toBe('hello babyjubjub ecdh')
    })

    it('빈 평문 암호화 시 최소 길이 미달로 isECDHEncrypted=false (엣지 케이스)', async () => {
      const pk = await derivePublicKey(TEST_SK_B)
      const plaintext = new Uint8Array(0)

      const encrypted = await encryptForRecipient(plaintext, pk)
      // 빈 평문 → 출력 93바이트 (ct=0, tag=16) → ECDH_MIN_BYTES(94) 미달
      // 실제 노트 데이터는 RLP로 항상 1바이트 이상이므로 실전에서는 발생하지 않음
      expect(isECDHEncrypted(encrypted)).toBe(false)
      expect(encrypted.startsWith('0x01')).toBe(true)
    })

    it('1바이트 평문 암호화/복호화 (최소 유효 크기)', async () => {
      const pk = await derivePublicKey(TEST_SK_B)
      const plaintext = new Uint8Array([0x42])

      const encrypted = await encryptForRecipient(plaintext, pk)
      expect(isECDHEncrypted(encrypted)).toBe(true)

      const decrypted = await decryptWithSecretKey(encrypted, TEST_SK_B)
      expect(decrypted).not.toBeNull()
      expect(decrypted!.length).toBe(1)
      expect(decrypted![0]).toBe(0x42)
    })

    it('큰 평문 (1KB) 라운드트립', async () => {
      const pk = await derivePublicKey(TEST_SK_A)
      const plaintext = new Uint8Array(1024)
      crypto.getRandomValues(plaintext)

      const encrypted = await encryptForRecipient(plaintext, pk)
      const decrypted = await decryptWithSecretKey(encrypted, TEST_SK_A)

      expect(decrypted).not.toBeNull()
      expect(bytesToHex(decrypted!)).toBe(bytesToHex(plaintext))
    })

    it('RLP 인코딩된 노트 데이터 라운드트립', async () => {
      const pk = await derivePublicKey(TEST_SK_A)

      // 실제 노트 필드를 모방한 바이너리 데이터
      const noteFields = hexToBytes(
        'c88a0102030405060708091011' + // RLP-encoded fields (dummy)
        'deadbeef'
      )

      const encrypted = await encryptForRecipient(noteFields, pk)
      const decrypted = await decryptWithSecretKey(encrypted, TEST_SK_A)

      expect(decrypted).not.toBeNull()
      expect(bytesToHex(decrypted!)).toBe(bytesToHex(noteFields))
    })
  })

  describe('복호화 실패 케이스', () => {
    it('잘못된 키로 복호화 시 null 반환', async () => {
      const pkA = await derivePublicKey(TEST_SK_A)
      const plaintext = new TextEncoder().encode('secret data')

      const encrypted = await encryptForRecipient(plaintext, pkA)

      // 다른 키로 복호화 시도
      const decrypted = await decryptWithSecretKey(encrypted, TEST_SK_B)
      expect(decrypted).toBeNull()
    })

    it('손상된 암호문으로 복호화 시 null 반환', async () => {
      const pkA = await derivePublicKey(TEST_SK_A)
      const plaintext = new TextEncoder().encode('secret data')

      const encrypted = await encryptForRecipient(plaintext, pkA)

      // 암호문 마지막 바이트 변조
      const corruptedHex = encrypted.slice(0, -2) + 'ff'
      const decrypted = await decryptWithSecretKey(corruptedHex, TEST_SK_A)
      expect(decrypted).toBeNull()
    })

    it('너무 짧은 데이터로 복호화 시 null 반환', async () => {
      const decrypted = await decryptWithSecretKey('0x01aabbcc', TEST_SK_A)
      expect(decrypted).toBeNull()
    })

    it('잘못된 버전 바이트로 복호화 시 null 반환', async () => {
      const fakeData = '0x02' + '00'.repeat(100)
      const decrypted = await decryptWithSecretKey(fakeData, TEST_SK_A)
      expect(decrypted).toBeNull()
    })
  })

  describe('출력 형식 검증', () => {
    it('암호화 출력이 올바른 구조 (0x01 || epk_x || epk_y || nonce || ct+tag)', async () => {
      const pk = await derivePublicKey(TEST_SK_A)
      const plaintext = new TextEncoder().encode('test')

      const encrypted = await encryptForRecipient(plaintext, pk)

      // hex string: 0x 접두사 + version(2) + epk_x(64) + epk_y(64) + nonce(24) + ct+tag
      expect(encrypted.startsWith('0x01')).toBe(true)

      const raw = hexToBytes(encrypted.slice(2))

      // 최소 크기: 1 + 32 + 32 + 12 + plaintext.length + 16
      const expectedMin = 1 + 32 + 32 + 12 + plaintext.length + 16
      expect(raw.length).toBe(expectedMin)

      // 버전 바이트
      expect(raw[0]).toBe(0x01)
    })

    it('동일 평문에 대해 매번 다른 암호문 생성 (임시 키 때문)', async () => {
      const pk = await derivePublicKey(TEST_SK_A)
      const plaintext = new TextEncoder().encode('determinism test')

      const enc1 = await encryptForRecipient(plaintext, pk)
      const enc2 = await encryptForRecipient(plaintext, pk)

      // 임시 키와 nonce가 매번 랜덤이므로 결과가 달라야 함
      expect(enc1).not.toBe(enc2)

      // 둘 다 복호화 가능
      const dec1 = await decryptWithSecretKey(enc1, TEST_SK_A)
      const dec2 = await decryptWithSecretKey(enc2, TEST_SK_A)
      expect(new TextDecoder().decode(dec1!)).toBe('determinism test')
      expect(new TextDecoder().decode(dec2!)).toBe('determinism test')
    })
  })

  describe('교차 키쌍 격리', () => {
    it('A의 pk로 암호화한 데이터는 A의 sk로만 복호화 가능', async () => {
      const pkA = await derivePublicKey(TEST_SK_A)
      const pkB = await derivePublicKey(TEST_SK_B)
      const plaintext = new TextEncoder().encode('only for A')

      const encryptedForA = await encryptForRecipient(plaintext, pkA)
      const encryptedForB = await encryptForRecipient(plaintext, pkB)

      // A의 암호문은 A만 복호화 가능
      expect(await decryptWithSecretKey(encryptedForA, TEST_SK_A)).not.toBeNull()
      expect(await decryptWithSecretKey(encryptedForA, TEST_SK_B)).toBeNull()

      // B의 암호문은 B만 복호화 가능
      expect(await decryptWithSecretKey(encryptedForB, TEST_SK_B)).not.toBeNull()
      expect(await decryptWithSecretKey(encryptedForB, TEST_SK_A)).toBeNull()
    })
  })
})
