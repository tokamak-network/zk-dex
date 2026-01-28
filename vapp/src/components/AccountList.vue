<template>
  <div class="box">
    <div class="columns is-vcentered">
      <div class="column" style="float: left;">
        <p style="margin-left: 10px;">Accounts</p>
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
            <span v-if="!account.secretKey" class="lock-icon" title="Click to unlock">&#x1F512;</span>
            <span v-else class="lock-icon" title="Unlocked">&#x1F513;</span>
            {{ fmt.formatZkPk(account.publicKey) }}
          </td>
          <td>{{ account.secretKey ? noteCount(account.address) : '**' }}</td>
          <td>{{ account.secretKey ? accountBalance(account.address, '0') : '**' }}</td>
          <td>{{ account.secretKey ? accountBalance(account.address, '1') : '**' }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="accounts.length > 0 && !hasUnlockedAccount" class="help" style="margin: -10px 10px 10px;">
      Click an account to unlock and view notes
    </p>
    <!-- Unlock account modal -->
    <o-modal v-model:active="unlockModalActive">
      <div class="box" style="width: 400px;">
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
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { toBigInt, formatEther } from 'ethers'
import { useAccountStore, type Account } from '@/stores/account'
import { useNoteStore } from '@/stores/note'
import { useFormatters } from '@/composables/useFormatters'

const props = defineProps<{
  accounts: Account[]
  selectedAccount?: Account | null
}>()

const hasUnlockedAccount = computed(() => {
  return props.accounts.some(acc => acc.secretKey)
})

const emit = defineEmits<{
  selectAccount: [account: Account]
}>()

const route = useRoute()
const accountStore = useAccountStore()
const noteStore = useNoteStore()
const fmt = useFormatters()

const done = ref(true)
const createAccountModalActive = ref(false)
const passphrase = ref('')
const unlockModalActive = ref(false)
const unlockPassphrase = ref('')
const unlocking = ref(false)
const accountToUnlock = ref<Account | null>(null)

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
  return formatEther(sum)
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
</script>

<style scoped>
.table {
  width: 100%;
  table-layout: fixed;
}

.table th,
.table td {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
</style>
