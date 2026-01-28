<template>
  <div>
    <div class="fetch-section">
      <button
        class="button is-info"
        :class="{ 'is-loading': noteStore.isScanning }"
        @click="handleFetchAll"
        :disabled="noteStore.isScanning || !contractStore.isInitialized"
      >
        <span class="icon" v-if="!noteStore.isScanning">
          <i class="fas fa-sync-alt"></i>
        </span>
        <span>Fetch All Notes</span>
      </button>
      <span v-if="!contractStore.isInitialized" class="help is-warning">
        Connect wallet to fetch notes
      </span>
      <span v-else-if="rawEventCount > 0" class="help">
        {{ rawEventCount }} raw events in storage
      </span>
    </div>

    <NoteBalanceList :notes="noteStore.notes" :accounts="accountStore.accounts || []" />
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
import { getRawNoteEvents } from '@/api'
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
const rawEventCount = ref(0)

// Update raw event count on mount
function updateRawEventCount() {
  const events = getRawNoteEvents()
  rawEventCount.value = Object.keys(events).length
}

async function handleFetchAll() {
  await noteStore.fetchAllNoteEvents()
  updateRawEventCount()
}

// Filter notes by selected account, or show all if none selected
const filteredNotes = computed(() => {
  const allNotes = noteStore.notes || []
  if (!selectedAccount.value) {
    return allNotes
  }
  return allNotes.filter(note => note.owner === selectedAccount.value!.address)
})

onMounted(async () => {
  try {
    // Always load accounts if not loaded yet
    if (accountStore.accounts.length === 0) {
      await accountStore.loadAccounts()
    }
    // Update raw event count from localStorage
    updateRawEventCount()
    // If there are raw events in localStorage, decrypt and display them
    if (rawEventCount.value > 0) {
      await noteStore.decryptAndDisplayNotes()
    }
    // Auto-fetch notes if contract is already initialized
    if (contractStore.isInitialized) {
      await handleFetchAll()
    }
  } catch (err) {
    console.error('Failed to load data:', err)
  }
})

// Auto-fetch notes when contract becomes initialized
watch(() => contractStore.isInitialized, async (initialized) => {
  if (initialized) {
    await handleFetchAll()
  }
})

// Watch for account unlocks to re-decrypt notes
watch(
  () => accountStore.accounts.map(a => a.secretKey).filter(Boolean).length,
  async (unlockedCount, prevCount) => {
    console.log('[watcher] unlocked count changed:', prevCount, '->', unlockedCount, 'rawEvents:', rawEventCount.value)
    if (unlockedCount > prevCount && rawEventCount.value > 0) {
      console.log('Account unlocked, re-decrypting notes...')
      await noteStore.decryptAndDisplayNotes()
    }
  }
)

// Also watch the store-level secretKey
watch(
  () => accountStore.secretKey,
  async (newSk, oldSk) => {
    if (newSk && !oldSk && rawEventCount.value > 0) {
      console.log('Account unlocked (store level), re-decrypting notes...')
      await noteStore.decryptAndDisplayNotes()
    }
  }
)

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
.fetch-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.fetch-section .button {
  display: flex;
  align-items: center;
  gap: 6px;
}

.fetch-section .help {
  margin: 0;
  font-size: 0.85em;
}

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
