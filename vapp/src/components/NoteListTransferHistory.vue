<template>
  <div class="box">
    <div style="float: left;">
      <p style="margin-left: 10px; margin-bottom: 20px;">Recent Note Transfer</p>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>Note</th>
          <th>Type</th>
          <th>Token</th>
          <th>Value</th>
          <th>From</th>
          <th>To</th>
          <th>Change</th>
          <th>Transaction</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="note in transferNotes" :key="note.hash">
          <td>{{ fmt.abbreviate(note.hash) }}</td>
          <td>{{ fmt.transferNoteType(note.type) }}</td>
          <td>{{ fmt.tokenType(note.token) }}</td>
          <td>{{ fmt.hexToNumberString(note.value) }}</td>
          <td>{{ fmt.abbreviateZk(note.from || '') }}</td>
          <td>{{ fmt.abbreviateZk(note.to || '') }}</td>
          <td>{{ note.change ? fmt.hexToNumberString(note.change) : '' }}</td>
          <td>{{ fmt.abbreviate(note.transactionHash || '') }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { useFormatters } from '@/composables/useFormatters'

interface TransferNoteDisplay {
  hash: string
  type: string
  token: string
  value: string
  from?: string
  to?: string
  change?: string
  transactionHash?: string
}

defineProps<{
  transferNotes: TransferNoteDisplay[]
}>()

const fmt = useFormatters()
</script>
