/**
 * accountCrypto 단위 테스트
 *
 * 테스트 항목:
 * - bytesToHex / hexToBytes 유틸리티
 * - BN128_FIELD_PRIME 상수
 * - derivePublicKey 결정성 및 다른 키 → 다른 pk
 * - deriveAddress 결정성
 * - createAccount + unlockAccount 라운드트립
 * - unlockAccount 잘못된 패스프레이즈 실패
 */

import { describe, it, expect } from 'vitest'
import {
  bytesToHex,
  hexToBytes,
  BN128_FIELD_PRIME,
  derivePublicKey,
  deriveAddress,
  createAccount,
  unlockAccount,
  initCrypto,
  type BabyJubJubPublicKey
} from './accountCrypto'

const TEST_SK = '0x00000000000000000000000000000000000000000000000000000000cafebabe'
const TEST_SK2 = '0x00000000000000000000000000000000000000000000000000000000deadbeef'

describe('accountCrypto', () => {
  describe('bytesToHex / hexToBytes', () => {
    it('빈 배열 ↔ 빈 문자열', () => {
      expect(bytesToHex(new Uint8Array([]))).toBe('')
      expect(hexToBytes('')).toEqual(new Uint8Array([]))
    })

    it('단일 바이트 라운드트립', () => {
      const bytes = new Uint8Array([0x00, 0xff, 0xab])
      const hex = bytesToHex(bytes)
      expect(hex).toBe('00ffab')
      expect(hexToBytes(hex)).toEqual(bytes)
    })

    it('32바이트 라운드트립', () => {
      const bytes = new Uint8Array(32)
      for (let i = 0; i < 32; i++) bytes[i] = i
      const hex = bytesToHex(bytes)
      expect(hex.length).toBe(64)
      expect(hexToBytes(hex)).toEqual(bytes)
    })

    it('0x 접두사 처리', () => {
      expect(hexToBytes('0xabcd')).toEqual(new Uint8Array([0xab, 0xcd]))
      expect(hexToBytes('abcd')).toEqual(new Uint8Array([0xab, 0xcd]))
    })
  })

  describe('BN128_FIELD_PRIME', () => {
    it('올바른 소수 값', () => {
      expect(BN128_FIELD_PRIME).toBe(
        BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617')
      )
    })

    it('254비트 이내', () => {
      expect(BN128_FIELD_PRIME < (1n << 254n)).toBe(true)
      expect(BN128_FIELD_PRIME > (1n << 253n)).toBe(true)
    })
  })

  describe('derivePublicKey', () => {
    it('동일 sk → 동일 pk (결정적)', async () => {
      const pk1 = await derivePublicKey(TEST_SK)
      const pk2 = await derivePublicKey(TEST_SK)
      expect(pk1.x).toBe(pk2.x)
      expect(pk1.y).toBe(pk2.y)
    })

    it('다른 sk → 다른 pk', async () => {
      const pk1 = await derivePublicKey(TEST_SK)
      const pk2 = await derivePublicKey(TEST_SK2)
      expect(pk1.x).not.toBe(pk2.x)
    })

    it('pk 좌표가 0x 접두 64자 hex 문자열', async () => {
      const pk = await derivePublicKey(TEST_SK)
      expect(pk.x.startsWith('0x')).toBe(true)
      expect(pk.y.startsWith('0x')).toBe(true)
      expect(pk.x.length).toBe(66) // 0x + 64
      expect(pk.y.length).toBe(66)
    })

    it('sk >= BN128_FIELD_PRIME 일 때 mod 연산 적용', async () => {
      const largeSk = '0x' + (BN128_FIELD_PRIME + 1n).toString(16).padStart(64, '0')
      const pkLarge = await derivePublicKey(largeSk)

      // sk mod p == 1 이므로, sk=1일때와 같아야 함
      const pk1 = await derivePublicKey('0x' + (1n).toString(16).padStart(64, '0'))
      // Field reduction: (BN128_FIELD_PRIME + 1) mod BN128_FIELD_PRIME == 1
      expect(BigInt(pkLarge.x)).toBe(BigInt(pk1.x))
      expect(BigInt(pkLarge.y)).toBe(BigInt(pk1.y))
    })
  })

  describe('deriveAddress', () => {
    it('동일 pk → 동일 주소 (결정적)', async () => {
      const pk = await derivePublicKey(TEST_SK)
      const addr1 = await deriveAddress(pk)
      const addr2 = await deriveAddress(pk)
      expect(addr1).toBe(addr2)
    })

    it('주소 형식: 0x + 40 hex', async () => {
      const pk = await derivePublicKey(TEST_SK)
      const addr = await deriveAddress(pk)
      expect(addr.startsWith('0x')).toBe(true)
      expect(addr.length).toBe(42)
    })

    it('다른 pk → 다른 주소', async () => {
      const pk1 = await derivePublicKey(TEST_SK)
      const pk2 = await derivePublicKey(TEST_SK2)
      const addr1 = await deriveAddress(pk1)
      const addr2 = await deriveAddress(pk2)
      expect(addr1).not.toBe(addr2)
    })
  })

  describe('createAccount + unlockAccount', () => {
    it('생성 → 올바른 패스프레이즈로 잠금해제 → 동일 주소', async () => {
      const passphrase = 'test-password-123'
      const created = await createAccount(passphrase)

      expect(created.address).toBeTruthy()
      expect(created.publicKey.x).toBeTruthy()
      expect(created.publicKey.y).toBeTruthy()
      expect(created.keystore).toBeTruthy()
      expect(created.keystore.version).toBe(1)
      expect(created.keystore.crypto.cipher).toBe('aes-256-gcm')

      const unlocked = await unlockAccount(passphrase, created.keystore)
      // createAccount returns address without 0x prefix
      expect(unlocked.address).toBe('0x' + created.address)
      expect(unlocked.publicKey.x).toBe(created.publicKey.x)
      expect(unlocked.publicKey.y).toBe(created.publicKey.y)
    })

    it('잘못된 패스프레이즈로 잠금해제 실패', async () => {
      const created = await createAccount('correct-pass')

      await expect(unlockAccount('wrong-pass', created.keystore))
        .rejects.toThrow('Failed to decrypt')
    })

    it('keystore 구조가 올바름', async () => {
      const created = await createAccount('pw')
      const ks = created.keystore

      expect(ks.crypto.kdf).toBe('scrypt')
      expect(ks.crypto.kdfparams.n).toBe(16384)
      expect(ks.crypto.kdfparams.r).toBe(8)
      expect(ks.crypto.kdfparams.p).toBe(1)
      expect(ks.crypto.kdfparams.dklen).toBe(32)
      expect(ks.crypto.kdfparams.salt).toBeTruthy()
      expect(ks.crypto.cipherparams.iv).toBeTruthy()
      expect(ks.crypto.mac).toBeTruthy()
    })
  })

  describe('initCrypto', () => {
    it('여러 번 호출해도 에러 없음', async () => {
      await initCrypto()
      await initCrypto()
      // 에러 없이 완료되면 성공
    })
  })
})
