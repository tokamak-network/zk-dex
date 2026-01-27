/**
 * api/index 단위 테스트
 *
 * axios를 모킹하여 API 함수를 테스트.
 *
 * 테스트 항목:
 * - 활성 API: getViewingKey, setViewingKey, getNotes, addNote, etc.
 * - 주문 API: getOrders, addOrder, etc.
 * - 더 이상 사용되지 않는(deprecated) 함수들이 올바른 에러를 던지는지
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ALICE_ADDRESS, ALICE_ADDRESS_0X, ALICE_VK,
  NOTE_ALICE_ETH_VALID, NOTE_ALICE_DAI_VALID,
  NOTE_BOB_ETH_VALID,
  ORDER_1, ORDER_HISTORY_ONGOING,
} from '@/test-utils/fixtures'

// vi.hoisted로 mock 인스턴스를 vi.mock 호이스팅 전에 생성
const { mockGet, mockPost, mockPut } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
}))

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
    })),
  },
}))

import {
  getViewingKey,
  setViewingKey,
  getNoteByNoteHash,
  getNotes,
  getTransferNotes,
  addNote,
  addTransferNote,
  updateNoteState,
  getOrderHistory,
  getOrder,
  getOrders,
  addOrderHistory,
  addOrder,
  updateOrderHistory,
  updateOrderHistoryState,
  updateOrderState,
  updateOrderTaker,
  createAccount,
  unlockAccount,
  generateProof,
  getAccounts,
  addAccount as apiAddAccount,
  deleteAccount as apiDeleteAccount,
} from './index'

describe('api/index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ═══════════════════════════════════════════
  // Viewing Key
  // ═══════════════════════════════════════════
  describe('Viewing Key', () => {
    it('getViewingKey: GET /vk/:key', async () => {
      mockGet.mockResolvedValue({ data: { vk: ALICE_VK } })
      const result = await getViewingKey(ALICE_ADDRESS)
      expect(mockGet).toHaveBeenCalledWith(`/vk/${ALICE_ADDRESS}`)
      expect(result).toBe(ALICE_VK)
    })

    it('setViewingKey: POST /vk', async () => {
      mockPost.mockResolvedValue({ data: {} })
      await setViewingKey(ALICE_ADDRESS, ALICE_VK)
      expect(mockPost).toHaveBeenCalledWith('/vk', { key: ALICE_ADDRESS, vk: ALICE_VK })
    })
  })

  // ═══════════════════════════════════════════
  // Notes
  // ═══════════════════════════════════════════
  describe('Notes', () => {
    it('getNoteByNoteHash: GET /notes/:account/:hash', async () => {
      const mockNote = { hash: NOTE_ALICE_ETH_VALID.hashHex, value: NOTE_ALICE_ETH_VALID.value }
      mockGet.mockResolvedValue({ data: { note: mockNote } })
      const result = await getNoteByNoteHash(ALICE_ADDRESS, NOTE_ALICE_ETH_VALID.hashHex)
      expect(mockGet).toHaveBeenCalledWith(`/notes/${ALICE_ADDRESS}/${NOTE_ALICE_ETH_VALID.hashHex}`)
      expect(result).toEqual(mockNote)
    })

    it('getNotes: GET /notes/:account → JSON.parse', async () => {
      const notes = [{ hash: NOTE_ALICE_ETH_VALID.hashHex }, { hash: NOTE_ALICE_DAI_VALID.hashHex }]
      mockGet.mockResolvedValue({ data: { notes: JSON.stringify(notes) } })
      const result = await getNotes(ALICE_ADDRESS)
      expect(result).toEqual(notes)
    })

    it('getTransferNotes: GET /notes/transfer/:account → JSON.parse', async () => {
      const notes = [{ hash: NOTE_ALICE_ETH_VALID.hashHex, type: '0x0' }]
      mockGet.mockResolvedValue({ data: { notes: JSON.stringify(notes) } })
      const result = await getTransferNotes(ALICE_ADDRESS)
      expect(result).toEqual(notes)
    })

    it('addNote: POST /notes', async () => {
      const note = {
        hash: NOTE_ALICE_ETH_VALID.hashHex,
        owner: ALICE_ADDRESS,
        ownerAddress: ALICE_ADDRESS_0X,
        value: NOTE_ALICE_ETH_VALID.value,
        token: '0x0',
        state: '0x1',
        isSmart: '0x0',
      }
      mockPost.mockResolvedValue({ data: { notes: [note] } })
      const result = await addNote(ALICE_ADDRESS, note as never)
      expect(mockPost).toHaveBeenCalledWith('/notes', { account: ALICE_ADDRESS, note })
      expect(result).toEqual([note])
    })

    it('addTransferNote: POST /notes/transfer', async () => {
      const tn = { hash: NOTE_ALICE_ETH_VALID.hashHex, type: '0x0', value: NOTE_ALICE_ETH_VALID.value, token: '0x0' }
      mockPost.mockResolvedValue({ data: { notes: [tn] } })
      const result = await addTransferNote(ALICE_ADDRESS, tn as never)
      expect(mockPost).toHaveBeenCalledWith('/notes/transfer', { account: ALICE_ADDRESS, note: tn })
      expect(result).toEqual([tn])
    })

    it('updateNoteState: PUT /notes', async () => {
      mockPut.mockResolvedValue({ data: { notes: [] } })
      await updateNoteState(ALICE_ADDRESS, NOTE_ALICE_ETH_VALID.hashHex, '0x1')
      expect(mockPut).toHaveBeenCalledWith('/notes', {
        noteOwner: ALICE_ADDRESS,
        noteHash: NOTE_ALICE_ETH_VALID.hashHex,
        noteState: '0x1'
      })
    })
  })

  // ═══════════════════════════════════════════
  // Orders
  // ═══════════════════════════════════════════
  describe('Orders', () => {
    it('getOrderHistory: GET /orders/history/:account → JSON.parse', async () => {
      const history = [ORDER_HISTORY_ONGOING]
      mockGet.mockResolvedValue({ data: { orders: JSON.stringify(history) } })
      const result = await getOrderHistory(ALICE_ADDRESS)
      expect(result).toEqual(history)
    })

    it('getOrderHistory: null 응답 → null', async () => {
      mockGet.mockResolvedValue({ data: null })
      const result = await getOrderHistory(ALICE_ADDRESS)
      expect(result).toBeNull()
    })

    it('getOrder: GET /orders/:id', async () => {
      const order = ORDER_1
      mockGet.mockResolvedValue({ data: { order } })
      const result = await getOrder(NOTE_ALICE_ETH_VALID.hashHex)
      expect(result).toEqual(order)
    })

    it('getOrder: null 응답 → null', async () => {
      mockGet.mockResolvedValue({ data: null })
      const result = await getOrder(NOTE_ALICE_ETH_VALID.hashHex)
      expect(result).toBeNull()
    })

    it('getOrders: GET /orders → JSON.parse', async () => {
      const orders = [ORDER_1]
      mockGet.mockResolvedValue({ data: { orders: JSON.stringify(orders) } })
      const result = await getOrders()
      expect(result).toEqual(orders)
    })

    it('getOrders: null 응답 → null', async () => {
      mockGet.mockResolvedValue({ data: null })
      const result = await getOrders()
      expect(result).toBeNull()
    })

    it('addOrderHistory: POST /orders/history/:account', async () => {
      const history = ORDER_HISTORY_ONGOING
      mockPost.mockResolvedValue({ data: { history } })
      const result = await addOrderHistory(ALICE_ADDRESS, history as never)
      expect(mockPost).toHaveBeenCalledWith(`/orders/history/${ALICE_ADDRESS}`, { history })
      expect(result).toEqual(history)
    })

    it('addOrder: POST /orders', async () => {
      const order = ORDER_1
      mockPost.mockResolvedValue({ data: { orders: [order] } })
      const result = await addOrder(order as never)
      expect(result).toEqual([order])
    })

    it('updateOrderHistory: PUT /orders/:account', async () => {
      const order = { hash: NOTE_ALICE_ETH_VALID.hashHex }
      const history = { orderId: NOTE_ALICE_ETH_VALID.hashHex }
      mockPut.mockResolvedValue({ data: { history } })
      const result = await updateOrderHistory(ALICE_ADDRESS, order as never)
      expect(mockPut).toHaveBeenCalledWith(`/orders/${ALICE_ADDRESS}`, { order })
      expect(result).toEqual(history)
    })

    it('updateOrderHistoryState: PUT /orders/state/:account', async () => {
      mockPut.mockResolvedValue({ data: { history: { orderId: NOTE_ALICE_ETH_VALID.hashHex } } })
      const result = await updateOrderHistoryState(ALICE_ADDRESS, NOTE_ALICE_ETH_VALID.hashHex, '0x1')
      expect(mockPut).toHaveBeenCalledWith(`/orders/state/${ALICE_ADDRESS}`, {
        orderId: NOTE_ALICE_ETH_VALID.hashHex,
        orderState: '0x1'
      })
      expect(result).toEqual({ orderId: NOTE_ALICE_ETH_VALID.hashHex })
    })

    it('updateOrderState: PUT /orders', async () => {
      mockPut.mockResolvedValue({ data: { orders: [] } })
      await updateOrderState(NOTE_ALICE_ETH_VALID.hashHex, '0x2')
      expect(mockPut).toHaveBeenCalledWith('/orders', {
        orderId: NOTE_ALICE_ETH_VALID.hashHex,
        orderState: '0x2'
      })
    })

    it('updateOrderTaker: PUT /orders/taker', async () => {
      mockPut.mockResolvedValue({ data: { orders: [] } })
      await updateOrderTaker(NOTE_ALICE_ETH_VALID.hashHex, NOTE_BOB_ETH_VALID.owner)
      expect(mockPut).toHaveBeenCalledWith('/orders/taker', {
        orderId: NOTE_ALICE_ETH_VALID.hashHex,
        orderTaker: NOTE_BOB_ETH_VALID.owner
      })
    })
  })

  // ═══════════════════════════════════════════
  // Deprecated functions
  // ═══════════════════════════════════════════
  describe('Deprecated functions', () => {
    it('createAccount → DEPRECATED 에러', () => {
      expect(() => createAccount('password')).toThrow('DEPRECATED')
    })

    it('unlockAccount → DEPRECATED 에러', () => {
      expect(() => unlockAccount('password', {})).toThrow('DEPRECATED')
    })

    it('generateProof → DEPRECATED 에러', () => {
      expect(() => generateProof({ circuit: 'mint', inputs: {} })).toThrow('DEPRECATED')
    })

    it('getAccounts → DEPRECATED 에러', async () => {
      await expect(getAccounts(ALICE_ADDRESS)).rejects.toThrow('DEPRECATED')
    })

    it('addAccount → DEPRECATED 에러', async () => {
      await expect(apiAddAccount(ALICE_ADDRESS, {})).rejects.toThrow('DEPRECATED')
    })

    it('deleteAccount → DEPRECATED 에러', async () => {
      await expect(apiDeleteAccount(ALICE_ADDRESS, ALICE_ADDRESS)).rejects.toThrow('DEPRECATED')
    })
  })
})
