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

    <NoteTree v-if="noteViewTab === 'tree'" :notes="filteredNotes" :currentAccount="web3Account" :accounts="accountStore.accounts" @issue-note="handleIssueNote" @transfer-note="handleTransferNote" @redeem-note="handleRedeemNote" />
    <NoteList v-else :notes="filteredNotes" @selectNote="handleSelectNote" />

    <NoteListTransferHistory :transferNotes="noteStore.transferNotes || []" />

    <!-- Modal Overlay -->
    <div v-if="activeModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-container">
        <div class="modal-header">
          <h3 class="modal-title">
            {{ activeModal === 'mint' ? 'Issue Note' : activeModal === 'transfer' ? 'Transfer Note' : 'Redeem Note' }}
          </h3>
          <button class="modal-close" @click="closeModal">&times;</button>
        </div>
        <div class="modal-body">
          <NoteMint v-if="activeModal === 'mint'" :accounts="accountStore.accounts" :initial-account-address="selectedAccountForMint" @complete="closeModal" />
          <NoteTransfer v-else-if="activeModal === 'transfer'" ref="transferRef" @complete="closeModal" />
          <NoteLiquidate v-else-if="activeModal === 'redeem'" ref="redeemRef" @complete="closeModal" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useAccountStore, type Account } from '@/stores/account'
import { useContractStore } from '@/stores/contract'
import { useNoteStore, type Note } from '@/stores/note'
import { useWeb3Store } from '@/stores/web3'
import AccountList from '@/components/AccountList.vue'
import NoteList from '@/components/NoteList.vue'
import NoteListTransferHistory from '@/components/NoteListTransferHistory.vue'
import NoteTree from '@/components/NoteTree.vue'
import NoteMint from '@/components/NoteMint.vue'
import NoteTransfer from '@/components/NoteTransfer.vue'
import NoteLiquidate from '@/components/NoteLiquidate.vue'

const accountStore = useAccountStore()
const contractStore = useContractStore()
const noteStore = useNoteStore()
const web3Store = useWeb3Store()

const selectedAccount = ref<Account | null>(null)
const web3Account = computed(() => web3Store.account)
const noteViewTab = ref<'tree' | 'list'>('tree')

// Modal state
const activeModal = ref<'mint' | 'transfer' | 'redeem' | null>(null)
const selectedAccountForMint = ref<string>('')
const transferRef = ref<InstanceType<typeof NoteTransfer> | null>(null)
const redeemRef = ref<InstanceType<typeof NoteLiquidate> | null>(null)

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

function closeModal() {
  activeModal.value = null
  selectedAccountForMint.value = ''
  // Refresh notes after action completes
  noteStore.fetchAllNoteEvents()
  noteStore.decryptAndDisplayNotes()
}

function handleIssueNote(createdBy: string) {
  console.log('[Dashboard] handleIssueNote received:', createdBy)
  // Store the account address and open mint modal
  selectedAccountForMint.value = createdBy
  console.log('[Dashboard] selectedAccountForMint set to:', selectedAccountForMint.value)
  activeModal.value = 'mint'
  console.log('[Dashboard] activeModal set to:', activeModal.value)
}

async function handleTransferNote(noteData: SelectedNoteData) {
  // Find full note object
  const note = noteStore.notes.find(n => n.hash === noteData.hash)
  if (!note) {
    console.error('Note not found:', noteData.hash)
    return
  }

  // Open transfer modal and pass the note
  activeModal.value = 'transfer'
  await nextTick()
  transferRef.value?.selectNote(note)
}

async function handleRedeemNote(noteData: SelectedNoteData) {
  // Find full note object
  const note = noteStore.notes.find(n => n.hash === noteData.hash)
  if (!note) {
    console.error('Note not found:', noteData.hash)
    return
  }

  // Open redeem modal and pass the note
  activeModal.value = 'redeem'
  await nextTick()
  redeemRef.value?.selectNote(note)
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

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.modal-title {
  margin: 0;
  font-size: 1.25em;
  font-weight: 600;
  color: #363636;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5em;
  color: #999;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}
</style>
