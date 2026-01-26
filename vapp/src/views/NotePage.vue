<template>
  <div>
    <div v-if="action === 'mint'">
      <NoteMint :accounts="accounts" :token="token" />
    </div>
    <div v-else-if="action === 'liquidate'">
      <NoteList :notes="filteredNotes" @selectNote="handleSelectNote" />
      <NoteLiquidate ref="noteLiquidateRef" :accounts="accounts" :token="token" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAccountStore } from '@/stores/account'
import { useContractStore } from '@/stores/contract'
import { useNoteStore } from '@/stores/note'
import NoteList from '@/components/NoteList.vue'
import NoteMint from '@/components/NoteMint.vue'
import NoteLiquidate from '@/components/NoteLiquidate.vue'
import type { Note } from '@/stores/note'

const route = useRoute()
const accountStore = useAccountStore()
const contractStore = useContractStore()
const noteStore = useNoteStore()

const action = ref('')
const token = ref('')

const noteLiquidateRef = ref<InstanceType<typeof NoteLiquidate> | null>(null)

// Use filtered accounts from store (only BabyJubJub accounts)
const accounts = computed(() => accountStore.accounts)

function handleSelectNote(note: Note) {
  noteLiquidateRef.value?.selectNote(note)
}

const filteredNotes = computed(() => {
  let tokenType: string
  if (token.value === 'ETH') {
    tokenType = '0'
  } else if (token.value === 'DAI') {
    tokenType = '1'
  } else {
    return noteStore.notes
  }
  return noteStore.notes.filter(note => {
    const noteToken = BigInt(note.token).toString()
    return noteToken === tokenType && note.state === '0x1'
  })
})

onMounted(async () => {
  action.value = route.query.action as string || ''
  token.value = route.query.token as string || ''

  // Load accounts if not already loaded
  if (accountStore.accounts.length === 0) {
    await accountStore.loadAccounts()
  }

  // Load notes for liquidate action (only if contract is initialized)
  if (action.value === 'liquidate' && contractStore.isInitialized && noteStore.notes.length === 0) {
    await noteStore.loadNotes()
  }
})

// Watch for contract initialization to load notes (for liquidate action)
watch(() => contractStore.isInitialized, async (isInitialized) => {
  if (isInitialized && action.value === 'liquidate' && noteStore.notes.length === 0) {
    await noteStore.loadNotes()
  }
})
</script>
