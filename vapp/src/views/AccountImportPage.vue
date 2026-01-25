<template>
  <div>
    <AccountList :accounts="accountStore.accounts" />
    <input type="file" id="file" @change="onChange">
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAccountStore } from '@/stores/account'
import AccountList from '@/components/AccountList.vue'
import * as api from '@/api'

interface Keystore {
  address: string
  crypto: unknown
  id: string
  version: number
}

const accountStore = useAccountStore()

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
    const keystore = JSON.parse(event.target.result as string) as Keystore
    importAccount(keystore)
  }
}

async function importAccount(keystore: Keystore) {
  const account = {
    keystore,
    address: `0x${keystore.address}`,
    publicKey: { x: '', y: '' },
    name: '',
    numberOfNotes: 0
  }

  await api.addAccount(accountStore.key!, account)
  accountStore.addAccount(account)
}
</script>
