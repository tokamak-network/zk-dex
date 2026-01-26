/**
 * Browser-side keystore storage module
 * Stores encrypted keystores in browser localStorage only
 * Keystores are NEVER sent to the server
 */

import type { Keystore, BabyJubJubPublicKey } from './accountCrypto'

const STORAGE_PREFIX = 'zkdex_'
const ACCOUNTS_KEY = `${STORAGE_PREFIX}accounts`

export interface StoredAccount {
  address: string
  publicKey: BabyJubJubPublicKey
  keystore: Keystore
  createdAt: number
  label?: string
}

/**
 * Save a keystore for an address
 */
export function saveKeystore(address: string, publicKey: BabyJubJubPublicKey, keystore: Keystore, label?: string): void {
  const accounts = getAllAccounts()

  // Check if account already exists
  const existingIndex = accounts.findIndex(a => a.address === address)

  const account: StoredAccount = {
    address,
    publicKey,
    keystore,
    createdAt: Date.now(),
    label
  }

  if (existingIndex >= 0) {
    accounts[existingIndex] = account
  } else {
    accounts.push(account)
  }

  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

/**
 * Get keystore for an address
 */
export function getKeystore(address: string): Keystore | null {
  const account = getAccount(address)
  return account?.keystore ?? null
}

/**
 * Get full account data for an address
 */
export function getAccount(address: string): StoredAccount | null {
  const accounts = getAllAccounts()
  return accounts.find(a => a.address === address) ?? null
}

/**
 * Get all stored accounts
 */
export function getAllAccounts(): StoredAccount[] {
  try {
    const data = localStorage.getItem(ACCOUNTS_KEY)
    if (!data) return []
    return JSON.parse(data) as StoredAccount[]
  } catch {
    return []
  }
}

/**
 * Get account addresses only (for display without sensitive data)
 */
export function getAccountAddresses(): string[] {
  return getAllAccounts().map(a => a.address)
}

/**
 * Delete keystore for an address
 */
export function deleteKeystore(address: string): boolean {
  const accounts = getAllAccounts()
  const index = accounts.findIndex(a => a.address === address)

  if (index < 0) return false

  accounts.splice(index, 1)
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  return true
}

/**
 * Update account label
 */
export function updateAccountLabel(address: string, label: string): boolean {
  const accounts = getAllAccounts()
  const account = accounts.find(a => a.address === address)

  if (!account) return false

  account.label = label
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  return true
}

/**
 * Check if an account exists
 */
export function hasAccount(address: string): boolean {
  return getAccount(address) !== null
}

/**
 * Clear all stored accounts (use with caution!)
 */
export function clearAllAccounts(): void {
  localStorage.removeItem(ACCOUNTS_KEY)
}

/**
 * Export account data for backup (includes keystore)
 */
export function exportAccount(address: string): string | null {
  const account = getAccount(address)
  if (!account) return null

  return JSON.stringify({
    address: account.address,
    publicKey: account.publicKey,
    keystore: account.keystore,
    label: account.label,
    exportedAt: Date.now()
  }, null, 2)
}

/**
 * Import account from backup
 */
export function importAccount(jsonData: string): StoredAccount {
  const data = JSON.parse(jsonData)

  // Validate required fields
  if (!data.address || !data.publicKey || !data.keystore) {
    throw new Error('Invalid account data: missing required fields')
  }

  // Validate keystore structure
  if (!data.keystore.crypto || !data.keystore.version) {
    throw new Error('Invalid keystore format')
  }

  saveKeystore(data.address, data.publicKey, data.keystore, data.label)
  return getAccount(data.address)!
}
