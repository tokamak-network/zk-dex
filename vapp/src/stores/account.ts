import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  createAccount as createAccountCrypto,
  unlockAccount as unlockAccountCrypto,
  initCrypto,
  type BabyJubJubPublicKey,
  type Keystore
} from '@/lib/accountCrypto'
import { logger } from '@/lib/logger'

// Re-export types for use by other modules
export type { BabyJubJubPublicKey, Keystore }
import {
  getAllAccounts,
  saveKeystore,
  getKeystore,
  deleteKeystore as deleteKeystoreStorage,
  clearAllAccounts,
  exportAccount as exportAccountStorage,
  importAccount as importAccountStorage,
  type StoredAccount
} from '@/lib/keystoreStorage'

export interface Account {
  address: string
  publicKey: BabyJubJubPublicKey
  name?: string
  numberOfNotes?: number
  keystore?: Keystore
  secretKey?: string  // Only available after unlock, NEVER sent to server
}

export interface UnlockedAccountData {
  secretKey: string
  publicKey: BabyJubJubPublicKey
  address: string
}

export const useAccountStore = defineStore('account', () => {
  const key = ref<string | null>(null)
  const viewingKey = ref<string | null>(null)
  const secretKey = ref<string | null>(null)
  const accounts = ref<Account[]>([])
  const currentAccount = ref<Account | null>(null)
  const path = ref('/')
  const cryptoInitialized = ref(false)

  const isLoggedIn = computed(() => {
    // User is logged in if at least one account is unlocked
    return accounts.value.some(acc => acc.secretKey !== undefined)
  })
  const accountCount = computed(() => accounts.value?.length ?? 0)

  /**
   * Initialize crypto module (call once at app startup)
   */
  async function initializeCrypto(): Promise<void> {
    if (!cryptoInitialized.value) {
      await initCrypto()
      cryptoInitialized.value = true
    }
  }

  /** Sets the current account key. */
  function setKey(newKey: string | null) {
    key.value = newKey
  }

  /** Sets the current viewing key in memory. */
  function setViewingKey(newViewingKey: string | null) {
    viewingKey.value = newViewingKey
  }

  /** Sets the current secret key in memory (NEVER sent to server). */
  function setSecretKey(newSecretKey: string | null) {
    secretKey.value = newSecretKey
  }

  /** Replaces the accounts list. */
  function setAccounts(newAccounts: Account[]) {
    accounts.value = newAccounts
  }

  /**
   * Appends an account to the list.
   * @param account - the account to add
   */
  function addAccount(account: Account) {
    accounts.value.push(account)
  }

  /**
   * Removes an account from the list and from localStorage.
   * @param account - the account to delete
   */
  function deleteAccount(account: Account) {
    const index = accounts.value.findIndex(a => a.address === account.address)
    if (index !== -1) {
      accounts.value.splice(index, 1)
    }
    // Also delete from localStorage
    deleteKeystoreStorage(account.address)
  }

  /** Sets the currently active account. */
  function setCurrentAccount(account: Account | null) {
    currentAccount.value = account
  }

  /** Sets the current navigation path. */
  function setPath(newPath: string) {
    path.value = newPath
  }

  /**
   * Create a new account entirely in the browser
   * Secret key NEVER leaves the browser
   */
  async function createAccountLocal(passphrase: string, label?: string): Promise<Account> {
    await initializeCrypto()

    // Create account with browser-side crypto
    const result = await createAccountCrypto(passphrase)

    // Save keystore to browser localStorage (not server!)
    saveKeystore(result.address, result.publicKey, result.keystore, label)

    const account: Account = {
      address: result.address,
      publicKey: result.publicKey,
      keystore: result.keystore,
      name: label
    }

    // Add to store
    addAccount(account)

    return account
  }

  /**
   * Unlock an account entirely in the browser
   * Secret key NEVER leaves the browser
   */
  async function unlockAccountLocal(address: string, passphrase: string): Promise<UnlockedAccountData> {
    await initializeCrypto()

    // Get keystore from browser localStorage
    const keystore = getKeystore(address)
    if (!keystore) {
      throw new Error('Keystore not found for address: ' + address)
    }

    // Decrypt in browser
    const result = await unlockAccountCrypto(passphrase, keystore)

    // Store secret key in memory (for proof generation)
    setSecretKey(result.secretKey)

    // Update account in accounts array (needed for note scanning)
    // Use array index replacement to ensure Vue reactivity triggers watchers
    const index = accounts.value.findIndex(a => a.address === address)
    logger.log('[unlockAccountLocal] Updating account at index:', index, 'address:', address)
    if (index !== -1) {
      accounts.value[index] = { ...accounts.value[index], secretKey: result.secretKey }
      logger.log('[unlockAccountLocal] Account updated, accounts with sk:',
        accounts.value.filter(a => a.secretKey).map(a => a.address))
    }

    // Update current account with secret key
    if (currentAccount.value?.address === address) {
      currentAccount.value = {
        ...currentAccount.value,
        secretKey: result.secretKey
      }
    }

    return result
  }

  /**
   * Load accounts from browser localStorage
   * No server call needed!
   */
  function loadAccounts() {
    const storedAccounts = getAllAccounts()

    // Filter valid accounts with BabyJubJub publicKey
    const validAccounts = storedAccounts.filter((acc: StoredAccount) => {
      return acc.publicKey &&
             typeof acc.publicKey === 'object' &&
             'x' in acc.publicKey &&
             'y' in acc.publicKey &&
             acc.publicKey.x &&
             acc.publicKey.y
    }).map((acc: StoredAccount): Account => ({
      address: acc.address,
      publicKey: acc.publicKey,
      keystore: acc.keystore,
      name: acc.label
    }))

    accounts.value = validAccounts
  }

  /**
   * Export account for backup
   */
  function exportAccountJson(address: string): string | null {
    return exportAccountStorage(address)
  }

  /**
   * Import account from backup
   */
  function importAccountJson(jsonData: string): Account {
    const stored = importAccountStorage(jsonData)

    const account: Account = {
      address: stored.address,
      publicKey: stored.publicKey,
      keystore: stored.keystore,
      name: stored.label
    }

    // Reload accounts from storage
    loadAccounts()

    return account
  }

  /**
   * Check if account has keystore (can be unlocked)
   */
  function hasKeystore(address: string): boolean {
    return getKeystore(address) !== null
  }

  /**
   * Lock an account - clear secretKey from memory
   * This provides security by removing the decrypted key when not in use
   */
  function lockAccount(address: string): void {
    // Clear global secretKey if it matches
    if (secretKey.value) {
      // Find the account to check if this is the one with the secretKey
      const account = accounts.value.find(a => a.address === address)
      if (account?.secretKey) {
        secretKey.value = null
      }
    }

    // Update account in accounts array to remove secretKey
    const index = accounts.value.findIndex(a => a.address === address)
    if (index !== -1) {
      const { secretKey: _, ...accountWithoutSk } = accounts.value[index]
      accounts.value[index] = accountWithoutSk
      logger.log('[lockAccount] Account locked:', address)
    }

    // Update currentAccount if needed
    if (currentAccount.value?.address === address) {
      const { secretKey: _, ...currentWithoutSk } = currentAccount.value
      currentAccount.value = currentWithoutSk
    }
  }

  /** No-op: viewing key is now derived client-side from BabyJubJub keypair. */
  async function loadViewingKey() {
    // No-op: viewing key is now derived client-side from BabyJubJub keypair
  }

  /** Resets all account state to initial values. */
  function reset() {
    key.value = null
    viewingKey.value = null
    secretKey.value = null
    accounts.value = []
    currentAccount.value = null
    path.value = '/'
  }

  /** Clears all data including localStorage keystores. */
  function clearAll() {
    reset()
    clearAllAccounts()
  }


  return {
    // State
    key,
    viewingKey,
    secretKey,
    accounts,
    currentAccount,
    path,
    cryptoInitialized,

    // Computed
    isLoggedIn,
    accountCount,

    // Basic setters
    setKey,
    setViewingKey,
    setSecretKey,
    setAccounts,
    addAccount,
    deleteAccount,
    setCurrentAccount,
    setPath,

    // Browser-side account operations (NEW)
    initializeCrypto,
    createAccountLocal,
    unlockAccountLocal,
    lockAccount,
    exportAccountJson,
    importAccountJson,
    hasKeystore,

    // Load operations
    loadAccounts,
    loadViewingKey,

    // Reset
    reset,
    clearAll
  }
})
