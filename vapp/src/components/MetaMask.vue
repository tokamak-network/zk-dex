<template>
  <div>
    <p>Network: {{ networkName }}</p>
    <p>Account: {{ web3Store.account || 'Not connected' }}</p>
    <p>ETH: {{ formattedBalance }}</p>
    <p v-if="web3Store.error" style="color: red;">Error: {{ web3Store.error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { formatEther } from 'ethers'
import { useWeb3Store } from '@/stores/web3'
import { useContractStore } from '@/stores/contract'
import { useOrderStore } from '@/stores/order'

const NETWORKS: Record<string, string> = {
  '1': 'Main Net',
  '2': 'Deprecated Morden test network',
  '3': 'Ropsten test network',
  '4': 'Rinkeby test network',
  '42': 'Kovan test network',
  '1337': 'Ganache Network',
  '4447': 'Truffle Develop Network',
  '5777': 'Ganache Blockchain',
  '31337': 'Hardhat Network',
}

const web3Store = useWeb3Store()
const contractStore = useContractStore()
const orderStore = useOrderStore()

const networkName = computed(() => {
  if (!web3Store.networkId) return 'Not Connected'
  return NETWORKS[web3Store.networkId.toString()] || `Unknown (${web3Store.networkId})`
})

const formattedBalance = computed(() => {
  if (!web3Store.balance) return '0 ETH'
  return formatEther(web3Store.balance) + ' ETH'
})

let pollingInterval: ReturnType<typeof setInterval> | null = null

async function updateDaiAmount() {
  if (!contractStore.daiContract || !web3Store.account) return
  try {
    const daiAmount = await contractStore.daiContract.balanceOf(web3Store.account)
    orderStore.setDaiAmount(daiAmount.toString())
  } catch (err) {
    console.error('Failed to get DAI balance:', err)
  }
}

function startPolling() {
  pollingInterval = setInterval(async () => {
    await web3Store.updateBalance()
    await updateDaiAmount()
  }, 5000) // 5 seconds instead of 500ms for performance
}

onMounted(async () => {
  const connected = await web3Store.connect()
  if (connected) {
    await contractStore.initContracts()
    await updateDaiAmount()
    startPolling()
  }
})

onUnmounted(() => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
  }
})
</script>

<style scoped></style>
