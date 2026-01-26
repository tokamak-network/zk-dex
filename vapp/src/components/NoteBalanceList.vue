<template>
  <div class="box" style="text-align: center;">
    <div v-if="web3Store.account" class="wallet-info" style="text-align: left; margin-bottom: 10px; padding: 8px 10px; background: #f5f5f5; border-radius: 4px; font-size: 0.85em; color: #555;">
      <span style="margin-right: 15px;">{{ fmt.abbreviate(web3Store.account) }}</span>
      <span style="margin-right: 15px;">ETH: {{ formatEthBalance }}</span>
      <span>DAI: {{ daiBalance }}</span>
    </div>
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
            <router-link :to="{ path: '/notes', query: { action: 'mint', token: token.symbol } }" class="button is-small is-primary">Issue</router-link>
            <router-link :to="{ path: '/notes', query: { action: 'liquidate', token: token.symbol } }" class="button is-small is-warning" style="margin-left: 5px;">Redeem</router-link>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { toBigInt, formatEther } from 'ethers'
import { useFormatters } from '@/composables/useFormatters'
import { useWeb3Store } from '@/stores/web3'
import { useContractStore } from '@/stores/contract'
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
const web3Store = useWeb3Store()
const contractStore = useContractStore()
const noteStore = useNoteStore()

const isRefreshing = computed(() => noteStore.isScanning)
const daiBalance = ref('0')

const formatEthBalance = computed(() => {
  if (!web3Store.balance) return '0'
  const full = formatEther(web3Store.balance)
  const dot = full.indexOf('.')
  if (dot === -1) return full
  return full.slice(0, dot + 4) // 소수점 3자리
})

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

async function refreshNotes() {
  await noteStore.scanBlockchainNotes()
  await loadDaiBalance()
  await web3Store.updateBalance()
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
