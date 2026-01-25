<template>
  <div>
    <AccountList :accounts="accounts" />
    <NoteListTransferHistory :transferNotes="displayNotes" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAccountStore } from '@/stores/account'
import AccountList from '@/components/AccountList.vue'
import NoteListTransferHistory from '@/components/NoteListTransferHistory.vue'
import * as api from '@/api'
import type { Account } from '@/stores/account'
import type { TransferNote } from '@/stores/note'

const accountStore = useAccountStore()

const accounts = ref<Account[]>([])
const transferNotes = ref<TransferNote[]>([])

const displayNotes = computed(() => {
  return transferNotes.value.map(note => ({
    hash: note.hash,
    type: note.type,
    token: note.token,
    value: note.value,
    from: note.from,
    to: note.to
  }))
})

onMounted(async () => {
  const fetchedAccounts = await api.getAccounts(accountStore.key!)
  if (fetchedAccounts) {
    accounts.value = fetchedAccounts
    const allTransferNotes: TransferNote[] = []
    for (const account of fetchedAccounts) {
      const n = await api.getTransferNotes(account.address)
      if (n) {
        allTransferNotes.push(...n)
      }
    }
    transferNotes.value = allTransferNotes
  }
})
</script>
