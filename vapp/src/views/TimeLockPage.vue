<template>
  <div class="timelock-page">
    <h1 class="title is-4">Time-Locked Notes</h1>
    <p class="subtitle is-6">Create notes that can only be spent after a specific time</p>

    <!-- No accounts warning -->
    <div v-if="accountStore.accounts.length === 0" class="box has-text-centered">
      <p class="title is-5">No zAccounts Found</p>
      <p class="subtitle is-6">Create a zAccount first to use time-locked notes.</p>
      <router-link to="/zaccounts" class="button action-button">
        Create zAccount
      </router-link>
    </div>

    <!-- Account not unlocked -->
    <div v-else-if="!hasUnlockedAccount" class="box has-text-centered">
      <p class="title is-5">Account Locked</p>
      <p class="subtitle is-6">Unlock a zAccount to manage time-locked notes.</p>
      <p style="margin-bottom: 15px;">Select an account to unlock:</p>
      <div class="buttons is-centered">
        <button
          v-for="account in accountStore.accounts"
          :key="account.address"
          class="button is-outlined"
          @click="promptUnlock(account)"
        >
          {{ formatPk(account.publicKey) }}
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
            <p style="margin-bottom: 10px;">{{ formatPk(accountToUnlock?.publicKey) }}</p>
            <input
              class="input"
              type="password"
              v-model="unlockPassphrase"
              placeholder="Enter passphrase"
              @keyup.enter="doUnlockAccount"
            >
          </section>
          <footer class="modal-card-foot">
            <button class="button" @click="unlockModalActive = false">Cancel</button>
            <button
              class="button action-button"
              :class="{ 'is-loading': unlocking }"
              :disabled="!unlockPassphrase"
              @click="doUnlockAccount"
            >
              Unlock
            </button>
          </footer>
        </div>
      </div>
    </div>

    <!-- Main content -->
    <template v-else>
      <!-- Tabs -->
      <div class="tabs is-boxed">
        <ul>
          <li :class="{ 'is-active': activeTab === 'create' }">
            <a @click="activeTab = 'create'">Create Time-Lock</a>
          </li>
          <li :class="{ 'is-active': activeTab === 'list' }">
            <a @click="activeTab = 'list'">
              My Time-Locks
              <span v-if="timeLockStore.timeLockNotes.length > 0" class="tag is-small ml-2">
                {{ timeLockStore.timeLockNotes.length }}
              </span>
            </a>
          </li>
        </ul>
      </div>

      <!-- Create Tab -->
      <div v-if="activeTab === 'create'" class="box">
        <h2 class="title is-5">Create Time-Locked Note</h2>
        <p class="subtitle is-6">Lock value until a specific date and time</p>

        <form @submit.prevent="handleCreateTimeLock">
          <!-- Token Type -->
          <div class="field">
            <label class="label">Token Type</label>
            <div class="control">
              <div class="select is-fullwidth">
                <select v-model="createForm.tokenType">
                  <option value="0">ETH</option>
                  <option value="1">DAI</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Value -->
          <div class="field">
            <label class="label">Value (in wei/smallest unit)</label>
            <div class="control">
              <input
                v-model="createForm.value"
                class="input"
                type="text"
                placeholder="e.g., 1000000000000000000 for 1 ETH"
                required
              >
            </div>
            <p class="help">
              {{ formatValue(createForm.value, createForm.tokenType) }}
            </p>
          </div>

          <!-- Unlock Time -->
          <div class="field">
            <label class="label">Unlock Date & Time</label>
            <div class="control">
              <input
                v-model="createForm.unlockDateTime"
                class="input"
                type="datetime-local"
                :min="minDateTime"
                required
              >
            </div>
            <p class="help">
              Note will be spendable after this time
            </p>
          </div>

          <!-- Recipient (optional - defaults to self) -->
          <div class="field">
            <label class="label">
              <input type="checkbox" v-model="createForm.sendToOther">
              Send to different recipient
            </label>
          </div>

          <div v-if="createForm.sendToOther" class="field">
            <label class="label">Recipient Public Key X</label>
            <div class="control">
              <input
                v-model="createForm.recipientPkX"
                class="input"
                type="text"
                placeholder="Recipient's BabyJubJub public key X"
              >
            </div>
          </div>

          <div v-if="createForm.sendToOther" class="field">
            <label class="label">Recipient Public Key Y</label>
            <div class="control">
              <input
                v-model="createForm.recipientPkY"
                class="input"
                type="text"
                placeholder="Recipient's BabyJubJub public key Y"
              >
            </div>
          </div>

          <!-- Submit -->
          <div class="field">
            <div class="control">
              <button
                type="submit"
                class="button action-button is-fullwidth"
                :class="{ 'is-loading': timeLockStore.isCreating }"
                :disabled="!canCreate"
              >
                Create Time-Lock
              </button>
            </div>
          </div>
        </form>
      </div>

      <!-- List Tab -->
      <div v-if="activeTab === 'list'">
        <!-- Refresh button -->
        <div class="mb-4">
          <button
            class="button is-small"
            :class="{ 'is-loading': timeLockStore.isLoading }"
            @click="refreshNotes"
          >
            Refresh
          </button>
        </div>

        <!-- Locked Notes -->
        <div class="box" v-if="timeLockStore.lockedNotes.length > 0">
          <h3 class="title is-6">
            <span class="icon has-text-warning">
              <i class="fas fa-lock"></i>
            </span>
            Locked Notes
          </h3>

          <div
            v-for="note in timeLockStore.lockedNotes"
            :key="note.hash"
            class="timelock-note locked"
          >
            <div class="note-header">
              <span class="note-hash">{{ formatHash(note.hash) }}</span>
              <span :class="['tag', note.token === '0x0' ? 'is-info' : 'is-success']">
                {{ note.token === '0x0' ? 'ETH' : 'DAI' }}
              </span>
            </div>
            <div class="note-details">
              <div class="detail-item">
                <span class="label">Value:</span>
                <span class="value">{{ formatValue(note.value, note.token === '0x0' ? '0' : '1') }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Unlocks:</span>
                <span class="value">{{ formatUnlockTime(note.unlockTime) }}</span>
              </div>
              <div class="detail-item countdown">
                <span class="label">Remaining:</span>
                <span class="value countdown-value">
                  {{ timeLockStore.formatRemainingTime(note.remainingTime || 0) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Unlocked Notes -->
        <div class="box" v-if="timeLockStore.unlockedNotes.length > 0">
          <h3 class="title is-6">
            <span class="icon has-text-success">
              <i class="fas fa-unlock"></i>
            </span>
            Unlocked Notes (Ready to Spend)
          </h3>

          <div
            v-for="note in timeLockStore.unlockedNotes"
            :key="note.hash"
            class="timelock-note unlocked"
          >
            <div class="note-header">
              <span class="note-hash">{{ formatHash(note.hash) }}</span>
              <span :class="['tag', note.token === '0x0' ? 'is-info' : 'is-success']">
                {{ note.token === '0x0' ? 'ETH' : 'DAI' }}
              </span>
            </div>
            <div class="note-details">
              <div class="detail-item">
                <span class="label">Value:</span>
                <span class="value">{{ formatValue(note.value, note.token === '0x0' ? '0' : '1') }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Unlocked at:</span>
                <span class="value">{{ formatUnlockTime(note.unlockTime) }}</span>
              </div>
            </div>
            <div class="note-actions">
              <button
                class="button is-small action-button"
                :class="{ 'is-loading': spendingNote === note.hash }"
                @click="handleSpendNote(note)"
              >
                Spend (Convert to Regular Note)
              </button>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="timeLockStore.timeLockNotes.length === 0" class="box has-text-centered">
          <p class="has-text-grey">No time-locked notes found</p>
          <button class="button is-small mt-3" @click="activeTab = 'create'">
            Create your first time-lock
          </button>
        </div>
      </div>
    </template>

    <!-- Spend Modal -->
    <div v-if="showSpendModal" class="modal is-active">
      <div class="modal-background" @click="showSpendModal = false"></div>
      <div class="modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title">Spend Time-Locked Note</p>
          <button class="delete" @click="showSpendModal = false"></button>
        </header>
        <section class="modal-card-body">
          <p>Convert this time-locked note to a regular note.</p>
          <p class="mt-3"><strong>Value:</strong> {{ selectedNoteForSpend ? formatValue(selectedNoteForSpend.value, selectedNoteForSpend.token === '0x0' ? '0' : '1') : '' }}</p>

          <div class="field mt-4">
            <label class="label">
              <input type="checkbox" v-model="spendToOther">
              Transfer to different recipient
            </label>
          </div>

          <div v-if="spendToOther">
            <div class="field">
              <label class="label">Recipient Public Key X</label>
              <input v-model="spendRecipientPkX" class="input" type="text">
            </div>
            <div class="field">
              <label class="label">Recipient Public Key Y</label>
              <input v-model="spendRecipientPkY" class="input" type="text">
            </div>
          </div>
        </section>
        <footer class="modal-card-foot">
          <button class="button" @click="showSpendModal = false">Cancel</button>
          <button
            class="button action-button"
            :class="{ 'is-loading': timeLockStore.isSpending }"
            @click="confirmSpend"
          >
            Confirm Spend
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAccountStore, type Account } from '@/stores/account'
import { useTimeLockStore, type TimeLockNote } from '@/stores/timelock'
import { ethers } from 'ethers'

const accountStore = useAccountStore()
const timeLockStore = useTimeLockStore()

const activeTab = ref<'create' | 'list'>('create')
const spendingNote = ref<string | null>(null)
const showSpendModal = ref(false)
const selectedNoteForSpend = ref<TimeLockNote | null>(null)
const spendToOther = ref(false)
const spendRecipientPkX = ref('')
const spendRecipientPkY = ref('')

// Unlock modal state
const unlockModalActive = ref(false)
const accountToUnlock = ref<Account | null>(null)
const unlockPassphrase = ref('')
const unlocking = ref(false)

// Timer for updating countdown
let countdownTimer: ReturnType<typeof setInterval> | null = null

// Create form
const createForm = ref({
  tokenType: '0',
  value: '',
  unlockDateTime: '',
  sendToOther: false,
  recipientPkX: '',
  recipientPkY: ''
})

// Computed
const hasUnlockedAccount = computed(() => {
  return accountStore.accounts.some(acc => acc.secretKey)
})

const currentAccount = computed(() => {
  return accountStore.accounts.find(acc => acc.secretKey)
})

const minDateTime = computed(() => {
  const now = new Date()
  now.setMinutes(now.getMinutes() + 1) // At least 1 minute in future
  return now.toISOString().slice(0, 16)
})

const canCreate = computed(() => {
  if (!createForm.value.value || !createForm.value.unlockDateTime) return false
  if (createForm.value.sendToOther) {
    return createForm.value.recipientPkX && createForm.value.recipientPkY
  }
  return true
})

// Methods
function formatHash(hash: string): string {
  if (!hash) return ''
  return hash.slice(0, 10) + '...' + hash.slice(-6)
}

function formatPk(pk: { x: string; y: string } | undefined): string {
  if (!pk) return ''
  return pk.x.slice(0, 8) + '...' + pk.x.slice(-4)
}

function promptUnlock(account: Account) {
  accountToUnlock.value = account
  unlockPassphrase.value = ''
  unlockModalActive.value = true
}

async function doUnlockAccount() {
  if (!accountToUnlock.value || !unlockPassphrase.value) return

  unlocking.value = true
  try {
    await accountStore.unlockAccountLocal(
      accountToUnlock.value.address,
      unlockPassphrase.value
    )
    unlockModalActive.value = false
    // Load time-lock notes after unlock
    await timeLockStore.loadTimeLockNotes()
  } catch (err) {
    console.error('Failed to unlock:', err)
    alert('Failed to unlock: Wrong passphrase?')
  } finally {
    unlocking.value = false
    unlockPassphrase.value = ''
  }
}

function formatValue(value: string, tokenType: string): string {
  if (!value) return '0'
  try {
    const formatted = ethers.formatUnits(value, 18)
    return `${formatted} ${tokenType === '0' ? 'ETH' : 'DAI'}`
  } catch {
    return value
  }
}

function formatUnlockTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString()
}

async function handleCreateTimeLock() {
  if (!currentAccount.value?.publicKey || !currentAccount.value?.secretKey) {
    alert('Please unlock an account first')
    return
  }

  const unlockTime = Math.floor(new Date(createForm.value.unlockDateTime).getTime() / 1000)

  // Determine recipient
  let recipientPkX = createForm.value.recipientPkX
  let recipientPkY = createForm.value.recipientPkY

  if (!createForm.value.sendToOther) {
    recipientPkX = currentAccount.value.publicKey.x
    recipientPkY = currentAccount.value.publicKey.y
  }

  try {
    await timeLockStore.createTimeLock({
      note: {} as any, // Not needed for direct deposit
      recipientPkX,
      recipientPkY,
      unlockTime,
      value: createForm.value.value,
      tokenType: createForm.value.tokenType
    })

    alert('Time-locked note created successfully!')
    createForm.value = {
      tokenType: '0',
      value: '',
      unlockDateTime: '',
      sendToOther: false,
      recipientPkX: '',
      recipientPkY: ''
    }
    activeTab.value = 'list'
  } catch (err: any) {
    alert('Failed to create time-lock: ' + err.message)
  }
}

function handleSpendNote(note: TimeLockNote) {
  selectedNoteForSpend.value = note
  spendToOther.value = false
  spendRecipientPkX.value = ''
  spendRecipientPkY.value = ''
  showSpendModal.value = true
}

async function confirmSpend() {
  if (!selectedNoteForSpend.value || !currentAccount.value?.publicKey) return

  let recipientPkX = spendRecipientPkX.value
  let recipientPkY = spendRecipientPkY.value

  if (!spendToOther.value) {
    recipientPkX = currentAccount.value.publicKey.x
    recipientPkY = currentAccount.value.publicKey.y
  }

  try {
    spendingNote.value = selectedNoteForSpend.value.hash
    await timeLockStore.spendTimeLock({
      timeLockNote: selectedNoteForSpend.value,
      recipientPkX,
      recipientPkY
    })

    alert('Time-locked note spent successfully! Check your regular notes.')
    showSpendModal.value = false
    selectedNoteForSpend.value = null
  } catch (err: any) {
    alert('Failed to spend time-lock: ' + err.message)
  } finally {
    spendingNote.value = null
  }
}

async function refreshNotes() {
  await timeLockStore.loadTimeLockNotes()
}

// Lifecycle
onMounted(async () => {
  // Only load accounts if not already loaded (to preserve unlock state)
  if (accountStore.accounts.length === 0) {
    accountStore.loadAccounts()
  }

  // Load time-lock notes if account is available
  if (accountStore.accounts.length > 0) {
    await timeLockStore.loadTimeLockNotes()
  }

  // Start countdown timer
  countdownTimer = setInterval(() => {
    timeLockStore.updateRemainingTimes()
  }, 1000)
})

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
})
</script>

<style scoped>
.timelock-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.timelock-note {
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 15px;
}

.timelock-note.locked {
  background: #fff8e1;
  border: 1px solid #ffcc02;
}

.timelock-note.unlocked {
  background: #e8f5e9;
  border: 1px solid #4caf50;
}

.note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.note-hash {
  font-family: monospace;
  font-size: 0.9em;
  color: #666;
}

.note-details {
  display: grid;
  gap: 8px;
}

.detail-item {
  display: flex;
  gap: 10px;
}

.detail-item .label {
  color: #666;
  min-width: 100px;
}

.detail-item .value {
  font-weight: 500;
}

.countdown-value {
  color: #f57c00;
  font-family: monospace;
}

.note-actions {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #ddd;
}

.action-button {
  background-color: #6366f1;
  border-color: #6366f1;
  color: white;
}

.action-button:hover {
  background-color: #4f46e5;
  border-color: #4f46e5;
  color: white;
}

.ml-2 {
  margin-left: 0.5rem;
}

.mt-3 {
  margin-top: 0.75rem;
}

.mt-4 {
  margin-top: 1rem;
}

.mb-4 {
  margin-bottom: 1rem;
}
</style>
