/**
 * stores/account 단위 테스트
 *
 * @pinia/testing으로 Pinia 스토어를 모킹하여 테스트.
 *
 * 테스트 항목:
 * - 초기 상태
 * - 기본 setter: setKey, setViewingKey, setSecretKey, setAccounts, setPath
 * - computed: isLoggedIn, accountCount
 * - addAccount / deleteAccount
 * - createAccountLocal (crypto 모킹)
 * - unlockAccountLocal (keystore + crypto 모킹)
 * - lockAccount
 * - loadAccounts (localStorage → 스토어)
 * - reset
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAccountStore } from './account'

// vi.hoisted로 vi.mock 팩토리 내부에서 사용할 픽스처 값 선언
const { F_ALICE_ADDRESS, F_ALICE_PK, F_ALICE_SK, F_BOB_PK, F_BOB_ADDRESS, F_CAROL_ADDRESS, F_CAROL_PK, F_MOCK_KEYSTORE } = vi.hoisted(() => ({
  F_ALICE_ADDRESS: '9afb6f44f6861a2c04f602dc7dbfcf6ade13769d',
  F_ALICE_PK: { x: '0x2b52e1908bed7b1f474026b72e1c887e2c2462cf33b20b5b562e8bc096ee7083', y: '0x14f9761fff9429e5e33dc8b4b43627276fab15d753d758a24b51f1e75ec10a95' },
  F_ALICE_SK: '0x00000000000000000000000000000000000000000000000000000000cafebabe',
  F_BOB_ADDRESS: 'c5c4c225e28b780ad8fd9662c128ae70011d809a',
  F_BOB_PK: { x: '0x112737c85d9a368849edcecb5d24f7a953578d5b87065c1f18c93552399b89b6', y: '0x261700c8d02a9e653c79c75db1881c8514e9439d69689b727f022e33ddb46dd2' },
  F_CAROL_ADDRESS: '20cc3261e99b3a5d7c58d46ebc947f5341633f59',
  F_CAROL_PK: { x: '0x2e7c71efb0873da43935fb72259feefdafb6c56aeefc9e15558fbfb8376b205e', y: '0x120e9546e5eee779fc4b44c15ad586374da0063cdce38e029b4ef1c56e7458d6' },
  F_MOCK_KEYSTORE: {
    crypto: {
      cipher: 'aes-256-gcm',
      ciphertext: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      cipherparams: { iv: 'deadbeefcafebabe0123456789abcdef' },
      kdf: 'scrypt',
      kdfparams: { n: 16384, r: 8, p: 1, dklen: 32, salt: 'cafebabe12345678deadbeef90abcdef0011223344556677889900aabbccddeeff' },
      mac: '11223344aabbccdd55667788eeff0011'
    },
    version: 1
  },
}))

// 테스트 본문에서 사용할 픽스처 import
import {
  ALICE_ADDRESS, ALICE_PK, ALICE_SK, ALICE_VK,
  BOB_ADDRESS, BOB_PK,
  CAROL_ADDRESS, CAROL_PK,
  MOCK_KEYSTORE,
} from '@/test-utils/fixtures'

// accountCrypto 모킹
vi.mock('@/lib/accountCrypto', () => ({
  initCrypto: vi.fn().mockResolvedValue(undefined),
  createAccount: vi.fn().mockResolvedValue({
    address: F_ALICE_ADDRESS,
    publicKey: F_ALICE_PK,
    keystore: F_MOCK_KEYSTORE
  }),
  unlockAccount: vi.fn().mockResolvedValue({
    secretKey: F_ALICE_SK,
    publicKey: F_ALICE_PK,
    address: '0x' + F_ALICE_ADDRESS
  }),
}))

// keystoreStorage 모킹
vi.mock('@/lib/keystoreStorage', () => ({
  getAllAccounts: vi.fn().mockReturnValue([]),
  saveKeystore: vi.fn(),
  getKeystore: vi.fn().mockReturnValue(F_MOCK_KEYSTORE),
  deleteKeystore: vi.fn(),
  exportAccount: vi.fn().mockReturnValue('{"address":"test"}'),
  importAccount: vi.fn().mockReturnValue({
    address: F_CAROL_ADDRESS,
    publicKey: F_CAROL_PK,
    keystore: F_MOCK_KEYSTORE,
    createdAt: Date.now(),
    label: 'Imported'
  }),
}))

describe('stores/account', () => {
  let store: ReturnType<typeof useAccountStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useAccountStore()
  })

  describe('초기 상태', () => {
    it('key = null', () => expect(store.key).toBeNull())
    it('viewingKey = null', () => expect(store.viewingKey).toBeNull())
    it('secretKey = null', () => expect(store.secretKey).toBeNull())
    it('accounts = []', () => expect(store.accounts).toEqual([]))
    it('currentAccount = null', () => expect(store.currentAccount).toBeNull())
    it('path = "/"', () => expect(store.path).toBe('/'))
    it('isLoggedIn = false', () => expect(store.isLoggedIn).toBe(false))
    it('accountCount = 0', () => expect(store.accountCount).toBe(0))
  })

  describe('기본 setters', () => {
    it('setKey', () => {
      store.setKey(ALICE_VK)
      expect(store.key).toBe(ALICE_VK)
      expect(store.isLoggedIn).toBe(true)
    })

    it('setViewingKey', () => {
      store.setViewingKey(ALICE_VK)
      expect(store.viewingKey).toBe(ALICE_VK)
    })

    it('setSecretKey', () => {
      store.setSecretKey(ALICE_SK)
      expect(store.secretKey).toBe(ALICE_SK)
    })

    it('setPath', () => {
      store.setPath('/notes')
      expect(store.path).toBe('/notes')
    })

    it('setAccounts', () => {
      const accounts = [
        { address: ALICE_ADDRESS, publicKey: ALICE_PK },
        { address: BOB_ADDRESS, publicKey: BOB_PK }
      ]
      store.setAccounts(accounts)
      expect(store.accounts.length).toBe(2)
      expect(store.accountCount).toBe(2)
    })
  })

  describe('addAccount / deleteAccount', () => {
    it('addAccount → 목록에 추가', () => {
      store.addAccount({ address: ALICE_ADDRESS, publicKey: ALICE_PK })
      expect(store.accounts.length).toBe(1)
    })

    it('deleteAccount → 목록에서 제거', () => {
      store.addAccount({ address: ALICE_ADDRESS, publicKey: ALICE_PK })
      store.addAccount({ address: BOB_ADDRESS, publicKey: BOB_PK })
      store.deleteAccount({ address: ALICE_ADDRESS, publicKey: ALICE_PK })
      expect(store.accounts.length).toBe(1)
      expect(store.accounts[0].address).toBe(BOB_ADDRESS)
    })

    it('deleteAccount → 존재하지 않는 주소는 무시', () => {
      store.addAccount({ address: ALICE_ADDRESS, publicKey: ALICE_PK })
      store.deleteAccount({ address: CAROL_ADDRESS, publicKey: CAROL_PK })
      expect(store.accounts.length).toBe(1)
    })
  })

  describe('createAccountLocal', () => {
    it('계정 생성 → 스토어에 추가', async () => {
      const account = await store.createAccountLocal('password', 'Test Wallet')
      expect(account.address).toBe(ALICE_ADDRESS)
      expect(account.publicKey.x).toBeTruthy()
      expect(store.accounts.length).toBe(1)
    })
  })

  describe('unlockAccountLocal', () => {
    it('잠금해제 → secretKey 설정', async () => {
      store.setCurrentAccount({ address: ALICE_ADDRESS, publicKey: ALICE_PK })
      const result = await store.unlockAccountLocal(ALICE_ADDRESS, 'password')
      expect(result.secretKey).toBe(ALICE_SK)
      expect(store.secretKey).toBe(ALICE_SK)
    })

    it('keystore 없는 주소 → 에러', async () => {
      const { getKeystore } = await import('@/lib/keystoreStorage')
      vi.mocked(getKeystore).mockReturnValueOnce(null)

      await expect(store.unlockAccountLocal('unknown', 'pw'))
        .rejects.toThrow('Keystore not found')
    })
  })

  describe('lockAccount', () => {
    it('secretKey 메모리에서 제거', async () => {
      store.setSecretKey(ALICE_SK)
      store.setCurrentAccount({ address: ALICE_ADDRESS, publicKey: ALICE_PK, secretKey: ALICE_SK })

      store.lockAccount()

      expect(store.secretKey).toBeNull()
      expect(store.currentAccount?.secretKey).toBeUndefined()
    })
  })

  describe('loadAccounts', () => {
    it('localStorage에서 유효한 계정 로드', async () => {
      const { getAllAccounts } = await import('@/lib/keystoreStorage')
      vi.mocked(getAllAccounts).mockReturnValue([
        {
          address: ALICE_ADDRESS,
          publicKey: ALICE_PK,
          keystore: MOCK_KEYSTORE as never,
          createdAt: Date.now()
        }
      ])

      store.loadAccounts()
      expect(store.accounts.length).toBe(1)
      expect(store.accounts[0].address).toBe(ALICE_ADDRESS)
    })

    it('publicKey 없는 계정은 필터링', async () => {
      const { getAllAccounts } = await import('@/lib/keystoreStorage')
      vi.mocked(getAllAccounts).mockReturnValue([
        {
          address: ALICE_ADDRESS,
          publicKey: null as never,
          keystore: MOCK_KEYSTORE as never,
          createdAt: Date.now()
        }
      ])

      store.loadAccounts()
      expect(store.accounts.length).toBe(0)
    })
  })

  describe('export / import', () => {
    it('exportAccountJson → JSON 문자열', () => {
      const result = store.exportAccountJson(ALICE_ADDRESS)
      expect(result).toBe('{"address":"test"}')
    })

    it('importAccountJson → 계정 반환', () => {
      const account = store.importAccountJson('{"address":"imported"}')
      expect(account.address).toBe(CAROL_ADDRESS)
    })
  })

  describe('hasKeystore', () => {
    it('keystore 있으면 true', () => {
      expect(store.hasKeystore(ALICE_ADDRESS)).toBe(true)
    })

    it('keystore 없으면 false', async () => {
      const { getKeystore } = await import('@/lib/keystoreStorage')
      vi.mocked(getKeystore).mockReturnValueOnce(null)
      expect(store.hasKeystore('unknown')).toBe(false)
    })
  })

  describe('reset', () => {
    it('모든 상태 초기화', () => {
      store.setKey(ALICE_VK)
      store.setViewingKey(ALICE_VK)
      store.setSecretKey(ALICE_SK)
      store.addAccount({ address: ALICE_ADDRESS, publicKey: ALICE_PK })
      store.setCurrentAccount({ address: ALICE_ADDRESS, publicKey: ALICE_PK })
      store.setPath('/notes')

      store.reset()

      expect(store.key).toBeNull()
      expect(store.viewingKey).toBeNull()
      expect(store.secretKey).toBeNull()
      expect(store.accounts).toEqual([])
      expect(store.currentAccount).toBeNull()
      expect(store.path).toBe('/')
    })
  })
})
