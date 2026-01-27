<template>
  <div>
    <AccountList :accounts="accountStore.accounts" />
    <div class="box">
      <p style="margin-bottom: 20px;">Import Account</p>

      <div class="field">
        <label class="label">Keystore File</label>
        <div class="control">
          <input type="file" id="file" @change="onChange" accept=".json">
        </div>
      </div>

      <div v-if="keystoreLoaded" class="field has-addons" style="margin-top: 20px;">
        <p class="control">
          <a class="button is-static" style="width: 140px">Passphrase</a>
        </p>
        <p class="control is-expanded">
          <input
            style="width: 100%; text-align: right;"
            class="input"
            type="password"
            placeholder="Enter passphrase to unlock"
            v-model="passphrase"
            :disabled="isImporting"
          >
        </p>
      </div>

      <button
        v-if="keystoreLoaded"
        class="button is-link"
        style="width: 100%; margin-top: 20px;"
        :class="{ 'is-loading': isImporting }"
        :disabled="!passphrase || isImporting"
        @click="importAccount"
      >
        Import
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAccountStore, type Keystore } from '@/stores/account'
import AccountList from '@/components/AccountList.vue'

// Partial keystore interface for file loading (before validation)
interface PartialKeystore {
  address?: string
  crypto?: unknown
  id?: string
  version?: number
}

const accountStore = useAccountStore()

const keystore = ref<PartialKeystore | null>(null)
const keystoreLoaded = ref(false)
const passphrase = ref('')
const isImporting = ref(false)

onMounted(async () => {
  if (accountStore.accounts.length === 0) {
    await accountStore.loadAccounts()
  }
})

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const reader = new FileReader()
    reader.onload = onReaderLoad
    reader.readAsText(target.files[0])
  }
}

function onReaderLoad(event: ProgressEvent<FileReader>) {
  if (event.target?.result) {
    try {
      keystore.value = JSON.parse(event.target.result as string) as Keystore
      keystoreLoaded.value = true
      passphrase.value = ''
    } catch {
      alert('Invalid keystore file')
    }
  }
}

async function importAccount() {
  if (!keystore.value || !passphrase.value) return

  isImporting.value = true
  try {
    // Import keystore JSON and add to browser localStorage
    const jsonData = JSON.stringify(keystore.value)
    accountStore.importAccountJson(jsonData)

    // Verify passphrase by attempting unlock
    const imported = accountStore.accounts[accountStore.accounts.length - 1]
    await accountStore.unlockAccountLocal(imported.address, passphrase.value)

    // Reset
    keystore.value = null
    keystoreLoaded.value = false
    passphrase.value = ''
    alert('Account imported successfully')
  } catch (err) {
    alert('Failed to import: Wrong passphrase or invalid keystore')
  } finally {
    isImporting.value = false
  }
}
</script>
