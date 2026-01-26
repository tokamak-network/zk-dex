<template>
  <div>
    <NoteBalanceList :notes="filteredNotes" :accounts="accountStore.accounts || []" />
    <AccountList :accounts="accountStore.accounts || []" :selectedAccount="selectedAccount" @selectAccount="handleSelectAccount" />

    <div class="note-view-tabs">
      <button
        class="tab-btn"
        :class="{ active: noteViewTab === 'list' }"
        @click="noteViewTab = 'list'"
      >Note List</button>
      <button
        class="tab-btn"
        :class="{ active: noteViewTab === 'tree' }"
        @click="noteViewTab = 'tree'"
      >Note Tree</button>
    </div>

    <NoteList v-if="noteViewTab === 'list'" :notes="filteredNotes" @selectNote="handleSelectNote" />
    <NoteTree v-else :notes="filteredNotes" />

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
import NoteTree from '@/components/NoteTree.vue'

const accountStore = useAccountStore()
const contractStore = useContractStore()
const noteStore = useNoteStore()

const selectedAccount = ref<Account | null>(null)
const noteViewTab = ref<'list' | 'tree'>('list')

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

<style scoped>
.note-view-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 0;
}

.tab-btn {
  padding: 8px 20px;
  border: 1px solid #ddd;
  border-bottom: none;
  background: #f5f5f5;
  color: #666;
  cursor: pointer;
  font-size: 0.9em;
  border-radius: 4px 4px 0 0;
  transition: background 0.15s, color 0.15s;
}

.tab-btn.active {
  background: #fff;
  color: #363636;
  font-weight: 600;
  border-color: #ddd;
  position: relative;
  z-index: 1;
  margin-bottom: -1px;
  padding-bottom: 9px;
}

.tab-btn:not(.active):hover {
  background: #e8e8e8;
}
</style>
