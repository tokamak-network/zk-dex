<template>
  <div>
    <NoteTransfer ref="noteTransferRef" :notes="noteStore.notes" />
    <NoteList :notes="noteStore.notes" @selectNote="handleSelectNote" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAccountStore } from '@/stores/account'
import { useContractStore } from '@/stores/contract'
import { useNoteStore, type Note } from '@/stores/note'
import NoteList from '@/components/NoteList.vue'
import NoteTransfer from '@/components/NoteTransfer.vue'

const accountStore = useAccountStore()
const contractStore = useContractStore()
const noteStore = useNoteStore()

const noteTransferRef = ref<InstanceType<typeof NoteTransfer> | null>(null)

function handleSelectNote(note: Note) {
  noteTransferRef.value?.selectNote(note)
}

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
