<template>
  <div>
    <NoteBalanceList :accounts="accountStore.accounts" :notes="notes" @selectAccount="selectAccount" />
    <NoteList :notes="notes" @selectNote="handleSelectNote" />
    <NoteCombine ref="noteCombineRef" :account="selectedAccount" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAccountStore, type Account } from '@/stores/account'
import NoteBalanceList from '@/components/NoteBalanceList.vue'
import NoteList from '@/components/NoteList.vue'
import NoteCombine from '@/components/NoteCombine.vue'
import * as api from '@/api'
import type { Note } from '@/stores/note'

const accountStore = useAccountStore()

const selectedAccount = ref('')
const notes = ref<Note[]>([])
const noteCombineRef = ref<InstanceType<typeof NoteCombine> | null>(null)

function handleSelectNote(note: Note) {
  noteCombineRef.value?.selectNote(note)
}

onMounted(async () => {
  if (accountStore.accounts.length === 0) {
    await accountStore.loadAccounts()
  }
})

async function selectAccount(account: Account) {
  selectedAccount.value = account.address
  const fetchedNotes = await api.getNotes(account.address)
  if (fetchedNotes) {
    notes.value = fetchedNotes
  } else {
    notes.value = []
  }
}
</script>
