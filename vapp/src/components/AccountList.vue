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
          <th>Total Notes</th>
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
          <td>{{ noteStore.numberOfNotesInAccount(account.address) }}</td>
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
import { useAccountStore, type Account, type BabyJubJubPublicKey } from '@/stores/account'
import { useNoteStore } from '@/stores/note'
import { useFormatters } from '@/composables/useFormatters'
import * as api from '@/api'

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

function openModal() {
  createAccountModalActive.value = true
}

async function createNewAccount() {
  if (!passphrase.value) return

  done.value = false
  try {
    const res = await api.createAccount(passphrase.value)

    // Check for error response
    if (res.data.error) {
      throw new Error(res.data.error)
    }

    if (!res.data.account) {
      throw new Error('No account data returned from server')
    }

    // res.data.account contains { address, publicKey: {x, y}, keystore }
    const { address, publicKey, keystore } = res.data.account as {
      address: string
      publicKey: BabyJubJubPublicKey
      keystore: unknown
    }
    const account: Account = {
      address: `0x${address}`,
      publicKey,
      keystore
    }

    await api.addAccount(accountStore.key!, account)
    accountStore.addAccount(account)
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
