/**
 * stores/web3 단위 테스트
 *
 * window.ethereum을 모킹하여 Web3 스토어를 테스트.
 *
 * 테스트 항목:
 * - 초기 상태
 * - connect: MetaMask 없으면 에러
 * - connect: 성공 시 상태 설정
 * - disconnect: 상태 초기화
 * - isConnected computed
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// vi.hoisted로 모킹 객체를 호이스팅 전에 생성
const { mockProvider, mockSigner, ETH_SIGNER_ADDR, ETH_ACCOUNT_ADDR } = vi.hoisted(() => {
  const ETH_SIGNER_ADDR = '0x5b38da6a701c568545dcfcb03fcb875f56beddc4'
  const ETH_ACCOUNT_ADDR = '0xd8a3f85aa09feebc667f6f612ed6b434322f9ffe'
  const mockSigner = { address: ETH_SIGNER_ADDR }
  const mockProvider = {
    send: vi.fn().mockResolvedValue([ETH_ACCOUNT_ADDR]),
    getSigner: vi.fn().mockResolvedValue(mockSigner),
    getNetwork: vi.fn().mockResolvedValue({ chainId: 1337n }),
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
  }
  return { mockProvider, mockSigner, ETH_SIGNER_ADDR, ETH_ACCOUNT_ADDR }
})

vi.mock('ethers', () => ({
  BrowserProvider: function BrowserProvider() {
    return mockProvider
  },
  JsonRpcSigner: function JsonRpcSigner() {
    return mockSigner
  },
}))

import { useWeb3Store } from './web3'

describe('stores/web3', () => {
  let store: ReturnType<typeof useWeb3Store>

  beforeEach(() => {
    vi.clearAllMocks()
    mockProvider.send.mockResolvedValue([ETH_ACCOUNT_ADDR])
    mockProvider.getSigner.mockResolvedValue(mockSigner)
    mockProvider.getNetwork.mockResolvedValue({ chainId: 1337n })
    mockProvider.getBalance.mockResolvedValue(1000000000000000000n)

    // MetaMask 모킹
    Object.defineProperty(globalThis, 'window', {
      value: {
        ...globalThis.window,
        ethereum: {
          request: vi.fn(),
          on: vi.fn(),
          removeListener: vi.fn(),
        }
      },
      writable: true,
    })

    setActivePinia(createPinia())
    store = useWeb3Store()
  })

  describe('초기 상태', () => {
    it('isListening = false', () => expect(store.isListening).toBe(false))
    it('provider = null', () => expect(store.provider).toBeNull())
    it('signer = null', () => expect(store.signer).toBeNull())
    it('networkId = null', () => expect(store.networkId).toBeNull())
    it('account = ""', () => expect(store.account).toBe(''))
    it('balance = null', () => expect(store.balance).toBeNull())
    it('error = null', () => expect(store.error).toBeNull())
    it('isConnected = false', () => expect(store.isConnected).toBe(false))
  })

  describe('connect', () => {
    it('MetaMask 없으면 에러 설정', async () => {
      Object.defineProperty(globalThis, 'window', {
        value: { ...globalThis.window, ethereum: undefined },
        writable: true,
      })

      const result = await store.connect()
      expect(result).toBe(false)
      expect(store.error).toBe('MetaMask is not installed')
    })

    it('MetaMask 있으면 연결 성공', async () => {
      const result = await store.connect()
      expect(result).toBe(true)
      expect(store.isListening).toBe(true)
      expect(store.account).toBe(ETH_ACCOUNT_ADDR)
      expect(store.networkId).toBe(1337n)
      expect(store.balance).toBe(1000000000000000000n)
      expect(store.isConnected).toBe(true)
      expect(store.error).toBeNull()
    })

    it('계정 없으면 false', async () => {
      mockProvider.send.mockResolvedValueOnce([])

      const result = await store.connect()
      expect(result).toBe(false)
      expect(store.error).toBe('No accounts found')
    })
  })

  describe('disconnect', () => {
    it('모든 상태 초기화', async () => {
      await store.connect()
      store.disconnect()

      expect(store.isListening).toBe(false)
      expect(store.provider).toBeNull()
      expect(store.signer).toBeNull()
      expect(store.networkId).toBeNull()
      expect(store.account).toBe('')
      expect(store.balance).toBeNull()
      expect(store.error).toBeNull()
      expect(store.isConnected).toBe(false)
    })
  })

  describe('updateBalance', () => {
    it('provider가 있으면 잔액 업데이트', async () => {
      await store.connect()
      mockProvider.getBalance.mockResolvedValueOnce(2000000000000000000n)
      await store.updateBalance()
      expect(store.balance).toBe(2000000000000000000n)
    })

    it('provider가 없으면 아무것도 안 함', async () => {
      await store.updateBalance()
      expect(store.balance).toBeNull()
    })
  })
})
