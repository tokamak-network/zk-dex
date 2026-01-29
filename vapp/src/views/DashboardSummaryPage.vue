<template>
  <div>
    <AccountList :accounts="accountStore.accounts || []" :selectedAccount="selectedAccount" @selectAccount="handleSelectAccount" />

    <div class="note-view-tabs">
      <button
        class="tab-btn"
        :class="{ active: noteViewTab === 'tree' }"
        @click="noteViewTab = 'tree'"
      >Note Tree</button>
      <button
        class="tab-btn"
        :class="{ active: noteViewTab === 'list' }"
        @click="noteViewTab = 'list'"
      >Note List</button>
    </div>

    <NoteTree v-if="noteViewTab === 'tree'" :notes="filteredNotes" :currentAccount="web3Account" @issue-note="handleIssueNote" @transfer-note="handleTransferNote" @redeem-note="handleRedeemNote" />
    <NoteList v-else :notes="filteredNotes" @selectNote="handleSelectNote" />

    <NoteListTransferHistory :transferNotes="noteStore.transferNotes || []" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAccountStore, type Account } from '@/stores/account'
import { useContractStore } from '@/stores/contract'
import { useNoteStore, type Note } from '@/stores/note'
import { useWeb3Store } from '@/stores/web3'
import AccountList from '@/components/AccountList.vue'
import NoteList from '@/components/NoteList.vue'
import NoteListTransferHistory from '@/components/NoteListTransferHistory.vue'
import NoteTree from '@/components/NoteTree.vue'

const router = useRouter()
const accountStore = useAccountStore()
const contractStore = useContractStore()
const noteStore = useNoteStore()
const web3Store = useWeb3Store()

const selectedAccount = ref<Account | null>(null)
const web3Account = computed(() => web3Store.account)
const noteViewTab = ref<'tree' | 'list'>('tree')

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
    // Decrypt and display notes from localStorage if any
    await noteStore.decryptAndDisplayNotes()
    // Auto-fetch notes if contract is already initialized
    if (contractStore.isInitialized) {
      await noteStore.fetchAllNoteEvents()
    }
  } catch (err) {
    console.error('Failed to load data:', err)
  }
})

// Auto-fetch notes when contract becomes initialized
watch(() => contractStore.isInitialized, async (initialized) => {
  if (initialized) {
    await noteStore.fetchAllNoteEvents()
  }
})

// Watch for account unlocks to re-decrypt notes
watch(
  () => accountStore.accounts.map(a => a.secretKey).filter(Boolean).length,
  async (unlockedCount, prevCount) => {
    if (unlockedCount > prevCount) {
      console.log('Account unlocked, re-decrypting notes...')
      await noteStore.decryptAndDisplayNotes()
    }
  }
)

// Also watch the store-level secretKey
watch(
  () => accountStore.secretKey,
  async (newSk, oldSk) => {
    if (newSk && !oldSk) {
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

interface SelectedNoteData {
  hash: string
  value: string
  token: string
  state: string
  owner: string
}

function handleIssueNote(createdBy: string) {
  // Navigate to wallet page with mint tab
  router.push({ path: '/wallet', query: { action: 'mint', token: 'ETH' } })
}

function handleTransferNote(noteData: SelectedNoteData) {
  console.log('[DashboardSummaryPage] handleTransferNote called with:', noteData)
  console.log('[DashboardSummaryPage] Navigating to /wallet with action=transfer')
  // Navigate to wallet page with transfer tab and note hash
  router.push({ path: '/wallet', query: { action: 'transfer', noteHash: noteData.hash } })
}

function handleRedeemNote(noteData: SelectedNoteData) {
  // Navigate to wallet page with redeem tab and note hash
  router.push({ path: '/wallet', query: { action: 'redeem', noteHash: noteData.hash } })
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
