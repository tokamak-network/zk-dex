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
  // Load accounts from browser localStorage
  accountStore.loadAccounts()
  accounts.value = accountStore.accounts

  // Load transfer notes for all accounts
  const allTransferNotes: TransferNote[] = []
  for (const account of accounts.value) {
    try {
      const n = await api.getTransferNotes(account.address)
      if (n) {
        allTransferNotes.push(...n)
      }
    } catch (err) {
      console.warn('Failed to load transfer notes for account:', account.address, err)
    }
  }
  transferNotes.value = allTransferNotes
})
</script>
