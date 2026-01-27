/**
 * stores/contract 단위 테스트
 *
 * web3 스토어와 contract ABI를 모킹하여 테스트.
 *
 * 테스트 항목:
 * - 초기 상태
 * - isInitialized computed
 * - initContracts: web3 미연결 → false
 * - initContracts: 성공 → Contract 생성
 * - reset
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// vi.hoisted로 mock 상태 관리 및 픽스처 상수
const { mockWeb3, F_ETH_SIGNER, F_DEX_CONTRACT, F_DAI_CONTRACT } = vi.hoisted(() => ({
  F_ETH_SIGNER: '0x5b38da6a701c568545dcfcb03fcb875f56beddc4',
  F_DEX_CONTRACT: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
  F_DAI_CONTRACT: '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0',
  mockWeb3: {
    signer: null as unknown,
    networkId: null as bigint | null,
    provider: null,
    isListening: false,
    account: '',
    balance: null,
    error: null,
    isConnected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    updateBalance: vi.fn(),
  }
}))

// web3 스토어 모킹
vi.mock('./web3', () => ({
  useWeb3Store: () => mockWeb3,
}))

// Contract ABI 파일 모킹
vi.mock('../../../build/contracts/ZkDex.json', () => ({
  default: {
    abi: [{ type: 'function', name: 'mockFn' }],
    networks: {
      '1337': { address: F_DEX_CONTRACT }
    }
  }
}))

vi.mock('../../../build/contracts/MockDai.json', () => ({
  default: {
    abi: [{ type: 'function', name: 'mockDaiFn' }],
    networks: {
      '1337': { address: F_DAI_CONTRACT }
    }
  }
}))

// ethers Contract 모킹 — function 키워드로 정의해야 constructor로 사용 가능
vi.mock('ethers', () => ({
  Contract: function Contract(address: string) {
    return { address, mockContract: true }
  },
}))

import { useContractStore } from './contract'
import { ETH_SIGNER, DEX_CONTRACT, DAI_CONTRACT } from '@/test-utils/fixtures'

describe('stores/contract', () => {
  let store: ReturnType<typeof useContractStore>

  beforeEach(() => {
    mockWeb3.signer = null
    mockWeb3.networkId = null

    setActivePinia(createPinia())
    store = useContractStore()
  })

  describe('초기 상태', () => {
    it('dexContract = null', () => expect(store.dexContract).toBeNull())
    it('daiContract = null', () => expect(store.daiContract).toBeNull())
    it('dexAddress = ""', () => expect(store.dexAddress).toBe(''))
    it('daiAddress = ""', () => expect(store.daiAddress).toBe(''))
    it('isInitialized = false', () => expect(store.isInitialized).toBe(false))
  })

  describe('initContracts', () => {
    it('web3 미연결 → false', async () => {
      const result = await store.initContracts()
      expect(result).toBe(false)
      expect(store.isInitialized).toBe(false)
    })

    it('web3 연결됨 → Contract 생성', async () => {
      mockWeb3.signer = { address: ETH_SIGNER }
      mockWeb3.networkId = 1337n

      const result = await store.initContracts()
      expect(result).toBe(true)
      expect(store.dexAddress).toBe(DEX_CONTRACT)
      expect(store.daiAddress).toBe(DAI_CONTRACT)
      expect(store.isInitialized).toBe(true)
    })

    it('네트워크 불일치 → 다른 네트워크 자동 탐색', async () => {
      mockWeb3.signer = { address: ETH_SIGNER }
      mockWeb3.networkId = 9999n // 일치하지 않는 네트워크

      const result = await store.initContracts()
      // 1337 네트워크가 양쪽 모두 존재하므로 폴백
      expect(result).toBe(true)
      expect(store.dexAddress).toBe(DEX_CONTRACT)
    })
  })

  describe('reset', () => {
    it('모든 상태 초기화', async () => {
      mockWeb3.signer = { address: ETH_SIGNER }
      mockWeb3.networkId = 1337n
      await store.initContracts()

      store.reset()

      expect(store.dexContract).toBeNull()
      expect(store.daiContract).toBeNull()
      expect(store.dexAddress).toBe('')
      expect(store.daiAddress).toBe('')
      expect(store.isInitialized).toBe(false)
    })
  })
})
