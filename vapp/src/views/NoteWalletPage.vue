<template>
  <div>
    <NoteBalanceList :notes="noteStore.notes" />
    <NoteList :notes="noteStore.notes" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useAccountStore } from '@/stores/account'
import { useContractStore } from '@/stores/contract'
import { useNoteStore } from '@/stores/note'
import NoteBalanceList from '@/components/NoteBalanceList.vue'
import NoteList from '@/components/NoteList.vue'

const accountStore = useAccountStore()
const contractStore = useContractStore()
const noteStore = useNoteStore()

onMounted(async () => {
  if (accountStore.accounts.length === 0) {
    await accountStore.loadAccounts()
  }
  if (contractStore.isInitialized && noteStore.notes.length === 0) {
    await noteStore.loadNotes()
  }
})

// Watch for contract initialization to load notes
watch(() => contractStore.isInitialized, async (isInitialized) => {
  if (isInitialized && noteStore.notes.length === 0) {
    await noteStore.loadNotes()
  }
})
</script>
