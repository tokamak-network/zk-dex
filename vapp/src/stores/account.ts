import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as api from '@/api'

export interface BabyJubJubPublicKey {
  x: string
  y: string
}

export interface Account {
  address: string
  publicKey: BabyJubJubPublicKey
  name?: string
  numberOfNotes?: number
  keystore?: unknown
  secretKey?: string  // Only available after unlock
}

export const useAccountStore = defineStore('account', () => {
  const key = ref<string | null>(null)
  const viewingKey = ref<string | null>(null)
  const secretKey = ref<string | null>(null)
  const accounts = ref<Account[]>([])
  const currentAccount = ref<Account | null>(null)
  const path = ref('/')

  const isLoggedIn = computed(() => key.value !== null)
  const accountCount = computed(() => accounts.value?.length ?? 0)

  function setKey(newKey: string | null) {
    key.value = newKey
  }

  function setViewingKey(newViewingKey: string | null) {
    viewingKey.value = newViewingKey
  }

  function setSecretKey(newSecretKey: string | null) {
    secretKey.value = newSecretKey
  }

  function setAccounts(newAccounts: Account[]) {
    accounts.value = newAccounts
  }

  function addAccount(account: Account) {
    accounts.value.push(account)
  }

  function deleteAccount(account: Account) {
    const index = accounts.value.findIndex(a => a.address === account.address)
    if (index !== -1) {
      accounts.value.splice(index, 1)
    }
  }

  function setCurrentAccount(account: Account | null) {
    currentAccount.value = account
  }

  function setPath(newPath: string) {
    path.value = newPath
  }

  async function loadAccounts() {
    try {
      const data = await api.getAccounts(key.value!)
      // Filter out old ethers.js accounts that don't have BabyJubJub publicKey
      // Valid accounts have publicKey: { x: string, y: string }
      const validAccounts = (data || []).filter((acc: Account) => {
        return acc.publicKey &&
               typeof acc.publicKey === 'object' &&
               'x' in acc.publicKey &&
               'y' in acc.publicKey &&
               acc.publicKey.x &&
               acc.publicKey.y
      })
      accounts.value = validAccounts
    } catch (err) {
      console.error('Failed to load accounts:', err)
    }
  }

  async function loadViewingKey() {
    try {
      const data = await api.getViewingKey(key.value!)
      viewingKey.value = data
    } catch (err) {
      console.error('Failed to load viewing key:', err)
    }
  }

  function reset() {
    key.value = null
    viewingKey.value = null
    secretKey.value = null
    accounts.value = []
    currentAccount.value = null
    path.value = '/'
  }

  return {
    key,
    viewingKey,
    secretKey,
    accounts,
    currentAccount,
    path,
    isLoggedIn,
    accountCount,
    setKey,
    setViewingKey,
    setSecretKey,
    setAccounts,
    addAccount,
    deleteAccount,
    setCurrentAccount,
    setPath,
    loadAccounts,
    loadViewingKey,
    reset
  }
})
