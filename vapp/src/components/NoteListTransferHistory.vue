<template>
  <div class="box">
    <div class="header-row">
      <p style="margin-left: 10px; margin-bottom: 0;">Recent Transaction</p>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>Transaction</th>
          <th>Type</th>
          <th>Token</th>
          <th>Value</th>
          <th>From</th>
          <th>To</th>
          <th>Change</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="note in transferNotes" :key="note.hash + note.type">
          <td>{{ fmt.abbreviate(note.transactionHash || '') }}</td>
          <td>{{ fmt.transferNoteType(note.type) }}</td>
          <td>{{ fmt.tokenType(note.token) }}</td>
          <td>{{ fmt.formatNoteValue(note.value) }}</td>
          <td>{{ formatFromPk(note) }}</td>
          <td>{{ formatToPk(note) }}</td>
          <td>{{ note.change ? fmt.formatNoteValue(note.change) : '' }}</td>
          <td>{{ fmt.abbreviate(note.hash) }}</td>
        </tr>
      </tbody>
    </table>
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
  fromPk?: { x: string; y: string }
  toPk?: { x: string; y: string }
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

// Format From pk - show ** if account is not unlocked
function formatFromPk(note: TransferNoteDisplay): string {
  if (!note.from && !note.fromPk) return ''

  // If from address is unlocked, show the pk
  if (note.from && unlockedAddresses.value.has(note.from)) {
    const pk = note.fromPk || addressToPk(note.from)
    if (pk) return fmt.formatZkPk(pk)
  }

  // If from address exists but not unlocked, mask it
  if (note.from) return '**'

  return ''
}

// Format To pk - show ** if account is not unlocked
function formatToPk(note: TransferNoteDisplay): string {
  if (!note.to && !note.toPk) return ''

  // If to address is unlocked, show the pk
  if (note.to && unlockedAddresses.value.has(note.to)) {
    const pk = note.toPk || addressToPk(note.to)
    if (pk) return fmt.formatZkPk(pk)
  }

  // If to address exists but not unlocked, mask it
  if (note.to) return '**'

  return ''
}

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
