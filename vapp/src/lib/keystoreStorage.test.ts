/**
 * keystoreStorage 단위 테스트
 *
 * 테스트 항목:
 * - saveKeystore + getKeystore CRUD
 * - getAllAccounts
 * - getAccountAddresses
 * - deleteKeystore
 * - updateAccountLabel
 * - hasAccount
 * - clearAllAccounts
 * - exportAccount + importAccount
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveKeystore,
  getKeystore,
  getAccount,
  getAllAccounts,
  getAccountAddresses,
  deleteKeystore,
  updateAccountLabel,
  hasAccount,
  clearAllAccounts,
  exportAccount,
  importAccount
} from './keystoreStorage'
import type { Keystore } from './accountCrypto'
import {
  ALICE_PK, BOB_PK, CAROL_PK,
  ALICE_ADDRESS, BOB_ADDRESS, CAROL_ADDRESS,
  MOCK_KEYSTORE,
} from '@/test-utils/fixtures'

function createKeystore(): Keystore {
  return {
    crypto: {
      ...MOCK_KEYSTORE.crypto,
      cipherparams: { ...MOCK_KEYSTORE.crypto.cipherparams },
      kdfparams: { ...MOCK_KEYSTORE.crypto.kdfparams },
    },
    version: MOCK_KEYSTORE.version,
  }
}

describe('keystoreStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('saveKeystore + getKeystore', () => {
    it('저장 → 조회 성공', () => {
      saveKeystore(ALICE_ADDRESS, ALICE_PK, createKeystore())
      const ks = getKeystore(ALICE_ADDRESS)
      expect(ks).not.toBeNull()
      expect(ks!.version).toBe(1)
      expect(ks!.crypto.cipher).toBe('aes-256-gcm')
    })

    it('존재하지 않는 주소 조회 시 null', () => {
      expect(getKeystore('nonexistent')).toBeNull()
    })

    it('동일 주소로 재저장하면 덮어쓰기', () => {
      saveKeystore(ALICE_ADDRESS, ALICE_PK, createKeystore())

      const updatedKs = createKeystore()
      updatedKs.crypto.ciphertext = 'ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff'
      saveKeystore(ALICE_ADDRESS, ALICE_PK, updatedKs)

      const accounts = getAllAccounts()
      expect(accounts.length).toBe(1)
      expect(accounts[0].keystore.crypto.ciphertext).toBe('ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff00ff')
    })

    it('label과 함께 저장', () => {
      saveKeystore(ALICE_ADDRESS, ALICE_PK, createKeystore(), 'My Wallet')
      const account = getAccount(ALICE_ADDRESS)
      expect(account!.label).toBe('My Wallet')
    })
  })

  describe('getAccount', () => {
    it('전체 계정 데이터 반환', () => {
      saveKeystore(ALICE_ADDRESS, ALICE_PK, createKeystore(), 'Test')
      const account = getAccount(ALICE_ADDRESS)

      expect(account).not.toBeNull()
      expect(account!.address).toBe(ALICE_ADDRESS)
      expect(account!.publicKey).toEqual(ALICE_PK)
      expect(account!.label).toBe('Test')
      expect(account!.createdAt).toBeGreaterThan(0)
    })

    it('존재하지 않는 주소 → null', () => {
      expect(getAccount('nonexistent')).toBeNull()
    })
  })

  describe('getAllAccounts', () => {
    it('빈 상태에서 빈 배열', () => {
      expect(getAllAccounts()).toEqual([])
    })

    it('여러 계정 반환', () => {
      saveKeystore(ALICE_ADDRESS, ALICE_PK, createKeystore())
      saveKeystore(BOB_ADDRESS, BOB_PK, createKeystore())
      saveKeystore(CAROL_ADDRESS, CAROL_PK, createKeystore())

      expect(getAllAccounts().length).toBe(3)
    })

    it('잘못된 JSON 저장되어 있을 때 빈 배열', () => {
      localStorage.setItem('zkdex_accounts', 'invalid json')
      expect(getAllAccounts()).toEqual([])
    })
  })

  describe('getAccountAddresses', () => {
    it('주소 목록만 반환', () => {
      saveKeystore(ALICE_ADDRESS, ALICE_PK, createKeystore())
      saveKeystore(BOB_ADDRESS, BOB_PK, createKeystore())

      const addresses = getAccountAddresses()
      expect(addresses).toEqual([ALICE_ADDRESS, BOB_ADDRESS])
    })
  })

  describe('deleteKeystore', () => {
    it('존재하는 계정 삭제 → true', () => {
      saveKeystore(ALICE_ADDRESS, ALICE_PK, createKeystore())
      expect(deleteKeystore(ALICE_ADDRESS)).toBe(true)
      expect(getAccount(ALICE_ADDRESS)).toBeNull()
    })

    it('존재하지 않는 계정 삭제 → false', () => {
      expect(deleteKeystore('nonexistent')).toBe(false)
    })

    it('삭제 후 다른 계정은 유지', () => {
      saveKeystore(ALICE_ADDRESS, ALICE_PK, createKeystore())
      saveKeystore(BOB_ADDRESS, BOB_PK, createKeystore())

      deleteKeystore(ALICE_ADDRESS)

      expect(getAccount(ALICE_ADDRESS)).toBeNull()
      expect(getAccount(BOB_ADDRESS)).not.toBeNull()
    })
  })

  describe('updateAccountLabel', () => {
    it('레이블 업데이트 성공 → true', () => {
      saveKeystore(ALICE_ADDRESS, ALICE_PK, createKeystore())
      expect(updateAccountLabel(ALICE_ADDRESS, 'New Label')).toBe(true)
      expect(getAccount(ALICE_ADDRESS)!.label).toBe('New Label')
    })

    it('존재하지 않는 주소 → false', () => {
      expect(updateAccountLabel('nonexistent', 'Label')).toBe(false)
    })
  })

  describe('hasAccount', () => {
    it('존재하는 계정 → true', () => {
      saveKeystore(ALICE_ADDRESS, ALICE_PK, createKeystore())
      expect(hasAccount(ALICE_ADDRESS)).toBe(true)
    })

    it('존재하지 않는 계정 → false', () => {
      expect(hasAccount('nonexistent')).toBe(false)
    })
  })

  describe('clearAllAccounts', () => {
    it('모든 계정 삭제', () => {
      saveKeystore(ALICE_ADDRESS, ALICE_PK, createKeystore())
      saveKeystore(BOB_ADDRESS, BOB_PK, createKeystore())

      clearAllAccounts()

      expect(getAllAccounts()).toEqual([])
    })
  })

  describe('exportAccount', () => {
    it('JSON 문자열 반환', () => {
      saveKeystore(ALICE_ADDRESS, ALICE_PK, createKeystore(), 'Export Test')
      const exported = exportAccount(ALICE_ADDRESS)

      expect(exported).not.toBeNull()
      const parsed = JSON.parse(exported!)
      expect(parsed.address).toBe(ALICE_ADDRESS)
      expect(parsed.publicKey).toEqual(ALICE_PK)
      expect(parsed.label).toBe('Export Test')
      expect(parsed.exportedAt).toBeGreaterThan(0)
    })

    it('존재하지 않는 주소 → null', () => {
      expect(exportAccount('nonexistent')).toBeNull()
    })
  })

  describe('importAccount', () => {
    it('올바른 JSON → 저장 및 반환', () => {
      const data = {
        address: ALICE_ADDRESS,
        publicKey: ALICE_PK,
        keystore: createKeystore(),
        label: 'Imported'
      }

      const account = importAccount(JSON.stringify(data))
      expect(account.address).toBe(ALICE_ADDRESS)
      expect(account.label).toBe('Imported')
      expect(hasAccount(ALICE_ADDRESS)).toBe(true)
    })

    it('필수 필드 누락 시 에러', () => {
      expect(() => importAccount(JSON.stringify({ address: CAROL_ADDRESS })))
        .toThrow('Invalid account data')
    })

    it('잘못된 keystore 형식 시 에러', () => {
      expect(() => importAccount(JSON.stringify({
        address: CAROL_ADDRESS,
        publicKey: CAROL_PK,
        keystore: { noVersion: true }
      }))).toThrow('Invalid keystore format')
    })

    it('잘못된 JSON 시 에러', () => {
      expect(() => importAccount('not json')).toThrow()
    })
  })
})
