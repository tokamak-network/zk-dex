/**
 * API module for ZK-DEX
 *
 * SECURITY NOTE:
 * - Account creation/unlock are now handled in browser only (see stores/account.ts)
 * - Proof generation will be handled in browser Web Worker (see lib/proofGenerator.ts)
 * - Secret keys and keystores NEVER leave the browser
 */

import axios, { type AxiosInstance } from 'axios'
import type { Note, TransferNote } from '@/stores/note'
import type { Order, OrderHistory } from '@/stores/order'

const instance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000',
})

// ============================================================================
// Viewing Key (still uses server for now - consider migrating to localStorage)
// ============================================================================

export async function getViewingKey(key: string): Promise<string> {
  const res = await instance.get(`/vk/${key}`)
  return res.data.vk
}

export async function setViewingKey(key: string, vk: string): Promise<void> {
  await instance.post('/vk', { key, vk })
}

// ============================================================================
// Notes (server storage for note metadata - may migrate to localStorage later)
// ============================================================================

export async function getNoteByNoteHash(account: string, hash: string): Promise<Note> {
  const res = await instance.get(`/notes/${account}/${hash}`)
  return res.data.note
}

export async function getNotes(account: string): Promise<Note[]> {
  const res = await instance.get(`/notes/${account}`)
  return JSON.parse(res.data.notes)
}

export async function getTransferNotes(account: string): Promise<TransferNote[]> {
  const res = await instance.get(`/notes/transfer/${account}`)
  return JSON.parse(res.data.notes)
}

export async function addNote(account: string, note: Note): Promise<Note[]> {
  const res = await instance.post('/notes', { account, note })
  return res.data.notes
}

export async function addTransferNote(account: string, note: TransferNote): Promise<TransferNote[]> {
  const res = await instance.post('/notes/transfer', { account, note })
  return res.data.notes
}

export async function updateNoteState(
  noteOwner: string,
  noteHash: string,
  noteState: string
): Promise<Note[]> {
  const res = await instance.put('/notes', { noteOwner, noteHash, noteState })
  return res.data.notes
}

// ============================================================================
// Orders (server storage for order book)
// ============================================================================

export async function getOrderHistory(account: string): Promise<OrderHistory[] | null> {
  const res = await instance.get(`/orders/history/${account}`)
  if (res.data === null) {
    return null
  }
  return JSON.parse(res.data.orders)
}

export async function getOrder(id: string): Promise<Order | null> {
  const res = await instance.get(`/orders/${id}`)
  if (res.data === null) {
    return null
  }
  return res.data.order
}

export async function getOrders(_key?: string): Promise<Order[] | null> {
  const res = await instance.get('/orders')
  if (res.data === null) {
    return null
  }
  return JSON.parse(res.data.orders)
}

export async function addOrderHistory(account: string, history: OrderHistory): Promise<OrderHistory> {
  const res = await instance.post(`/orders/history/${account}`, { history })
  return res.data.history
}

export async function addOrder(order: Order): Promise<Order[]> {
  const res = await instance.post('/orders', { order })
  return res.data.orders
}

export async function updateOrderHistory(account: string, order: Order): Promise<OrderHistory> {
  const res = await instance.put(`/orders/${account}`, { order })
  return res.data.history
}

export async function updateOrderHistoryState(
  account: string,
  orderId: string,
  orderState: string
): Promise<OrderHistory> {
  const res = await instance.put(`/orders/state/${account}`, { orderId, orderState })
  return res.data.history
}

export async function updateOrderState(orderId: string, orderState: string): Promise<Order[]> {
  const res = await instance.put('/orders', { orderId, orderState })
  return res.data.orders
}

export async function updateOrderTaker(orderId: string, orderTaker: string): Promise<Order[]> {
  const res = await instance.put('/orders/taker', { orderId, orderTaker })
  return res.data.orders
}

