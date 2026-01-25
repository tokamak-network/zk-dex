<template>
  <div>
    <NoteBalanceList :notes="filteredNotes" :accounts="accountStore.accounts || []" />
    <AccountList :accounts="accountStore.accounts || []" :selectedAccount="selectedAccount" @selectAccount="handleSelectAccount" />
    <NoteList :notes="filteredNotes" @selectNote="handleSelectNote" />
    <NoteListTransferHistory :transferNotes="noteStore.transferNotes || []" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAccountStore, type Account } from '@/stores/account'
import { useContractStore } from '@/stores/contract'
import { useNoteStore, type Note } from '@/stores/note'
import AccountList from '@/components/AccountList.vue'
import NoteList from '@/components/NoteList.vue'
import NoteBalanceList from '@/components/NoteBalanceList.vue'
import NoteListTransferHistory from '@/components/NoteListTransferHistory.vue'

const accountStore = useAccountStore()
const contractStore = useContractStore()
const noteStore = useNoteStore()

const selectedAccount = ref<Account | null>(null)

// Filter notes by selected account, or show all if none selected
const filteredNotes = computed(() => {
  if (!selectedAccount.value) {
    return noteStore.notes || []
  }
  return (noteStore.notes || []).filter(note => note.owner === selectedAccount.value!.address)
})

onMounted(async () => {
  try {
    // Always load accounts if not loaded yet
    if (accountStore.accounts.length === 0) {
      await accountStore.loadAccounts()
    }
    // Only load notes if contract is initialized
    if (contractStore.isInitialized && noteStore.notes.length === 0) {
      await noteStore.loadNotes()
    }
    // Always load transfer notes if not loaded yet
    if (noteStore.transferNotes.length === 0) {
      await noteStore.loadTransferNotes()
    }
  } catch (err) {
    console.error('Failed to load data:', err)
  }
})

// Watch for contract initialization to load notes
watch(() => contractStore.isInitialized, async (isInitialized) => {
  if (isInitialized && noteStore.notes.length === 0) {
    await noteStore.loadNotes()
  }
})

function handleSelectAccount(account: Account) {
  // Toggle selection - clicking same account deselects it
  if (selectedAccount.value?.address === account.address) {
    selectedAccount.value = null
  } else {
    selectedAccount.value = account
  }
  accountStore.setCurrentAccount(account)
}

function handleSelectNote(note: Note) {
  noteStore.setSelectedNote(note)
}
</script>
