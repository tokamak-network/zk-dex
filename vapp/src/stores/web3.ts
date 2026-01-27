import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import { BrowserProvider, JsonRpcSigner } from 'ethers'

export const useWeb3Store = defineStore('web3', () => {
  const isListening = ref(false)
  // Use shallowRef for ethers v6 objects to avoid Vue Proxy issues with private fields
  const provider = shallowRef<BrowserProvider | null>(null)
  const signer = shallowRef<JsonRpcSigner | null>(null)
  const networkId = ref<bigint | null>(null)
  const account = ref('')
  const balance = ref<bigint | null>(null)
  const error = ref<string | null>(null)

  const isConnected = computed(() => !!account.value && isListening.value)

  /**
   * Connects to MetaMask and initializes provider/signer.
   * @returns true if connection succeeded, false otherwise
   */
  async function connect() {
    if (typeof window.ethereum === 'undefined') {
      error.value = 'MetaMask is not installed'
      return false
    }

    try {
      const browserProvider = new BrowserProvider(window.ethereum)
      const accounts = await browserProvider.send('eth_requestAccounts', [])

      if (accounts.length === 0) {
        error.value = 'No accounts found'
        return false
      }

      provider.value = browserProvider
      signer.value = await browserProvider.getSigner()
      account.value = accounts[0]

      const network = await browserProvider.getNetwork()
      networkId.value = network.chainId

      balance.value = await browserProvider.getBalance(account.value)
      isListening.value = true
      error.value = null

      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts: unknown) => handleAccountsChanged(accounts as string[]))
      window.ethereum.on('chainChanged', handleChainChanged)

      return true
    } catch (err) {
      error.value = (err as Error).message
      return false
    }
  }

  /**
   * Handles MetaMask account change event.
   * @param accounts - the new list of connected accounts
   */
  async function handleAccountsChanged(accounts: string[]) {
    if (accounts.length === 0) {
      disconnect()
    } else {
      account.value = accounts[0]
      if (provider.value) {
        balance.value = await provider.value.getBalance(account.value)
        signer.value = await provider.value.getSigner()
      }
    }
  }

  /** Handles chain change by reloading the page. */
  function handleChainChanged() {
    window.location.reload()
  }

  /** Disconnects wallet and clears all web3 state. */
  function disconnect() {
    isListening.value = false
    provider.value = null
    signer.value = null
    networkId.value = null
    account.value = ''
    balance.value = null
    error.value = null
  }

  /** Refreshes the account ETH balance. */
  async function updateBalance() {
    if (provider.value && account.value) {
      balance.value = await provider.value.getBalance(account.value)
    }
  }

  return {
    isListening,
    provider,
    signer,
    networkId,
    account,
    balance,
    error,
    isConnected,
    connect,
    disconnect,
    updateBalance
  }
})

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void
    }
  }
}
