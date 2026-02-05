import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import { Contract } from 'ethers'
import { useWeb3Store } from './web3'

// Import contract ABIs (recompiled for Poseidon migration - uint256[4] inputs)
import ZkDexABI from '../../../build/contracts/ZkDex.json'
import MockDaiABI from '../../../build/contracts/MockDai.json'
import TimeLockABI from '../../../build/contracts/TimeLock.json'
import { logger } from '@/lib/logger'

export interface ContractInfo {
  address: string
  abi: unknown[]
}

export const useContractStore = defineStore('contract', () => {
  const web3Store = useWeb3Store()

  // Use shallowRef for Contract objects to avoid Vue Proxy issues with ethers v6 private fields
  const dexContract = shallowRef<Contract | null>(null)
  const daiContract = shallowRef<Contract | null>(null)
  const timeLockContract = shallowRef<Contract | null>(null)
  const dexAddress = ref('')
  const daiAddress = ref('')
  const timeLockAddress = ref('')

  const isInitialized = computed(() => !!dexContract.value && !!daiContract.value)

  /**
   * Initializes ZkDex and MockDai contract instances from deployed artifacts.
   * @returns true if initialization succeeded, false otherwise
   */
  async function initContracts() {
    if (!web3Store.signer || !web3Store.networkId) {
      logger.error('Web3 not connected')
      return false
    }

    try {
      // Get deployed addresses from contract artifacts
      const dexNetworks = ZkDexABI.networks as Record<string, { address: string }>
      const daiNetworks = MockDaiABI.networks as Record<string, { address: string }>
      const timeLockNetworks = TimeLockABI.networks as Record<string, { address: string }>

      logger.log('Available DEX networks:', Object.keys(dexNetworks))
      logger.log('Available DAI networks:', Object.keys(daiNetworks))
      logger.log('Available TimeLock networks:', Object.keys(timeLockNetworks))
      logger.log('MetaMask chainId:', web3Store.networkId.toString())

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
          logger.log(`Using network ${latestNetworkId} instead of chainId ${networkIdStr}`)
          networkIdStr = latestNetworkId
        } else {
          logger.error('Contracts not deployed on this network')
          return false
        }
      }

      dexAddress.value = dexNetworks[networkIdStr].address
      daiAddress.value = daiNetworks[networkIdStr].address
      logger.log('DEX address:', dexAddress.value)
      logger.log('DAI address:', daiAddress.value)

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

      // Initialize TimeLock contract from artifact (same as other contracts)
      if (timeLockNetworks[networkIdStr]) {
        timeLockAddress.value = timeLockNetworks[networkIdStr].address
        timeLockContract.value = new Contract(
          timeLockAddress.value,
          TimeLockABI.abi,
          web3Store.signer
        )
        logger.log('TimeLock address:', timeLockAddress.value)
      } else {
        logger.warn('TimeLock contract not deployed on this network')
      }

      return true
    } catch (err) {
      logger.error('Failed to init contracts:', err)
      return false
    }
  }

  /** Clears contract instances and addresses. */
  function reset() {
    dexContract.value = null
    daiContract.value = null
    timeLockContract.value = null
    dexAddress.value = ''
    daiAddress.value = ''
    timeLockAddress.value = ''
  }

  /**
   * Set TimeLock contract address manually
   * @param address The deployed TimeLock contract address
   */
  function setTimeLockAddress(address: string) {
    if (!web3Store.signer) {
      logger.error('Web3 not connected')
      return false
    }

    try {
      timeLockAddress.value = address
      timeLockContract.value = new Contract(
        address,
        TimeLockABI.abi,
        web3Store.signer
      )
      localStorage.setItem('zkdex_timelock_address', address)
      logger.log('TimeLock contract set:', address)
      return true
    } catch (err) {
      logger.error('Failed to set TimeLock contract:', err)
      return false
    }
  }

  return {
    dexContract,
    daiContract,
    timeLockContract,
    dexAddress,
    daiAddress,
    timeLockAddress,
    isInitialized,
    initContracts,
    setTimeLockAddress,
    reset
  }
})
