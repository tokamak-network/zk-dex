<template>
  <div class="box">
    <div class="header-row">
      <p style="margin-left: 10px; margin-bottom: 0;">Recent Note Transfer</p>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>Note</th>
          <th>Type</th>
          <th>Token</th>
          <th>Value</th>
          <th>From</th>
          <th>To</th>
          <th>Change</th>
          <th>Transaction</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="note in visibleTransferNotes" :key="note.hash + note.type">
          <td>{{ fmt.abbreviate(note.hash) }}</td>
          <td>{{ fmt.transferNoteType(note.type) }}</td>
          <td>{{ fmt.tokenType(note.token) }}</td>
          <td>{{ fmt.formatNoteValue(note.value) }}</td>
          <td>{{ fmt.formatZkPk(addressToPk(note.from || '')) }}</td>
          <td>{{ fmt.formatZkPk(addressToPk(note.to || '')) }}</td>
          <td>{{ note.change ? fmt.formatNoteValue(note.change) : '' }}</td>
          <td>{{ fmt.abbreviate(note.transactionHash || '') }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="hiddenCount > 0" class="help" style="text-align: center; margin-top: 10px;">
      {{ hiddenCount }} records hidden (unlock accounts to view)
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFormatters } from '@/composables/useFormatters'
import { useAccountStore } from '@/stores/account'

interface TransferNoteDisplay {
  hash: string
  type: string
  token: string
  value: string
  from?: string
  to?: string
  change?: string
  transactionHash?: string
}

const props = defineProps<{
  transferNotes: TransferNoteDisplay[]
}>()

const fmt = useFormatters()
const accountStore = useAccountStore()

// Get unlocked account addresses
const unlockedAddresses = computed(() => {
  const addresses = new Set<string>()
  for (const account of accountStore.accounts) {
    if (account.secretKey) {
      addresses.add(account.address)
    }
  }
  if (accountStore.secretKey && accountStore.currentAccount) {
    addresses.add(accountStore.currentAccount.address)
  }
  return addresses
})

// Filter transfer notes - show only if from OR to is an unlocked account
const visibleTransferNotes = computed(() => {
  return props.transferNotes.filter(note => {
    const fromUnlocked = note.from && unlockedAddresses.value.has(note.from)
    const toUnlocked = note.to && unlockedAddresses.value.has(note.to)
    return fromUnlocked || toUnlocked
  })
})

const hiddenCount = computed(() => {
  return props.transferNotes.length - visibleTransferNotes.value.length
})

function addressToPk(addr: string) {
  if (!addr) return undefined
  const acc = accountStore.accounts.find(a => a.address === addr)
  return acc?.publicKey
}
</script>

<style scoped>
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
</style>
