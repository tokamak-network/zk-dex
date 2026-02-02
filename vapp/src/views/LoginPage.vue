<template>
  <div style="padding: 50px; max-width: 600px; margin: 0 auto;">
    <div class="box">
      <h1 class="title">Welcome to ZK-DEX</h1>
      <p class="subtitle">Zero-Knowledge Decentralized Exchange</p>

      <div v-if="!hasAccounts" style="margin-top: 30px;">
        <p style="margin-bottom: 20px;">No accounts found. Create your first account to get started.</p>
        <button class="button is-link is-large" @click="goToDashboard">
          Create Account
        </button>
      </div>

      <div v-else style="margin-top: 30px;">
        <p style="margin-bottom: 20px;">Found {{ accountStore.accounts.length }} account(s). Go to dashboard to unlock and manage your accounts.</p>
        <button class="button is-link is-large" @click="goToDashboard">
          Go to Dashboard
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAccountStore } from '@/stores/account'

const router = useRouter()
const accountStore = useAccountStore()

const hasAccounts = ref(false)

onMounted(async () => {
  // Initialize crypto module
  await accountStore.initializeCrypto()

  // Load accounts from localStorage
  accountStore.loadAccounts()
  hasAccounts.value = accountStore.accounts.length > 0

  // If accounts exist and at least one is unlocked, go straight to dashboard
  const hasUnlockedAccount = accountStore.accounts.some(acc => acc.secretKey)
  if (hasUnlockedAccount) {
    router.push({ path: '/' })
  }
})

function goToDashboard() {
  router.push({ path: '/' })
}
</script>

<style scoped>
.box {
  text-align: center;
}
</style>
