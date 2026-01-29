<template>
  <div>
    <AccountList :accounts="accountStore.accounts" />
    <div class="box">
      <p style="margin-bottom: 20px;">Create New Account</p>

      <div class="field has-addons">
        <p class="control">
          <a class="button is-static" style="width: 140px">Passphrase</a>
        </p>
        <p class="control is-expanded">
          <input
            style="width: 100%; text-align: right;"
            class="input"
            type="password"
            placeholder="Enter passphrase for new account"
            v-model="passphrase"
            :disabled="isCreating"
          >
        </p>
      </div>

      <div class="field has-addons" style="margin-top: 10px;">
        <p class="control">
          <a class="button is-static" style="width: 140px">Confirm</a>
        </p>
        <p class="control is-expanded">
          <input
            style="width: 100%; text-align: right;"
            class="input"
            type="password"
            placeholder="Confirm passphrase"
            v-model="passphraseConfirm"
            :disabled="isCreating"
          >
        </p>
      </div>

      <p v-if="passphrase && passphraseConfirm && passphrase !== passphraseConfirm" class="help is-danger">
        Passphrases do not match
      </p>

      <button
        class="button action-button"
        style="width: 100%; margin-top: 20px;"
        :class="{ 'is-loading': isCreating }"
        :disabled="!canCreate"
        @click="createAccount"
      >
        Create Account
      </button>

      <p class="help" style="margin-top: 15px;">
        This will generate a new BabyJubJub key pair. The secret key is encrypted with your passphrase and stored locally in your browser.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAccountStore } from '@/stores/account'
import AccountList from '@/components/AccountList.vue'

const accountStore = useAccountStore()

const passphrase = ref('')
const passphraseConfirm = ref('')
const isCreating = ref(false)

const canCreate = computed(() => {
  return passphrase.value.length > 0 &&
         passphrase.value === passphraseConfirm.value &&
         !isCreating.value
})

onMounted(async () => {
  if (accountStore.accounts.length === 0) {
    await accountStore.loadAccounts()
  }
})

async function createAccount() {
  if (!canCreate.value) return

  isCreating.value = true
  try {
    await accountStore.createAccountLocal(passphrase.value)
    passphrase.value = ''
    passphraseConfirm.value = ''
    alert('Account created successfully')
  } catch (err) {
    alert('Failed to create account: ' + (err as Error).message)
  } finally {
    isCreating.value = false
  }
}
</script>
