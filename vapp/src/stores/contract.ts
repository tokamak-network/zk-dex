import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import { Contract } from 'ethers'
import { useWeb3Store } from './web3'

// Import contract ABIs (recompiled for Poseidon migration - uint256[4] inputs)
import ZkDexABI from '../../../build/contracts/ZkDex.json'
import MockDaiABI from '../../../build/contracts/MockDai.json'

export interface ContractInfo {
  address: string
  abi: unknown[]
}

export const useContractStore = defineStore('contract', () => {
  const web3Store = useWeb3Store()

  // Use shallowRef for Contract objects to avoid Vue Proxy issues with ethers v6 private fields
  const dexContract = shallowRef<Contract | null>(null)
  const daiContract = shallowRef<Contract | null>(null)
  const dexAddress = ref('')
  const daiAddress = ref('')

  const isInitialized = computed(() => !!dexContract.value && !!daiContract.value)

  /**
   * Initializes ZkDex and MockDai contract instances from deployed artifacts.
   * @returns true if initialization succeeded, false otherwise
   */
  async function initContracts() {
    if (!web3Store.signer || !web3Store.networkId) {
      console.error('Web3 not connected')
      return false
    }

    try {
      // Get deployed addresses from contract artifacts
      const dexNetworks = ZkDexABI.networks as Record<string, { address: string }>
      const daiNetworks = MockDaiABI.networks as Record<string, { address: string }>

      console.log('Available DEX networks:', Object.keys(dexNetworks))
      console.log('Available DAI networks:', Object.keys(daiNetworks))
      console.log('MetaMask chainId:', web3Store.networkId.toString())

      // Try to find a matching network - check both chainId and any available network
      let networkIdStr = web3Store.networkId.toString()

      // If chainId doesn't match, try to find any deployed network (for Ganache compatibility)
      if (!dexNetworks[networkIdStr] || !daiNetworks[networkIdStr]) {
        const dexNetworkIds = Object.keys(dexNetworks)
        const daiNetworkIds = Object.keys(daiNetworks)

        // Find common network ID between both contracts - use the latest one
        const commonNetworkIds = dexNetworkIds.filter(id => daiNetworkIds.includes(id))

        if (commonNetworkIds.length > 0) {
          // Use the last (most recent) deployment
          const latestNetworkId = commonNetworkIds[commonNetworkIds.length - 1]
          console.log(`Using network ${latestNetworkId} instead of chainId ${networkIdStr}`)
          networkIdStr = latestNetworkId
        } else {
          console.error('Contracts not deployed on this network')
          return false
        }
      }

      dexAddress.value = dexNetworks[networkIdStr].address
      daiAddress.value = daiNetworks[networkIdStr].address
      console.log('DEX address:', dexAddress.value)
      console.log('DAI address:', daiAddress.value)

      dexContract.value = new Contract(
        dexAddress.value,
        ZkDexABI.abi,
        web3Store.signer
      )

      daiContract.value = new Contract(
        daiAddress.value,
        MockDaiABI.abi,
        web3Store.signer
      )

      return true
    } catch (err) {
      console.error('Failed to init contracts:', err)
      return false
    }
  }

  /** Clears contract instances and addresses. */
  function reset() {
    dexContract.value = null
    daiContract.value = null
    dexAddress.value = ''
    daiAddress.value = ''
  }

  return {
    dexContract,
    daiContract,
    dexAddress,
    daiAddress,
    isInitialized,
    initContracts,
    reset
  }
})
