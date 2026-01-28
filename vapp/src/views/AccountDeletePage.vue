<template>
  <div>
    <AccountList :accounts="accountStore.accounts" @selectAccount="selectAccount" />
    <div class="box">
      Delete account: {{ fmt.formatZkPk(accountToDelete?.publicKey) }}
      <button class="button" style="width: 100%; margin-top: 15px;" @click="deleteAccountHandler" :class="{'is-static': accountToDelete == null}">Delete</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAccountStore, type Account } from '@/stores/account'
import { useFormatters } from '@/composables/useFormatters'
import AccountList from '@/components/AccountList.vue'

const accountStore = useAccountStore()
const fmt = useFormatters()

const accountToDelete = ref<Account | null>(null)
const addressToDelete = ref('')

onMounted(async () => {
  if (accountStore.accounts.length === 0) {
    await accountStore.loadAccounts()
  }
})

function selectAccount(account: Account) {
  accountToDelete.value = account
  addressToDelete.value = account.address
}

async function deleteAccountHandler() {
  if (!accountToDelete.value) return

  accountStore.deleteAccount(accountToDelete.value)
  accountToDelete.value = null
  addressToDelete.value = ''
}
</script>
