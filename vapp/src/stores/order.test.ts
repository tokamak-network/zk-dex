/**
 * stores/order 단위 테스트
 *
 * Pinia 스토어를 실제 픽스처 데이터로 테스트.
 *
 * 테스트 항목:
 * - 초기 상태
 * - setters: setOrders, addOrder, setOrderHistory, etc.
 * - computed: orderList, ongoingOrderHistory, completedOrderHistory
 * - notesFilteredByOrderType
 * - reset
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useOrderStore, type Order, type OrderHistory } from './order'
import {
  ALICE_ADDRESS,
  NOTE_ALICE_ETH_VALID, NOTE_ALICE_DAI_VALID, NOTE_ALICE_ETH_SPENT,
  NOTE_ALICE_DAI_VALID_2,
  NOTE_BOB_ETH_VALID,
  ORDER_1, ORDER_2, ORDER_3_TAKEN,
  ORDER_HISTORY_ONGOING, ORDER_HISTORY_TAKEN, ORDER_HISTORY_COMPLETED,
} from '@/test-utils/fixtures'

// vi.mock은 호이스팅되므로 vi.hoisted()로 픽스처 데이터를 준비
const { mockNotes } = vi.hoisted(() => ({
  mockNotes: [
    { hash: '0x102002aa79aa2b97fcf5a86a191984577783a74a858ba629a8a83dacd5a75535', token: '0x0', state: '0x1', owner: '9afb6f44f6861a2c04f602dc7dbfcf6ade13769d' },   // ETH VALID (Alice)
    { hash: '0x0dd698bf355e0e65eb84c04c53afb9d18db55f890c0b747e3d6896c2f2185019', token: '0x1', state: '0x1', owner: '9afb6f44f6861a2c04f602dc7dbfcf6ade13769d' },   // DAI VALID (Alice)
    { hash: '0x29d21ebef184b3c605ab4e772ecae727d42f5c8f8755fe61a4d33244a9768be9', token: '0x0', state: '0x3', owner: '9afb6f44f6861a2c04f602dc7dbfcf6ade13769d' },   // ETH SPENT (Alice)
    { hash: '0x1d74cc7256d28aefc21de1baa791afd18c30b753575eabf2fb9229cc3b299b0e', token: '0x1', state: '0x1', owner: '9afb6f44f6861a2c04f602dc7dbfcf6ade13769d' },   // DAI VALID (Alice)
  ]
}))

// 의존 스토어 모킹
vi.mock('./account', () => ({
  useAccountStore: () => ({
    key: '0x129385bea09db06851bac1249afb6f44f6861a2c04f602dc7dbfcf6ade13769d',
    accounts: [],
  })
}))

vi.mock('./note', () => ({
  useNoteStore: () => ({
    notes: mockNotes,
  })
}))

vi.mock('@/api', () => ({
  getOrders: vi.fn().mockResolvedValue([]),
  getOrderHistory: vi.fn().mockResolvedValue([]),
}))

function createOrder(overrides?: Partial<Order>): Order {
  return {
    hash: NOTE_ALICE_ETH_VALID.hashHex,
    maker: ALICE_ADDRESS,
    price: '100',
    sourceToken: '0x0',
    targetToken: '0x1',
    sourceAmount: '1000000000000000000',
    targetAmount: '100000000000000000000',
    state: '0x0',
    ...overrides,
  }
}

function createHistory(overrides?: Partial<OrderHistory>): OrderHistory {
  return {
    orderId: NOTE_ALICE_ETH_VALID.hashHex,
    type: '0x0',
    state: '0',
    price: '100',
    makerNote: NOTE_ALICE_ETH_VALID.hashHex,
    makerNoteAmount: '1000000000000000000',
    ...overrides,
  }
}

describe('stores/order', () => {
  let store: ReturnType<typeof useOrderStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useOrderStore()
  })

  describe('초기 상태', () => {
    it('orders = []', () => expect(store.orders).toEqual([]))
    it('orderHistory = []', () => expect(store.orderHistory).toEqual([]))
    it('selectedOrder = null', () => expect(store.selectedOrder).toBeNull())
    it('daiAmount = "0"', () => expect(store.daiAmount).toBe('0'))
    it('doYouWantToBuyOrSell = "buy"', () => expect(store.doYouWantToBuyOrSell).toBe('buy'))
    it('doYouWantToMakeOrTake = "make"', () => expect(store.doYouWantToMakeOrTake).toBe('make'))
  })

  describe('setOrders / addOrder', () => {
    it('setOrders', () => {
      store.setOrders([createOrder(), createOrder({ hash: NOTE_ALICE_DAI_VALID.hashHex })])
      expect(store.orders.length).toBe(2)
    })

    it('addOrder', () => {
      store.addOrder(createOrder({ hash: NOTE_BOB_ETH_VALID.hashHex }))
      expect(store.orders.length).toBe(1)
      expect(store.orders[0].hash).toBe(NOTE_BOB_ETH_VALID.hashHex)
    })
  })

  describe('setOrderHistory / addOrderHistory', () => {
    it('setOrderHistory', () => {
      store.setOrderHistory([createHistory()])
      expect(store.orderHistory.length).toBe(1)
    })

    it('addOrderHistory', () => {
      store.addOrderHistory(createHistory({ orderId: NOTE_BOB_ETH_VALID.hashHex }))
      expect(store.orderHistory.length).toBe(1)
      expect(store.orderHistory[0].orderId).toBe(NOTE_BOB_ETH_VALID.hashHex)
    })
  })

  describe('setSelectedOrder / setDaiAmount', () => {
    it('setSelectedOrder', () => {
      const order = createOrder()
      store.setSelectedOrder(order)
      expect(store.selectedOrder).toEqual(order)
    })

    it('setDaiAmount', () => {
      store.setDaiAmount('500')
      expect(store.daiAmount).toBe('500')
    })
  })

  describe('selectBuyOrSell / selectMakeOrTake', () => {
    it('selectBuyOrSell', () => {
      store.selectBuyOrSell('sell')
      expect(store.doYouWantToBuyOrSell).toBe('sell')
    })

    it('selectMakeOrTake', () => {
      store.selectMakeOrTake('take')
      expect(store.doYouWantToMakeOrTake).toBe('take')
    })
  })

  describe('computed: orderList', () => {
    it('CREATED 상태 주문만 가격별 카운트', () => {
      store.setOrders([
        createOrder({ hash: NOTE_ALICE_ETH_VALID.hashHex, price: '100', state: '0x0' }),
        createOrder({ hash: NOTE_ALICE_DAI_VALID.hashHex, price: '100', state: '0x0' }),
        createOrder({ hash: NOTE_BOB_ETH_VALID.hashHex, price: '200', state: '0x0' }),
        createOrder({ hash: NOTE_ALICE_ETH_SPENT.hashHex, price: '100', state: '0x1' }), // TAKEN -> 제외
      ])
      expect(store.orderList['100']).toBe(2)
      expect(store.orderList['200']).toBe(1)
      expect(store.orderList['100']).not.toBe(3) // TAKEN 제외 확인
    })
  })

  describe('computed: ongoingOrderHistory', () => {
    it('state <= 1 인 히스토리만 필터', () => {
      store.setOrderHistory([
        createHistory({ state: '0' }),   // ongoing
        createHistory({ state: '1' }),   // ongoing
        createHistory({ state: '2' }),   // completed
      ])
      expect(store.ongoingOrderHistory.length).toBe(2)
    })
  })

  describe('computed: completedOrderHistory', () => {
    it('state > 1 인 히스토리만 필터', () => {
      store.setOrderHistory([
        createHistory({ state: '0' }),
        createHistory({ state: '2' }),
        createHistory({ state: '3' }),
      ])
      expect(store.completedOrderHistory.length).toBe(2)
    })
  })

  describe('computed: notesFilteredByOrderType', () => {
    it('buy + make -> DAI VALID 노트', () => {
      store.selectBuyOrSell('buy')
      store.selectMakeOrTake('make')
      // DAI(0x1) + VALID(0x1) = 0x2, 0x4
      expect(store.notesFilteredByOrderType.length).toBe(2)
    })

    it('buy + take -> ETH VALID 노트', () => {
      store.selectBuyOrSell('buy')
      store.selectMakeOrTake('take')
      // ETH(0x0) + VALID(0x1) = 0x1
      expect(store.notesFilteredByOrderType.length).toBe(1)
    })

    it('sell + make -> ETH VALID 노트', () => {
      store.selectBuyOrSell('sell')
      store.selectMakeOrTake('make')
      // ETH(0x0) + VALID(0x1) = 0x1
      expect(store.notesFilteredByOrderType.length).toBe(1)
    })

    it('sell + take -> DAI VALID 노트', () => {
      store.selectBuyOrSell('sell')
      store.selectMakeOrTake('take')
      // DAI(0x1) + VALID(0x1) = 0x2, 0x4
      expect(store.notesFilteredByOrderType.length).toBe(2)
    })
  })

  describe('loadOrders', () => {
    it('API 호출 -> orders 설정', async () => {
      const { getOrders } = await import('@/api')
      vi.mocked(getOrders).mockResolvedValueOnce([createOrder()])
      await store.loadOrders()
      expect(store.orders.length).toBe(1)
    })

    it('API 에러 -> 빈 배열 유지', async () => {
      const { getOrders } = await import('@/api')
      vi.mocked(getOrders).mockRejectedValueOnce(new Error('fail'))
      await store.loadOrders()
      expect(store.orders).toEqual([])
    })
  })

  describe('loadOrderHistory', () => {
    it('API 호출 -> orderHistory 설정', async () => {
      const { getOrderHistory } = await import('@/api')
      vi.mocked(getOrderHistory).mockResolvedValueOnce([createHistory()])
      await store.loadOrderHistory()
      expect(store.orderHistory.length).toBe(1)
    })
  })

  describe('reset', () => {
    it('모든 상태 초기화', () => {
      store.setOrders([createOrder()])
      store.setOrderHistory([createHistory()])
      store.setSelectedOrder(createOrder())
      store.setDaiAmount('999')
      store.selectBuyOrSell('sell')
      store.selectMakeOrTake('take')

      store.reset()

      expect(store.orders).toEqual([])
      expect(store.orderHistory).toEqual([])
      expect(store.selectedOrder).toBeNull()
      expect(store.daiAmount).toBe('0')
      expect(store.doYouWantToBuyOrSell).toBe('buy')
      expect(store.doYouWantToMakeOrTake).toBe('make')
    })
  })
})
