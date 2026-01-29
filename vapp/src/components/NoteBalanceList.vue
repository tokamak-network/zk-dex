<template>
  <div class="box" style="text-align: center;">
    <div v-if="web3Store.account" class="wallet-info" style="text-align: left; margin-bottom: 10px; padding: 8px 10px; background: #f5f5f5; border-radius: 4px; font-size: 0.85em; color: #555;">
      <span style="margin-right: 15px;">{{ web3Store.account }}</span>
      <span style="margin-right: 15px;">ETH: {{ formatEthBalance }}</span>
      <span>DAI: {{ formatDaiBalance }}</span>
      <button
        class="button is-small is-link is-light"
        style="margin-left: 8px; padding: 0 8px; height: 22px; font-size: 0.75em;"
        :disabled="isMinting"
        @click="mintDai"
      >
        {{ isMinting ? 'Minting...' : 'Faucet (+100)' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { formatEther } from 'ethers'
import { useWeb3Store } from '@/stores/web3'
import { useContractStore } from '@/stores/contract'

const web3Store = useWeb3Store()
const contractStore = useContractStore()

const daiBalance = ref('0')
const isMinting = ref(false)

const formatDaiBalance = computed(() => {
  if (daiBalance.value === '0') return '0'
  const full = formatEther(daiBalance.value)
  const dot = full.indexOf('.')
  if (dot === -1) return full
  return full.slice(0, dot + 4)
})

const formatEthBalance = computed(() => {
  if (!web3Store.balance) return '0'
  const full = formatEther(web3Store.balance)
  const dot = full.indexOf('.')
  if (dot === -1) return full
  return full.slice(0, dot + 4) // 소수점 3자리
})

async function mintDai() {
  if (!contractStore.daiContract) return
  isMinting.value = true
  try {
    const tx = await contractStore.daiContract.mint()
    await tx.wait()
    await loadDaiBalance()
  } catch (err) {
    console.error('Failed to mint DAI:', err)
  } finally {
    isMinting.value = false
  }
}

async function loadDaiBalance() {
  if (!contractStore.daiContract || !web3Store.account) return
  try {
    const bal = await contractStore.daiContract.balanceOf(web3Store.account)
    daiBalance.value = bal.toString()
  } catch {
    daiBalance.value = '0'
  }
}

onMounted(() => {
  loadDaiBalance()
})

watch(() => contractStore.isInitialized, (initialized) => {
  if (initialized) loadDaiBalance()
})
</script>
