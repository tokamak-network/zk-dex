<template>
  <div>
    <div>
      <p style="margin-top: 12px;">DAI Amount: {{ formatDaiAmount }} DAI</p>
      <p style="margin-top: 12px;">ZkDex address: {{ contractStore.dexAddress }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { formatEther } from 'ethers'
import { useWeb3Store } from '@/stores/web3'
import { useContractStore } from '@/stores/contract'
import { useOrderStore } from '@/stores/order'

const web3Store = useWeb3Store()
const contractStore = useContractStore()
const orderStore = useOrderStore()

const formatDaiAmount = computed(() => {
  if (!orderStore.daiAmount || orderStore.daiAmount === '0') return '0'
  const full = formatEther(orderStore.daiAmount)
  const dot = full.indexOf('.')
  if (dot === -1) return full
  // Show up to 4 decimal places
  return full.slice(0, dot + 5)
})

async function updateDaiAmount() {
  if (!contractStore.daiContract || !web3Store.account) return
  try {
    const daiAmount = await contractStore.daiContract.balanceOf(web3Store.account)
    orderStore.setDaiAmount(daiAmount.toString())
  } catch (err) {
    console.error('Failed to get DAI balance:', err)
  }
}

onMounted(async () => {
  if (web3Store.isConnected && !contractStore.isInitialized) {
    await contractStore.initContracts()
    await updateDaiAmount()
  }
})

watch(() => contractStore.isInitialized, async (isInitialized) => {
  if (isInitialized) {
    await updateDaiAmount()
  }
})
</script>

<style scoped></style>
