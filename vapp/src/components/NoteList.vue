<template>
  <div class="box" style="text-align: center;">
    <div style="float: left;">
      <p style="margin-left: 10px; margin-bottom: 20px;">Notes</p>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>Note Hash</th>
          <th>Owner</th>
          <th>Token</th>
          <th>VALUE</th>
          <th>STATE</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        <template v-if="route.path === '/exchange'">
          <tr v-for="note in orderStore.notesFilteredByOrderType" :key="note.hash" @click="selectNote(note)">
            <td>{{ fmt.abbreviate(note.hash) }}</td>
            <td>{{ fmt.formatZkPk(ownerPk(note.owner)) }}</td>
            <td>{{ fmt.tokenType(note.token) }}</td>
            <td>{{ fmt.formatNoteValue(note.value) }}</td>
            <td>{{ fmt.noteState(note.state) }}</td>
            <td>{{ fmt.formatTimestamp(note.createdAt) }}</td>
          </tr>
        </template>
        <template v-else-if="route.path === '/transfer' || route.path === '/convert'">
          <tr v-for="note in validNotes" :key="note.hash" @click="selectNote(note)">
            <td>{{ fmt.abbreviate(note.hash) }}</td>
            <td>{{ fmt.formatZkPk(ownerPk(note.owner)) }}</td>
            <td>{{ fmt.tokenType(note.token) }}</td>
            <td>{{ fmt.formatNoteValue(note.value) }}</td>
            <td>{{ fmt.noteState(note.state) }}</td>
            <td>{{ fmt.formatTimestamp(note.createdAt) }}</td>
          </tr>
        </template>
        <template v-else>
          <tr v-for="note in notes" :key="note.hash" @click="selectNote(note)">
            <td>{{ fmt.abbreviate(note.hash) }}</td>
            <td>{{ fmt.formatZkPk(ownerPk(note.owner)) }}</td>
            <td>{{ fmt.tokenType(note.token) }}</td>
            <td>{{ fmt.formatNoteValue(note.value) }}</td>
            <td>{{ fmt.noteState(note.state) }}</td>
            <td>{{ fmt.formatTimestamp(note.createdAt) }}</td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useOrderStore } from '@/stores/order'
import { useFormatters } from '@/composables/useFormatters'
import { useAccountStore } from '@/stores/account'
import type { Note } from '@/stores/note'

const props = defineProps<{
  notes: Note[]
}>()

const emit = defineEmits<{
  selectNote: [note: Note]
}>()

const route = useRoute()
const orderStore = useOrderStore()
const accountStore = useAccountStore()
const fmt = useFormatters()

function ownerPk(owner: string) {
  const acc = accountStore.accounts.find(a => a.address === owner)
  return acc?.publicKey
}

const validNotes = computed(() => {
  return props.notes.filter(note => note.state === '0x1')
})

function selectNote(note: Note) {
  emit('selectNote', note)
}
</script>

<style scoped>
.table {
  width: 100%;
  table-layout: fixed;
}

.table th,
.table td {
  text-align: center;
  vertical-align: middle;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0.5em 0.75em;
}

/* Note Hash */
.table th:nth-child(1),
.table td:nth-child(1) {
  width: 18%;
}

/* Owner */
.table th:nth-child(2),
.table td:nth-child(2) {
  width: 18%;
}

/* Token */
.table th:nth-child(3),
.table td:nth-child(3) {
  width: 10%;
}

/* VALUE */
.table th:nth-child(4),
.table td:nth-child(4) {
  width: 16%;
}

/* STATE */
.table th:nth-child(5),
.table td:nth-child(5) {
  width: 14%;
}

/* Created */
.table th:nth-child(6),
.table td:nth-child(6) {
  width: 24%;
}

.table tbody tr {
  cursor: pointer;
}

.table tbody tr:hover {
  background-color: #f5f5f5;
}
</style>
