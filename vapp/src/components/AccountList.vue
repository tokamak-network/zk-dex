<template>
  <div class="box">
    <div v-if="web3Store.account" class="wallet-info">
      <span style="margin-right: 15px;">{{ web3Store.account }}</span>
      <span style="margin-right: 15px;">ETH: {{ formatEthBalance }}</span>
      <span>DAI: {{ formatDaiBalance }}</span>
      <button
        class="button is-small is-link is-light"
        style="margin-left: 8px; padding: 0 8px; height: 22px; font-size: 0.75em;"
        :disabled="isMinting"
        @click="mintDai"
      >
        {{ isMinting ? 'Minting...' : 'Faucet (+100)' }}
      </button>
    </div>
    <div class="columns is-vcentered">
      <div class="column" style="float: left; display: flex; align-items: center; gap: 10px;">
        <p style="margin-left: 10px;">Accounts</p>
        <button
          class="button is-small is-light"
          :class="{ 'is-loading': isRefreshing }"
          @click="refreshNotes"
          title="Scan blockchain for notes"
        >
          Refresh
        </button>
        <span class="tag is-light is-small">Fetched {{ rawEventCount }}</span>
      </div>
      <div style="float: right; margin-top: 10px; margin-right: 20px;" v-if="route.path === '/'">
        <button class="button" @click="openModal" :class="{ 'is-loading': !done }">CREATE NEW ACCOUNT</button>
      </div>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>Index</th>
          <th>z-pk</th>
          <th>Copy</th>
          <th>Notes</th>
          <th>ETH</th>
          <th>DAI</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(account, index) in accounts"
          :key="account.address"
          @click="selectAccount(account)"
          :class="{ 'is-selected': selectedAccount?.address === account.address }"
        >
          <td>{{ index }}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: nowrap;">
              <span v-if="!account.secretKey" class="lock-icon" title="Click to unlock">&#x1F512;</span>
              <span v-else class="lock-icon unlocked" title="Click to lock" @click.stop="lockAccount(account)">&#x1F513;</span>
              <span style="flex-shrink: 0;">{{ fmt.formatZkPk(account.publicKey) }}</span>
            </div>
          </td>
          <td>
            <button
              class="button is-small is-light copy-btn"
              @click.stop="copyAddress(account)"
              title="Copy address"
            >
              Copy
            </button>
          </td>
          <td>{{ account.secretKey ? noteCount(account.address) : '**' }}</td>
          <td>{{ account.secretKey ? accountBalance(account.address, '0') : '**' }}</td>
          <td>{{ account.secretKey ? accountBalance(account.address, '1') : '**' }}</td>
        </tr>
      </tbody>
      <tfoot v-if="hasUnlockedAccount">
        <tr class="total-row">
          <td colspan="3" style="font-weight: 600; text-align: right; padding-right: 20px;">Total (Unlocked)</td>
          <td style="font-weight: 600;">{{ totalNoteCount }}</td>
          <td style="font-weight: 600;">{{ totalEthBalance }} ETH</td>
          <td style="font-weight: 600;">{{ totalDaiBalance }} DAI</td>
        </tr>
      </tfoot>
    </table>
    <p v-if="accounts.length > 0 && !hasUnlockedAccount" class="help" style="margin: -10px 10px 10px;">
      Click an account to unlock and view notes
    </p>
    <!-- Unlock account modal -->
    <o-modal v-model:active="unlockModalActive">
      <div class="box" style="width: 400px; position: relative;">
        <button class="delete" style="position: absolute; top: 10px; right: 10px;" @click="unlockModalActive = false"></button>
        <p class="title is-5">Unlock Account</p>
        <p class="subtitle is-6">Enter passphrase to decrypt notes</p>
        <div class="field">
          <p class="control">
            <input class="input" type="password" v-model="unlockPassphrase" placeholder="Passphrase" @keyup.enter="unlockAccount">
          </p>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button class="button" @click="unlockModalActive = false">Cancel</button>
          <button class="button is-link" :class="{ 'is-loading': unlocking }" @click="unlockAccount" :disabled="!unlockPassphrase">Unlock</button>
        </div>
      </div>
    </o-modal>
    <!-- Create account modal -->
    <o-modal v-model:active="createAccountModalActive">
      <form @submit.prevent="createNewAccount">
        <div class="modal-card" style="width: auto">
          <header class="modal-card-head">
            <p class="modal-card-title">Create New Account</p>
            <button class="delete" @click="createAccountModalActive = false"></button>
          </header>
          <section class="modal-card-body">
            <o-field label="Passphrase">
              <o-input type="password" v-model="passphrase" password-reveal placeholder="Your password" required />
            </o-field>
          </section>
          <footer class="modal-card-foot">
            <button class="button" type="submit" :disabled="passphrase === ''">Create</button>
          </footer>
        </div>
      </form>
    </o-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toBigInt, formatEther } from 'ethers'
import { useOruga } from '@oruga-ui/oruga-next'
import { useAccountStore, type Account } from '@/stores/account'
import { useNoteStore } from '@/stores/note'
import { useFormatters } from '@/composables/useFormatters'
import { useWeb3Store } from '@/stores/web3'
import { useContractStore } from '@/stores/contract'
import { getRawNoteEvents } from '@/api'

const props = defineProps<{
  accounts: Account[]
  selectedAccount?: Account | null
}>()

const hasUnlockedAccount = computed(() => {
  return props.accounts.some(acc => acc.secretKey)
})

// Total counts and balances for unlocked accounts
const totalNoteCount = computed(() => {
  const unlockedAddresses = props.accounts
    .filter(acc => acc.secretKey)
    .map(acc => acc.address)

  const allNotes = noteStore.notes.filter(n => unlockedAddresses.includes(n.owner))
  const valid = allNotes.filter(n => n.state === '0x1').length
  const validAndSpent = allNotes.filter(n => n.state === '0x1' || n.state === '0x3').length
  return `${valid}/${validAndSpent}`
})

const totalEthBalance = computed(() => {
  const unlockedAddresses = props.accounts
    .filter(acc => acc.secretKey)
    .map(acc => acc.address)

  const sum = noteStore.notes
    .filter(n => unlockedAddresses.includes(n.owner) && n.state === '0x1' && fmt.hexToNumberString(n.token) === '0')
    .reduce((acc, n) => acc + toBigInt(n.value), BigInt(0))

  if (sum === BigInt(0)) return '0'
  const full = formatEther(sum)
  const dot = full.indexOf('.')
  if (dot === -1) return full
  return full.slice(0, dot + 5)
})

const totalDaiBalance = computed(() => {
  const unlockedAddresses = props.accounts
    .filter(acc => acc.secretKey)
    .map(acc => acc.address)

  const sum = noteStore.notes
    .filter(n => unlockedAddresses.includes(n.owner) && n.state === '0x1' && fmt.hexToNumberString(n.token) === '1')
    .reduce((acc, n) => acc + toBigInt(n.value), BigInt(0))

  if (sum === BigInt(0)) return '0'
  const full = formatEther(sum)
  const dot = full.indexOf('.')
  if (dot === -1) return full
  return full.slice(0, dot + 5)
})

const emit = defineEmits<{
  selectAccount: [account: Account]
}>()

const route = useRoute()
const accountStore = useAccountStore()
const noteStore = useNoteStore()
const fmt = useFormatters()
const web3Store = useWeb3Store()
const contractStore = useContractStore()
const oruga = useOruga()

const done = ref(true)
const isRefreshing = computed(() => noteStore.isScanning)
const rawEventCount = ref(0)
const createAccountModalActive = ref(false)
const passphrase = ref('')
const unlockModalActive = ref(false)
const unlockPassphrase = ref('')
const unlocking = ref(false)
const accountToUnlock = ref<Account | null>(null)
const daiBalance = ref('0')
const isMinting = ref(false)

const formatDaiBalance = computed(() => {
  if (daiBalance.value === '0') return '0'
  const full = formatEther(daiBalance.value)
  const dot = full.indexOf('.')
  if (dot === -1) return full
  return full.slice(0, dot + 4)
})

const formatEthBalance = computed(() => {
  if (!web3Store.balance) return '0'
  const full = formatEther(web3Store.balance)
  const dot = full.indexOf('.')
  if (dot === -1) return full
  return full.slice(0, dot + 4)
})

function selectAccount(account: Account) {
  // If account is not unlocked, prompt for passphrase
  if (!account.secretKey) {
    accountToUnlock.value = account
    unlockPassphrase.value = ''
    unlockModalActive.value = true
    return
  }
  emit('selectAccount', account)
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
    emit('selectAccount', accountToUnlock.value)
  } catch (err) {
    console.error('Failed to unlock account:', err)
    alert('Failed to unlock: Wrong passphrase?')
  } finally {
    unlocking.value = false
    unlockPassphrase.value = ''
  }
}

async function lockAccount(account: Account) {
  accountStore.lockAccount(account.address)
  // After lock, re-decrypt notes (will remove notes that can no longer be decrypted)
  await noteStore.decryptAndDisplayNotes()
}

async function copyAddress(account: Account) {
  try {
    if (!account.publicKey) {
      throw new Error('No public key available')
    }

    // Copy public key as JSON format
    const pkJson = JSON.stringify({
      x: account.publicKey.x,
      y: account.publicKey.y
    })
    await navigator.clipboard.writeText(pkJson)
    console.log('Public key copied to clipboard:', pkJson)

    // Format pk coordinates for display (first 5 chars + last 3 chars)
    const formatCoord = (coord: string) => {
      if (!coord || coord.length <= 8) return coord
      return `${coord.slice(0, 5)}...${coord.slice(-3)}`
    }

    const pkDisplay = `(${formatCoord(account.publicKey.x)}, ${formatCoord(account.publicKey.y)})`

    oruga.notification.open({
      message: `Copied ${pkDisplay}`,
      position: 'top',
      variant: 'success',
      duration: 3000
    })
  } catch (err) {
    console.error('Failed to copy public key:', err)
    oruga.notification.open({
      message: 'Failed to copy public key',
      position: 'top',
      variant: 'danger',
      duration: 3000
    })
  }
}

function noteCount(address: string): string {
  const accountNotes = noteStore.notes.filter(n => n.owner === address)
  const valid = accountNotes.filter(n => n.state === '0x1').length
  const validAndSpent = accountNotes.filter(n => n.state === '0x1' || n.state === '0x3').length
  return `${valid}/${validAndSpent}`
}

function accountBalance(address: string, tokenType: string): string {
  const sum = noteStore.notes
    .filter(n => n.owner === address && n.state === '0x1' && fmt.hexToNumberString(n.token) === tokenType)
    .reduce((acc, n) => acc + toBigInt(n.value), BigInt(0))
  if (sum === BigInt(0)) return '0'
  const full = formatEther(sum)
  const dot = full.indexOf('.')
  if (dot === -1) return full
  // Show up to 4 decimal places (same as wallet info)
  return full.slice(0, dot + 5)
}

function openModal() {
  createAccountModalActive.value = true
}

async function createNewAccount() {
  if (!passphrase.value) return

  done.value = false
  try {
    // Create account entirely in the browser (secret key never leaves browser)
    await accountStore.createAccountLocal(passphrase.value)
    createAccountModalActive.value = false
    passphrase.value = ''
  } catch (err) {
    console.error('Failed to create account:', err)
    alert('Failed to create account: ' + (err as Error).message)
  } finally {
    done.value = true
  }
}

function updateRawEventCount() {
  const events = getRawNoteEvents()
  const count = Object.keys(events).length
  console.log(`[AccountList] Raw events count: ${count}`, events)
  rawEventCount.value = count
}

async function refreshNotes() {
  console.log('[AccountList] Refresh started')
  // Fetch fresh events from blockchain and decrypt
  await noteStore.fetchAllNoteEvents()
  console.log('[AccountList] fetchAllNoteEvents completed')
  updateRawEventCount()
  await web3Store.updateBalance()
  console.log('[AccountList] Refresh completed')
}

async function mintDai() {
  if (!contractStore.daiContract) return
  isMinting.value = true
  try {
    const tx = await contractStore.daiContract.mint()
    await tx.wait()
    await loadDaiBalance()
  } catch (err) {
    console.error('Failed to mint DAI:', err)
  } finally {
    isMinting.value = false
  }
}

async function loadDaiBalance() {
  if (!contractStore.daiContract || !web3Store.account) return
  try {
    const bal = await contractStore.daiContract.balanceOf(web3Store.account)
    daiBalance.value = bal.toString()
  } catch {
    daiBalance.value = '0'
  }
}

onMounted(() => {
  updateRawEventCount()
  loadDaiBalance()
})

watch(() => contractStore.isInitialized, (initialized) => {
  if (initialized) loadDaiBalance()
})
</script>

<style scoped>
.table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  border-spacing: 0;
}

.table th,
.table td {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Column widths */
.table th:nth-child(1),
.table td:nth-child(1) {
  width: 7%;
}

.table th:nth-child(2),
.table td:nth-child(2) {
  width: 24%;
  padding-right: 0;
}

.table th:nth-child(3),
.table td:nth-child(3) {
  width: 10%;
  text-align: left;
  padding-left: 0;
}

.table th:nth-child(4),
.table td:nth-child(4) {
  width: 19%;
}

.table th:nth-child(5),
.table td:nth-child(5) {
  width: 20%;
}

.table th:nth-child(6),
.table td:nth-child(6) {
  width: 20%;
}

.table tbody tr {
  cursor: pointer;
}

.table tbody tr:hover {
  background-color: #f5f5f5;
}

.table tbody tr.is-selected {
  background-color: #3273dc;
  color: white;
}

.table tbody tr.is-selected:hover {
  background-color: #2366d1;
}

.lock-icon {
  font-size: 0.8em;
  margin-right: 4px;
}

.lock-icon.unlocked {
  cursor: pointer;
}

.lock-icon.unlocked:hover {
  opacity: 0.7;
}

.total-row {
  background-color: #f5f5f5;
  border-top: 2px solid #ddd;
  cursor: default;
}

.total-row:hover {
  background-color: #f5f5f5 !important;
}

.total-row td {
  padding-top: 12px !important;
  padding-bottom: 12px !important;
}

.wallet-info {
  text-align: left;
  margin-bottom: 10px;
  padding: 8px 10px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 0.85em;
  color: #555;
}

.copy-btn {
  font-size: 0.7em;
  padding: 3px 10px;
  height: 24px;
  min-width: 50px;
  border: 1px solid #dbdbdb;
}

.copy-btn:hover {
  background-color: #e8e8e8;
  border-color: #b5b5b5;
}
</style>

<style>
/* Toast notification styles - not scoped to affect Oruga notifications */
.o-notif {
  transition: opacity 0.5s ease-in-out, transform 0.5s ease-in-out !important;
}

.o-notif.is-success {
  background-color: #e8f5e9 !important;
  border-color: #c8e6c9 !important;
  color: #2e7d32 !important;
}

.o-notif.is-danger {
  background-color: #ffebee !important;
  border-color: #ffcdd2 !important;
  color: #c62828 !important;
}

/* Fade in animation */
.o-notif-wrapper-enter-active {
  animation: fadeInDown 0.6s ease-out;
}

/* Fade out animation */
.o-notif-wrapper-leave-active {
  animation: fadeOutUp 0.8s ease-in-out;
}

@keyframes fadeInDown {
  0% {
    opacity: 0;
    transform: translateY(-30px);
  }
  60% {
    opacity: 0.8;
    transform: translateY(5px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeOutUp {
  0% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-30px);
  }
}
</style>
