<template>
  <div>
    <!-- DEBUG INFO -->
    <div style="background: #fffacd; padding: 10px; margin-bottom: 10px; font-size: 12px; font-family: monospace;">
      DEBUG: accounts={{ accountStore.accounts.length }},
      hasUnlocked={{ hasUnlockedAccount }},
      notes={{ noteStore.notes.length }},
      validNotes={{ validNotes.length }},
      activeTab={{ activeTab }}
    </div>
    <!-- Step 1: No accounts -->
    <div v-if="accountStore.accounts.length === 0" class="box has-text-centered">
      <p class="title is-5">No zAccounts Found</p>
      <p class="subtitle is-6">Create a zAccount first to manage notes.</p>
      <router-link to="/zaccounts" class="button action-button">
        Create zAccount
      </router-link>
    </div>

    <!-- Step 2: Accounts exist but none unlocked -->
    <div v-else-if="!hasUnlockedAccount" class="box has-text-centered">
      <p class="title is-5">Account Locked</p>
      <p class="subtitle is-6">Unlock a zAccount to view and manage your notes.</p>
      <p style="margin-bottom: 15px;">Select an account to unlock:</p>
      <div class="buttons is-centered">
        <button
          v-for="account in accountStore.accounts"
          :key="account.address"
          class="button is-outlined"
          @click="promptUnlock(account)"
        >
          {{ fmt.formatZkPk(account.publicKey) }}
        </button>
      </div>

      <!-- Unlock modal -->
      <div v-if="unlockModalActive" class="modal is-active">
        <div class="modal-background" @click="unlockModalActive = false"></div>
        <div class="modal-card" style="max-width: 400px;">
          <header class="modal-card-head">
            <p class="modal-card-title">Unlock Account</p>
            <button class="delete" @click="unlockModalActive = false"></button>
          </header>
          <section class="modal-card-body">
            <p style="margin-bottom: 10px;">{{ fmt.formatZkPk(accountToUnlock?.publicKey) }}</p>
            <input
              class="input"
              type="password"
              v-model="unlockPassphrase"
              placeholder="Enter passphrase"
              @keyup.enter="unlockAccount"
            >
          </section>
          <footer class="modal-card-foot">
            <button class="button" @click="unlockModalActive = false">Cancel</button>
            <button
              class="button action-button"
              :class="{ 'is-loading': unlocking }"
              :disabled="!unlockPassphrase"
              @click="unlockAccount"
            >
              Unlock
            </button>
          </footer>
        </div>
      </div>
    </div>

    <!-- Step 3: Account unlocked - show notes -->
    <template v-else>
      <!-- Accounts status bar -->
      <div class="accounts-status-bar">
        <div class="account-group">
          <span class="status-label unlocked-label">Unlocked:</span>
          <span
            v-for="account in unlockedAccounts"
            :key="account.address"
            class="account-tag unlocked"
          >
            {{ fmt.formatZkPk(account.publicKey) }}
            <button class="lock-btn" @click="lockAccount(account)" title="Lock account">
              &#x1F512;
            </button>
          </span>
        </div>
        <div v-if="lockedAccounts.length > 0" class="account-group">
          <span class="status-label locked-label">Locked:</span>
          <span
            v-for="account in lockedAccounts"
            :key="account.address"
            class="account-tag locked"
            @click="promptUnlock(account)"
            title="Click to unlock"
          >
            {{ fmt.formatZkPk(account.publicKey) }}
            <span class="unlock-icon">&#x1F513;</span>
          </span>
        </div>
      </div>

      <!-- Unlock modal (shared with Step 2) -->
      <div v-if="unlockModalActive" class="modal is-active">
        <div class="modal-background" @click="unlockModalActive = false"></div>
        <div class="modal-card" style="max-width: 400px;">
          <header class="modal-card-head">
            <p class="modal-card-title">Unlock Account</p>
            <button class="delete" @click="unlockModalActive = false"></button>
          </header>
          <section class="modal-card-body">
            <p style="margin-bottom: 10px;">{{ fmt.formatZkPk(accountToUnlock?.publicKey) }}</p>
            <input
              class="input"
              type="password"
              v-model="unlockPassphrase"
              placeholder="Enter passphrase"
              @keyup.enter="unlockAccount"
            >
          </section>
          <footer class="modal-card-foot">
            <button class="button" @click="unlockModalActive = false">Cancel</button>
            <button
              class="button action-button"
              :class="{ 'is-loading': unlocking }"
              :disabled="!unlockPassphrase"
              @click="unlockAccount"
            >
              Unlock
            </button>
          </footer>
        </div>
      </div>

      <NoteBalanceList :notes="noteStore.notes" />

      <div class="tabs is-boxed" style="margin-top: 20px;">
        <ul>
          <li :class="{ 'is-active': activeTab === 'tree' }">
            <a @click="activeTab = 'tree'">Note Tree</a>
          </li>
          <li :class="{ 'is-active': activeTab === 'list' }">
            <a @click="activeTab = 'list'">Note List</a>
          </li>
          <li :class="{ 'is-active': activeTab === 'issue' }">
            <a @click="activeTab = 'issue'">Issue</a>
          </li>
          <li :class="{ 'is-active': activeTab === 'transfer' }">
            <a @click="activeTab = 'transfer'">Transfer</a>
          </li>
          <li :class="{ 'is-active': activeTab === 'redeem' }">
            <a @click="activeTab = 'redeem'">Redeem</a>
          </li>
        </ul>
      </div>

      <div v-if="activeTab === 'tree'">
        <NoteTree :notes="noteStore.notes" :currentAccount="web3Account" :accounts="accountStore.accounts" @issue-note="handleIssueNote" @transfer-note="handleTransferNote" @redeem-note="handleRedeemNote" />
      </div>

      <div v-else-if="activeTab === 'list'">
        <NoteList :notes="noteStore.notes" />
      </div>

      <div v-else-if="activeTab === 'issue'">
        <NoteMint :accounts="accountStore.accounts" :initial-account-address="selectedAccountForMint" />
      </div>

      <div v-else-if="activeTab === 'transfer'">
        <p style="color: green; font-weight: bold;">DEBUG: Transfer tab is rendering! validNotes.length = {{ validNotes.length }}</p>
        <div v-if="validNotes.length > 0" style="margin-bottom: 15px;">
          <p class="help" style="margin-bottom: 10px;">Select a note from the list below, or use the form directly:</p>
          <NoteList :notes="validNotes" @selectNote="handleSelectNoteForTransfer" />
        </div>
        <div v-else class="notification is-light" style="margin-bottom: 15px;">
          No valid notes available. Issue a note first or wait for pending notes to be confirmed.
        </div>
        <NoteTransfer ref="noteTransferRef" />
      </div>

      <div v-else-if="activeTab === 'redeem'">
        <div v-if="validNotes.length > 0" style="margin-bottom: 15px;">
          <p class="help" style="margin-bottom: 10px;">Select a note from the list below:</p>
          <NoteList :notes="validNotes" @selectNote="handleSelectNoteForRedeem" />
        </div>
        <div v-else class="notification is-light" style="margin-bottom: 15px;">
          No valid notes available to redeem.
        </div>
        <NoteLiquidate ref="noteLiquidateRef" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useAccountStore, type Account } from '@/stores/account'
import { useContractStore } from '@/stores/contract'
import { useNoteStore, type Note } from '@/stores/note'
import { useWeb3Store } from '@/stores/web3'
import { useFormatters } from '@/composables/useFormatters'
import { logger } from '@/lib/logger'
import NoteBalanceList from '@/components/NoteBalanceList.vue'
import NoteTree from '@/components/NoteTree.vue'
import NoteList from '@/components/NoteList.vue'
import NoteMint from '@/components/NoteMint.vue'
import NoteLiquidate from '@/components/NoteLiquidate.vue'
import NoteTransfer from '@/components/NoteTransfer.vue'

const route = useRoute()
const accountStore = useAccountStore()
const contractStore = useContractStore()
const noteStore = useNoteStore()
const web3Store = useWeb3Store()
const fmt = useFormatters()

const activeTab = ref<'tree' | 'list' | 'issue' | 'transfer' | 'redeem'>('tree')
const selectedAccountForMint = ref<string>('')
const web3Account = computed(() => web3Store.account)
const noteLiquidateRef = ref<InstanceType<typeof NoteLiquidate> | null>(null)
const noteTransferRef = ref<InstanceType<typeof NoteTransfer> | null>(null)

// Pending note to select after tab switch
const pendingTransferNote = ref<Note | null>(null)
const pendingRedeemNote = ref<Note | null>(null)

// Unlock modal state
const unlockModalActive = ref(false)
const accountToUnlock = ref<Account | null>(null)
const unlockPassphrase = ref('')
const unlocking = ref(false)

const hasUnlockedAccount = computed(() => {
  return accountStore.accounts.some(acc => acc.secretKey)
})

const unlockedAccounts = computed(() => {
  return accountStore.accounts.filter(acc => acc.secretKey)
})

const lockedAccounts = computed(() => {
  return accountStore.accounts.filter(acc => !acc.secretKey)
})

// Only show VALID notes for redeem
const validNotes = computed(() => {
  return noteStore.notes.filter(note => note.state === '0x1')
})

interface SelectedNoteData {
  hash: string
  value: string
  token: string
  state: string
  owner: string
}

function handleSelectNoteForTransfer(note: Note) {
  noteTransferRef.value?.selectNote(note)
}

function handleSelectNoteForRedeem(note: Note) {
  console.log('[NoteWalletPage] handleSelectNoteForRedeem called:', {
    hash: note.hash?.slice(0, 12),
    pkX: note.pkX ? 'present' : 'MISSING',
    pkY: note.pkY ? 'present' : 'MISSING',
    salt: note.salt ? 'present' : 'MISSING'
  })
  noteLiquidateRef.value?.selectNote(note)
}

function handleIssueNote(createdBy: string) {
  // Store the account address and switch to issue tab
  selectedAccountForMint.value = createdBy
  activeTab.value = 'issue'
}

// Clear selectedAccountForMint when switching away from issue tab
watch(activeTab, (newTab) => {
  if (newTab !== 'issue') {
    selectedAccountForMint.value = ''
  }
})

function handleTransferNote(noteData: SelectedNoteData) {
  console.log('[NoteWalletPage] handleTransferNote called with hash:', noteData.hash)
  // Find the full note object
  const note = noteStore.notes.find(n => n.hash === noteData.hash)
  console.log('[NoteWalletPage] Found note:', note ? 'yes' : 'no', 'total notes:', noteStore.notes.length)
  if (note) {
    pendingTransferNote.value = note
    activeTab.value = 'transfer'
  } else {
    // Note not found, just switch to transfer tab anyway
    console.warn('[NoteWalletPage] Note not found in store, switching to transfer tab anyway')
    activeTab.value = 'transfer'
  }
}

function handleRedeemNote(noteData: SelectedNoteData) {
  console.log('[NoteWalletPage] handleRedeemNote called with hash:', noteData.hash)
  // Find the full note object
  const note = noteStore.notes.find(n => n.hash === noteData.hash)
  console.log('[NoteWalletPage] Found note for redeem:', note ? {
    hash: note.hash?.slice(0, 12),
    state: note.state,
    pkX: note.pkX ? 'present' : 'MISSING',
    pkY: note.pkY ? 'present' : 'MISSING',
    salt: note.salt ? 'present' : 'MISSING',
    secretKey: note.secretKey ? 'present' : 'missing'
  } : 'NOT FOUND')
  if (note) {
    pendingRedeemNote.value = note
    activeTab.value = 'redeem'
  } else {
    console.error('[NoteWalletPage] Note not found in store! total notes:', noteStore.notes.length)
  }
}

// Watch for component refs to become available after tab switch
watch(noteTransferRef, (ref) => {
  if (ref && pendingTransferNote.value) {
    console.log('[NoteWalletPage] NoteTransfer ref available, selecting note:', pendingTransferNote.value.hash)
    nextTick(() => {
      ref.selectNote(pendingTransferNote.value!)
      pendingTransferNote.value = null
    })
  }
})

watch(noteLiquidateRef, (ref) => {
  if (ref && pendingRedeemNote.value) {
    console.log('[NoteWalletPage] NoteLiquidate ref available, selecting note:', {
      hash: pendingRedeemNote.value.hash?.slice(0, 12),
      pkX: pendingRedeemNote.value.pkX ? 'present' : 'MISSING',
      pkY: pendingRedeemNote.value.pkY ? 'present' : 'MISSING',
      salt: pendingRedeemNote.value.salt ? 'present' : 'MISSING'
    })
    nextTick(() => {
      ref.selectNote(pendingRedeemNote.value!)
      pendingRedeemNote.value = null
    })
  }
})

function promptUnlock(account: Account) {
  accountToUnlock.value = account
  unlockPassphrase.value = ''
  unlockModalActive.value = true
}

async function lockAccount(account: Account) {
  accountStore.lockAccount(account.address)
  // After lock, re-decrypt notes (will remove notes that can no longer be decrypted)
  await noteStore.decryptAndDisplayNotes()
}

async function unlockAccount() {
  if (!accountToUnlock.value || !unlockPassphrase.value) return

  unlocking.value = true
  try {
    await accountStore.unlockAccountLocal(
      accountToUnlock.value.address,
      unlockPassphrase.value
    )
    unlockModalActive.value = false
    // After unlock, decrypt notes
    await noteStore.decryptAndDisplayNotes()
  } catch (err) {
    console.error('Failed to unlock:', err)
    alert('Failed to unlock: Wrong passphrase?')
  } finally {
    unlocking.value = false
    unlockPassphrase.value = ''
  }
}

onMounted(async () => {
  console.log('[NoteWalletPage] onMounted - accounts:', accountStore.accounts.length, 'notes:', noteStore.notes.length)
  console.log('[NoteWalletPage] route.query:', route.query)

  if (accountStore.accounts.length === 0) {
    console.log('[NoteWalletPage] Loading accounts...')
    await accountStore.loadAccounts()
  }
  if (contractStore.isInitialized && noteStore.notes.length === 0) {
    console.log('[NoteWalletPage] Loading notes...')
    await noteStore.loadNotes()
  }

  console.log('[NoteWalletPage] After loading - accounts:', accountStore.accounts.length, 'notes:', noteStore.notes.length)
  console.log('[NoteWalletPage] hasUnlockedAccount:', hasUnlockedAccount.value)

  // Handle query parameters for pre-selecting actions
  handleQueryParams()
})

function handleQueryParams() {
  const action = route.query.action as string
  const noteHash = route.query.noteHash as string
  console.log('[NoteWalletPage] handleQueryParams - action:', action, 'noteHash:', noteHash)

  if (action === 'mint') {
    console.log('[NoteWalletPage] Switching to issue tab')
    activeTab.value = 'issue'
  } else if (action === 'transfer') {
    console.log('[NoteWalletPage] Switching to transfer tab')
    activeTab.value = 'transfer'
    if (noteHash) {
      const note = noteStore.notes.find(n => n.hash === noteHash)
      console.log('[NoteWalletPage] Transfer action - found note:', note ? 'yes' : 'no')
      if (note) {
        pendingTransferNote.value = note
      }
    }
  } else if (action === 'redeem') {
    console.log('[NoteWalletPage] Switching to redeem tab, noteHash:', noteHash)
    activeTab.value = 'redeem'
    if (noteHash) {
      const note = noteStore.notes.find(n => n.hash === noteHash)
      console.log('[NoteWalletPage] Redeem action - found note:', note ? {
        hash: note.hash?.slice(0, 12),
        pkX: note.pkX ? 'present' : 'MISSING',
        pkY: note.pkY ? 'present' : 'MISSING',
        salt: note.salt ? 'present' : 'MISSING',
        secretKey: note.secretKey ? 'present' : 'missing'
      } : 'NOT FOUND, total notes: ' + noteStore.notes.length)
      if (note) {
        pendingRedeemNote.value = note
      }
    }
  }
}

// Watch for contract initialization to load notes
watch(() => contractStore.isInitialized, async (isInitialized) => {
  if (isInitialized && noteStore.notes.length === 0) {
    await noteStore.loadNotes()
  }
})
</script>

<style scoped>
.tabs {
  margin-bottom: 0;
  margin-top: 10px;
}

.accounts-status-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 0;
  font-size: 0.9em;
}

.account-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-label {
  font-weight: 500;
}

.unlocked-label {
  color: #2e7d32;
}

.locked-label {
  color: #666;
}

.account-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.85em;
}

.account-tag.unlocked {
  background: #e8f5e9;
}

.account-tag.locked {
  background: #f5f5f5;
  cursor: pointer;
  border: 1px dashed #ccc;
}

.account-tag.locked:hover {
  background: #eeeeee;
  border-color: #999;
}

.lock-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 2px;
  font-size: 0.9em;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.lock-btn:hover {
  opacity: 1;
}

.unlock-icon {
  font-size: 0.9em;
  opacity: 0.5;
}

.account-tag.locked:hover .unlock-icon {
  opacity: 1;
}
</style>
