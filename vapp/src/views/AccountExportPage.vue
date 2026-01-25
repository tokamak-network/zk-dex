<template>
  <div>
    <AccountList :accounts="accountStore.accounts" @selectAccount="selectAccount" />
    <div class="box">
      <p style="margin-bottom: 20px;">Export Account</p>
      <div class="field has-addons">
        <p class="control">
          <a class="button is-static" style="width: 140px">Account</a>
        </p>
        <p class="control is-expanded">
          <a class="button is-static" style="width: 100%;">{{ fmt.formatZkAddress(addressToExport) }}</a>
        </p>
      </div>
      <div class="field has-addons" style="margin-top: 20px;">
        <p class="control">
          <a class="button is-static" style="width: 140px">Passphrase</a>
        </p>
        <p class="control is-expanded">
          <input
            style="width: 100%; text-align: right;"
            class="input"
            type="password"
            placeholder="Enter passphrase to verify"
            v-model="passphrase"
            :disabled="isUnlock"
          >
        </p>
        <p class="control">
          <button
            class="button"
            :class="{ 'is-success': isUnlock, 'is-loading': unlocking }"
            @click="unlockAccountHandler"
            :disabled="!passphrase || !accountToExport || isUnlock"
          >
            {{ isUnlock ? '✓ Verified' : 'Verify' }}
          </button>
        </p>
      </div>
      <a
        tag="button"
        @click="exportAccount"
        style="width: 100%; margin-top: 20px;"
        class="button is-link"
        :href="'data:' + data + ''"
        download="keystore.json"
        :class="{'is-static': !isUnlock}"
      >
        Export Keystore
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAccountStore, type Account } from '@/stores/account'
import { useFormatters } from '@/composables/useFormatters'
import AccountList from '@/components/AccountList.vue'
import * as api from '@/api'

const accountStore = useAccountStore()
const fmt = useFormatters()

const accountToExport = ref<Account | null>(null)
const addressToExport = ref('')
const passphrase = ref('')
const isUnlock = ref(false)
const unlocking = ref(false)
const data = ref<string | null>(null)

onMounted(async () => {
  if (accountStore.accounts.length === 0) {
    await accountStore.loadAccounts()
  }
})

function selectAccount(account: Account) {
  accountToExport.value = account
  addressToExport.value = account.address
  // Reset unlock state when selecting new account
  isUnlock.value = false
  passphrase.value = ''
}

async function unlockAccountHandler() {
  if (!accountToExport.value || !passphrase.value) return

  unlocking.value = true
  try {
    const res = await api.unlockAccount(
      passphrase.value,
      accountToExport.value.keystore
    )
    const secretKey = res.data.secretKey

    if (!secretKey) {
      alert('Failed to verify: Invalid response')
      return
    }
    isUnlock.value = true
  } catch (err) {
    alert('Failed to verify: Wrong passphrase?')
  } finally {
    unlocking.value = false
  }
}

function exportAccount() {
  if (!accountToExport.value) return

  const keyObj = accountToExport.value.keystore
  data.value = 'text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(keyObj))
  // Reset after export
  passphrase.value = ''
  isUnlock.value = false
  accountToExport.value = null
  addressToExport.value = ''
}
</script>
