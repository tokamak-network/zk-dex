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

/**
 * Fetches the viewing key for a given account key from the server.
 *
 * @param key - The account key to look up the viewing key for
 * @returns The viewing key string associated with the given account key
 */
export async function getViewingKey(key: string): Promise<string> {
  const res = await instance.get(`/vk/${key}`)
  return res.data.vk
}

/**
 * Stores a viewing key on the server for a given account key.
 *
 * @param key - The account key to associate the viewing key with
 * @param vk - The viewing key to store
 * @returns Resolves when the viewing key has been successfully stored
 */
export async function setViewingKey(key: string, vk: string): Promise<void> {
  await instance.post('/vk', { key, vk })
}

// ============================================================================
// Notes (server storage for note metadata - may migrate to localStorage later)
// ============================================================================

/**
 * Fetches a single note by its hash for a specific account.
 *
 * @param account - The account identifier that owns the note
 * @param hash - The unique hash of the note to retrieve
 * @returns The note matching the given hash
 */
export async function getNoteByNoteHash(account: string, hash: string): Promise<Note> {
  const res = await instance.get(`/notes/${account}/${hash}`)
  return res.data.note
}

/**
 * Fetches all notes belonging to a specific account.
 *
 * @param account - The account identifier to fetch notes for
 * @returns An array of all notes owned by the account
 */
export async function getNotes(account: string): Promise<Note[]> {
  const res = await instance.get(`/notes/${account}`)
  return JSON.parse(res.data.notes)
}

/**
 * Fetches transfer history notes for a specific account.
 *
 * @param account - The account identifier to fetch transfer notes for
 * @returns An array of transfer notes associated with the account
 */
export async function getTransferNotes(account: string): Promise<TransferNote[]> {
  const res = await instance.get(`/notes/transfer/${account}`)
  return JSON.parse(res.data.notes)
}

/**
 * Adds a new note to server storage for a specific account.
 *
 * @param account - The account identifier to add the note to
 * @param note - The note object to store
 * @returns The updated array of notes for the account after insertion
 */
export async function addNote(account: string, note: Note): Promise<Note[]> {
  const res = await instance.post('/notes', { account, note })
  return res.data.notes
}

/**
 * Adds a transfer note record for a specific account.
 *
 * @param account - The account identifier to add the transfer note to
 * @param note - The transfer note object to store
 * @returns The updated array of transfer notes for the account after insertion
 */
export async function addTransferNote(account: string, note: TransferNote): Promise<TransferNote[]> {
  const res = await instance.post('/notes/transfer', { account, note })
  return res.data.notes
}

// ============================================================================
// Raw Note Events (localStorage - encrypted data from blockchain)
// ============================================================================

const RAW_NOTE_EVENTS_KEY = 'zkdex_raw_note_events'

/**
 * Raw note event data from blockchain (encrypted, not yet decrypted)
 */
export interface RawNoteEvent {
  hash: string
  encryptedData: string
  state: number           // 0=INVALID, 1=VALID, 2=TRADING, 3=SPENT
  createdInTx?: string
  createdAtBlock?: number
  createdAt?: number      // Unix timestamp
  createdBy?: string      // Ethereum address that submitted the mint tx
  spentInTx?: string
}

/**
 * Get all raw note events from localStorage
 */
export function getRawNoteEvents(): Record<string, RawNoteEvent> {
  try {
    const data = localStorage.getItem(RAW_NOTE_EVENTS_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

/**
 * Save a raw note event to localStorage
 */
export function saveRawNoteEvent(event: RawNoteEvent): void {
  const events = getRawNoteEvents()
  // Merge with existing data (preserve fields not in new event)
  const existing = events[event.hash] || {}
  events[event.hash] = { ...existing, ...event }
  localStorage.setItem(RAW_NOTE_EVENTS_KEY, JSON.stringify(events))
}

/**
 * Save multiple raw note events to localStorage
 */
export function saveRawNoteEvents(newEvents: RawNoteEvent[]): void {
  const events = getRawNoteEvents()
  for (const event of newEvents) {
    const existing = events[event.hash] || {}
    events[event.hash] = { ...existing, ...event }
  }
  localStorage.setItem(RAW_NOTE_EVENTS_KEY, JSON.stringify(events))
}

/**
 * Clear all raw note events from localStorage
 */
export function clearRawNoteEvents(): void {
  localStorage.removeItem(RAW_NOTE_EVENTS_KEY)
}

/**
 * Updates the state of a note on the server.
 *
 * @param noteOwner - The account identifier of the note owner
 * @param noteHash - The unique hash identifying the note to update
 * @param noteState - The new state to assign to the note
 * @returns The updated array of notes for the owner after the state change
 */
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

/**
 * Fetches order history for a specific account.
 *
 * @param account - The account identifier to fetch order history for
 * @returns An array of order history entries for the account, or null if none exist
 */
export async function getOrderHistory(account: string): Promise<OrderHistory[] | null> {
  const res = await instance.get(`/orders/history/${account}`)
  if (res.data === null) {
    return null
  }
  return JSON.parse(res.data.orders)
}

/**
 * Fetches a single order by its ID.
 *
 * @param id - The unique identifier of the order to retrieve
 * @returns The order matching the given ID, or null if not found
 */
export async function getOrder(id: string): Promise<Order | null> {
  const res = await instance.get(`/orders/${id}`)
  if (res.data === null) {
    return null
  }
  return res.data.order
}

/**
 * Fetches all orders from the server order book.
 *
 * @param _key - Optional key parameter (currently unused, reserved for future filtering)
 * @returns An array of all orders in the order book, or null if none exist
 */
export async function getOrders(_key?: string): Promise<Order[] | null> {
  const res = await instance.get('/orders')
  if (res.data === null) {
    return null
  }
  return JSON.parse(res.data.orders)
}

/**
 * Adds an order history entry for a specific account.
 *
 * @param account - The account identifier to add the order history entry to
 * @param history - The order history object to store
 * @returns The newly created order history entry
 */
export async function addOrderHistory(account: string, history: OrderHistory): Promise<OrderHistory> {
  const res = await instance.post(`/orders/history/${account}`, { history })
  return res.data.history
}

/**
 * Adds a new order to the server order book.
 *
 * @param order - The order object to add to the order book
 * @returns The updated array of orders in the order book after insertion
 */
export async function addOrder(order: Order): Promise<Order[]> {
  const res = await instance.post('/orders', { order })
  return res.data.orders
}

/**
 * Updates an order history entry for a specific account.
 *
 * @param account - The account identifier whose order history should be updated
 * @param order - The order object containing the updated data
 * @returns The updated order history entry
 */
export async function updateOrderHistory(account: string, order: Order): Promise<OrderHistory> {
  const res = await instance.put(`/orders/${account}`, { order })
  return res.data.history
}

/**
 * Updates the state of an order history entry for a specific account.
 *
 * @param account - The account identifier whose order history state should be updated
 * @param orderId - The unique identifier of the order to update
 * @param orderState - The new state to assign to the order history entry
 * @returns The updated order history entry
 */
export async function updateOrderHistoryState(
  account: string,
  orderId: string,
  orderState: string
): Promise<OrderHistory> {
  const res = await instance.put(`/orders/state/${account}`, { orderId, orderState })
  return res.data.history
}

/**
 * Updates the state of an order in the order book.
 *
 * @param orderId - The unique identifier of the order to update
 * @param orderState - The new state to assign to the order
 * @returns The updated array of orders in the order book after the state change
 */
export async function updateOrderState(orderId: string, orderState: string): Promise<Order[]> {
  const res = await instance.put('/orders', { orderId, orderState })
  return res.data.orders
}

/**
 * Sets the taker for an order in the order book.
 *
 * @param orderId - The unique identifier of the order to update
 * @param orderTaker - The account identifier of the taker to assign to the order
 * @returns The updated array of orders in the order book after setting the taker
 */
export async function updateOrderTaker(orderId: string, orderTaker: string): Promise<Order[]> {
  const res = await instance.put('/orders/taker', { orderId, orderTaker })
  return res.data.orders
}

