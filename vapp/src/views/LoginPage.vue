<template>
  <div style="padding: 50px; max-width: 600px; margin: 0 auto;">
    <div class="box">
      <h1 class="title">Welcome to ZK-DEX</h1>
      <p class="subtitle">Zero-Knowledge Decentralized Exchange</p>

      <div style="margin-top: 30px;">
        <p style="margin-bottom: 20px;">Connect your MetaMask wallet to get started.</p>
        <button
          class="button is-link is-large"
          @click="connectMetaMask"
          :disabled="isConnecting"
          :class="{ 'is-loading': isConnecting }"
        >
          {{ isConnecting ? 'Connecting...' : 'Connect MetaMask' }}
        </button>
        <p v-if="connectionError" style="margin-top: 15px; color: #f14668;">
          {{ connectionError }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAccountStore } from '@/stores/account'
import { useWeb3Store } from '@/stores/web3'

const router = useRouter()
const accountStore = useAccountStore()
const web3Store = useWeb3Store()

const hasAccounts = ref(false)
const isConnecting = ref(false)
const connectionError = ref('')

onMounted(async () => {
  // Initialize crypto module
  await accountStore.initializeCrypto()

  // Load accounts from localStorage
  accountStore.loadAccounts()
  hasAccounts.value = accountStore.accounts.length > 0

  // If already connected and has unlocked account, go straight to dashboard
  if (web3Store.isConnected) {
    const hasUnlockedAccount = accountStore.accounts.some(acc => acc.secretKey)
    if (hasUnlockedAccount) {
      router.push({ path: '/' })
    }
  }
})

async function connectMetaMask() {
  isConnecting.value = true
  connectionError.value = ''

  try {
    const success = await web3Store.connect()
    if (success) {
      // Connection successful, go to dashboard immediately
      console.log('[LoginPage] MetaMask connected, navigating to dashboard')
      await router.push({ path: '/' })
    } else {
      connectionError.value = web3Store.error || 'Failed to connect to MetaMask'
      isConnecting.value = false
    }
  } catch (err) {
    connectionError.value = (err as Error).message
    isConnecting.value = false
  }
}

function goToDashboard() {
  console.log('[LoginPage] goToDashboard called')
  router.push({ path: '/' })
}
</script>

<style scoped>
.box {
  text-align: center;
}
</style>
