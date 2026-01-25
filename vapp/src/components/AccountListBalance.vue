<template>
  <div style="text-align: center;">
    <h2 style="margin-bottom: 20px;">Account Balance</h2>
    <table class="table">
      <thead>
        <tr>
          <th>Currency Name</th>
          <th>Symbol</th>
          <th>Total Notes</th>
          <th>Available Balance</th>
          <th>Reserved</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="account in accounts"
          :key="account.address"
          @click="selectAccount(account)"
          :class="{ 'is-selected': account === selectedAccount }"
        >
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Account } from '@/stores/account'

interface BalanceAccount extends Account {
  [key: string]: unknown
}

const accounts = ref<BalanceAccount[]>([])
const selectedAccount = ref<BalanceAccount | null>(null)

function selectAccount(account: BalanceAccount) {
  selectedAccount.value = account
}

onMounted(() => {
  accounts.value.push({
    address: '',
    publicKey: { x: '', y: '' },
    '1': 1,
    '2': 2,
    '3': 3,
  })
})
</script>
