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
        </tr>
      </thead>
      <tbody>
        <template v-if="route.path === '/exchange'">
          <tr v-for="note in orderStore.notesFilteredByOrderType" :key="note.hash" @click="selectNote(note)">
            <td>{{ fmt.abbreviate(note.hash) }}</td>
            <td>{{ fmt.abbreviateZk(note.owner) }}</td>
            <td>{{ fmt.tokenType(note.token) }}</td>
            <td>{{ fmt.hexToNumberString(note.value) }}</td>
            <td>{{ fmt.noteState(note.state) }}</td>
          </tr>
        </template>
        <template v-else-if="route.path === '/transfer' || route.path === '/convert'">
          <tr v-for="note in validNotes" :key="note.hash" @click="selectNote(note)">
            <td>{{ fmt.abbreviate(note.hash) }}</td>
            <td>{{ fmt.abbreviateZk(note.owner) }}</td>
            <td>{{ fmt.tokenType(note.token) }}</td>
            <td>{{ fmt.hexToNumberString(note.value) }}</td>
            <td>{{ fmt.noteState(note.state) }}</td>
          </tr>
        </template>
        <template v-else>
          <tr v-for="note in notes" :key="note.hash" @click="selectNote(note)">
            <td>{{ fmt.abbreviate(note.hash) }}</td>
            <td>{{ fmt.abbreviateZk(note.owner) }}</td>
            <td>{{ fmt.tokenType(note.token) }}</td>
            <td>{{ fmt.hexToNumberString(note.value) }}</td>
            <td>{{ fmt.noteState(note.state) }}</td>
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
import type { Note } from '@/stores/note'

const props = defineProps<{
  notes: Note[]
}>()

const emit = defineEmits<{
  selectNote: [note: Note]
}>()

const route = useRoute()
const orderStore = useOrderStore()
const fmt = useFormatters()

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
  width: 22%;
}

/* Owner */
.table th:nth-child(2),
.table td:nth-child(2) {
  width: 22%;
}

/* Token */
.table th:nth-child(3),
.table td:nth-child(3) {
  width: 12%;
}

/* VALUE */
.table th:nth-child(4),
.table td:nth-child(4) {
  width: 24%;
}

/* STATE */
.table th:nth-child(5),
.table td:nth-child(5) {
  width: 20%;
}

.table tbody tr {
  cursor: pointer;
}

.table tbody tr:hover {
  background-color: #f5f5f5;
}
</style>
