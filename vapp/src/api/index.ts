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

// ============================================================================
// DEPRECATED - These functions are NO LONGER USED
// Account operations are now browser-only (see stores/account.ts)
// Proof generation will be browser-only (see lib/proofGenerator.ts)
// ============================================================================

/**
 * @deprecated Use stores/account.ts createAccountLocal() instead
 * Account creation is now done entirely in the browser for security
 */
export interface CreateAccountResponse {
  data: {
    account?: {
      address: string
      publicKey: { x: string; y: string }
      keystore: unknown
    }
    error?: string
  }
}

/**
 * @deprecated Use stores/account.ts createAccountLocal() instead
 * This function sends passphrase to server which is a security risk
 */
export function createAccount(_passphrase: string): Promise<CreateAccountResponse> {
  throw new Error(
    'DEPRECATED: createAccount() is no longer available. ' +
    'Use accountStore.createAccountLocal() for browser-side account creation.'
  )
}

/**
 * @deprecated Use stores/account.ts unlockAccountLocal() instead
 * Account unlocking is now done entirely in the browser for security
 */
export interface UnlockAccountResponse {
  data: {
    secretKey: string
    publicKey: { x: string; y: string }
    address: string
  }
}

/**
 * @deprecated Use stores/account.ts unlockAccountLocal() instead
 * This function sends passphrase and keystore to server which is a security risk
 */
export function unlockAccount(_passphrase: string, _keystore: unknown): Promise<UnlockAccountResponse> {
  throw new Error(
    'DEPRECATED: unlockAccount() is no longer available. ' +
    'Use accountStore.unlockAccountLocal() for browser-side account unlocking.'
  )
}

/**
 * @deprecated Use lib/proofGenerator.ts instead
 * Proof generation will be done in browser Web Worker for security
 */
export interface ProofParams {
  circuit: string
  inputs: Record<string, unknown>
}

/**
 * @deprecated Use lib/proofGenerator.ts instead
 */
export interface ProofResponse {
  data: {
    proof: unknown
    publicSignals?: string[]
  }
}

/**
 * @deprecated Use lib/proofGenerator.ts generateProof() instead
 * This function sends secretKey to server which is a critical security risk
 */
export function generateProof(_params: ProofParams): Promise<ProofResponse> {
  throw new Error(
    'DEPRECATED: generateProof() is no longer available. ' +
    'Use proofGenerator.generateProof() for browser-side proof generation.'
  )
}

/**
 * @deprecated Accounts are stored in browser localStorage only
 * Use accountStore.loadAccounts() which reads from localStorage
 */
export async function getAccounts(_key: string): Promise<never> {
  throw new Error(
    'DEPRECATED: getAccounts() is no longer available. ' +
    'Use accountStore.loadAccounts() which reads from browser localStorage.'
  )
}

/**
 * @deprecated Accounts are stored in browser localStorage only
 * Use accountStore.importAccountJson() instead
 */
export async function addAccount(_key: string, _account: unknown): Promise<never> {
  throw new Error(
    'DEPRECATED: addAccount() is no longer available. ' +
    'Use accountStore.importAccountJson() to import accounts from backup.'
  )
}

/**
 * @deprecated Accounts are stored in browser localStorage only
 * Use accountStore.deleteAccount() which removes from localStorage
 */
export async function deleteAccount(_key: string, _address: string): Promise<never> {
  throw new Error(
    'DEPRECATED: deleteAccount() is no longer available. ' +
    'Use accountStore.deleteAccount() which removes from browser localStorage.'
  )
}
