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
          <td>{{ noteCount(account.address) }}</td>
          <td>{{ accountBalance(account.address, '0') }}</td>
          <td>{{ accountBalance(account.address, '1') }}</td>
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
