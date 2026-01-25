<template>
  <div class="box" style="text-align: center;">
    <div style="float: left; display: flex; align-items: center; gap: 10px;">
      <p style="margin-left: 10px;">Total Note Balance</p>
      <button
        class="button is-small is-light"
        :class="{ 'is-loading': isRefreshing }"
        @click="refreshNotes"
        title="Scan blockchain for notes"
      >
        Refresh
      </button>
    </div>
    <div style="float: right;" v-if="route.path === '/combine'">
      <section>
        <o-select placeholder="Select Account" v-model="selectedAccount">
          <option v-for="account in accounts" :key="account.address" :value="account">
            {{ fmt.abbreviateZk(account.address) }}
          </option>
        </o-select>
      </section>
    </div>
    <table class="table" style="margin-top: 40px;">
      <thead>
        <tr>
          <th>Currency Name</th>
          <th>Symbol</th>
          <th>Total Notes</th>
          <th>Total Value</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="token in tokens" :key="token.type">
          <td>{{ token.name }}</td>
          <td>{{ token.symbol }}</td>
          <td>{{ totalNotes(token.type) }}</td>
          <td>{{ totalValue(token.type) }}</td>
          <td v-if="route.path === '/' || route.path === ''">
            <router-link :to="{ path: '/notes', query: { action: 'mint', token: token.symbol } }" class="button is-small is-primary">Create</router-link>
            <router-link :to="{ path: '/notes', query: { action: 'liquidate', token: token.symbol } }" class="button is-small is-warning" style="margin-left: 5px;">Liquidate</router-link>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { toBigInt } from 'ethers'
import { useFormatters } from '@/composables/useFormatters'
import { useNoteStore, type Note } from '@/stores/note'
import type { Account } from '@/stores/account'

interface Token {
  type: string
  name: string
  symbol: string
  totalNotes: number
}

const props = defineProps<{
  accounts?: Account[]
  notes: Note[] | null
}>()

const emit = defineEmits<{
  selectAccount: [account: Account]
}>()

const route = useRoute()
const fmt = useFormatters()
const noteStore = useNoteStore()

const isRefreshing = computed(() => noteStore.isScanning)

async function refreshNotes() {
  await noteStore.scanBlockchainNotes()
}

const tokens = ref<Token[]>([
  { type: '0', name: 'Ethereum', symbol: 'ETH', totalNotes: 0 },
  { type: '1', name: 'Dai', symbol: 'DAI', totalNotes: 0 },
])

const selectedAccount = ref<Account | null>(null)

function totalNotes(type: string): number {
  if (!props.notes) return 0
  return props.notes.filter(n => {
    const t = fmt.hexToNumberString(n.token)
    return t === type && n.state === '0x1' // VALID notes only
  }).length
}

function totalValue(type: string): string {
  if (!props.notes) return '0'
  const sum = props.notes
    .filter(n => {
      const t = fmt.hexToNumberString(n.token)
      return t === type && n.state === '0x1' // VALID notes only
    })
    .reduce((acc, n) => acc + toBigInt(n.value), BigInt(0))
  return sum.toString()
}

watch(selectedAccount, (newAccount) => {
  if (newAccount) {
    emit('selectAccount', newAccount)
  }
})
</script>
