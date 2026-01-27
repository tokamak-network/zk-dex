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
          <th>Address</th>
          <th>Notes</th>
          <th>ETH</th>
          <th>DAI</th>
          <th></th>
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
          <td>{{ fmt.formatZkAddress(account.address) }}</td>
          <td>{{ account.secretKey ? noteCount(account.address) : '***' }}</td>
          <td>{{ account.secretKey ? accountBalance(account.address, '0') : '***' }}</td>
          <td>{{ account.secretKey ? accountBalance(account.address, '1') : '***' }}</td>
          <td>
            <button
              v-if="!account.secretKey"
              class="button is-small is-info is-light"
              @click.stop="openUnlockModal(account)"
            >Unlock</button>
            <button
              v-else
              class="button is-small is-warning is-light"
              @click.stop="lockAccount(account)"
            >Lock</button>
          </td>
        </tr>
      </tbody>
    </table>
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
    <!-- Unlock account modal -->
    <o-modal v-model:active="unlockModalActive">
      <div class="box" style="width: 400px;">
        <p class="title is-5">Unlock Account</p>
        <p class="subtitle is-6">Enter passphrase to decrypt notes</p>
        <div class="field">
          <p class="control">
            <input
              class="input"
              type="password"
              v-model="unlockPassphrase"
              placeholder="Passphrase"
              @keyup.enter="confirmUnlock"
            >
          </p>
        </div>
        <div v-if="unlockError" class="help is-danger" style="margin-bottom: 10px;">{{ unlockError }}</div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button class="button" @click="unlockModalActive = false">Cancel</button>
          <button
            class="button is-info"
            :class="{ 'is-loading': isUnlocking }"
            @click="confirmUnlock"
            :disabled="!unlockPassphrase"
          >Unlock</button>
        </div>
      </div>
    </o-modal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { toBigInt } from 'ethers'
import { useAccountStore, type Account } from '@/stores/account'
import { useNoteStore } from '@/stores/note'
import { useFormatters } from '@/composables/useFormatters'

defineProps<{
  accounts: Account[]
  selectedAccount?: Account | null
}>()

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
const unlockError = ref('')
const isUnlocking = ref(false)
const accountToUnlock = ref<Account | null>(null)

function selectAccount(account: Account) {
  emit('selectAccount', account)
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
  return sum.toString()
}

function openModal() {
  createAccountModalActive.value = true
}

function lockAccount(account: Account) {
  accountStore.lockAccountByAddress(account.address)
}

function openUnlockModal(account: Account) {
  accountToUnlock.value = account
  unlockPassphrase.value = ''
  unlockError.value = ''
  unlockModalActive.value = true
}

async function confirmUnlock() {
  if (!accountToUnlock.value || !unlockPassphrase.value) return

  isUnlocking.value = true
  unlockError.value = ''
  try {
    await accountStore.unlockAccountLocal(
      accountToUnlock.value.address,
      unlockPassphrase.value
    )
    unlockModalActive.value = false
    unlockPassphrase.value = ''
    accountToUnlock.value = null
  } catch (err) {
    console.error('Failed to unlock account:', err)
    unlockError.value = 'Wrong passphrase'
  } finally {
    isUnlocking.value = false
  }
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
</style>
