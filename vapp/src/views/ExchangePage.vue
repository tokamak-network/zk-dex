<template>
  <div class="container">
    <div class="columns">
      <div class="column is-three-fifths">
        <div>
          <OrderRequest ref="orderRequestRef" style="margin-top: 10px" />
          <NoteList :notes="noteStore.notes" @selectNote="handleSelectNote" />
        </div>
      </div>
      <div class="column">
        <OrderList :orders="orderStore.orders" style="margin-top: 10px;" />
      </div>
    </div>
    <div class="container">
      <OrderListOngoing :ongoingOrderHistory="orderStore.ongoingOrderHistory" />
      <OrderListHistory :completedOrderHistory="orderStore.completedOrderHistory" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAccountStore } from '@/stores/account'
import { useContractStore } from '@/stores/contract'
import { useNoteStore, type Note } from '@/stores/note'
import { useOrderStore } from '@/stores/order'
import NoteList from '@/components/NoteList.vue'
import OrderList from '@/components/OrderList.vue'
import OrderRequest from '@/components/OrderRequest.vue'
import OrderListOngoing from '@/components/OrderListOngoing.vue'
import OrderListHistory from '@/components/OrderListHistory.vue'

const accountStore = useAccountStore()
const contractStore = useContractStore()
const noteStore = useNoteStore()
const orderStore = useOrderStore()

const orderRequestRef = ref<InstanceType<typeof OrderRequest> | null>(null)

function handleSelectNote(note: Note) {
  orderRequestRef.value?.selectNote(note)
}

onMounted(async () => {
  if (accountStore.accounts.length === 0) {
    await accountStore.loadAccounts()
  }
  if (contractStore.isInitialized && noteStore.notes.length === 0) {
    await noteStore.loadNotes()
  }
  if (orderStore.orderHistory.length === 0) {
    await orderStore.loadOrderHistory()
  }
  if (orderStore.orders.length === 0) {
    await orderStore.loadOrders()
  }
})

// Watch for contract initialization to load notes
watch(() => contractStore.isInitialized, async (isInitialized) => {
  if (isInitialized && noteStore.notes.length === 0) {
    await noteStore.loadNotes()
  }
})
</script>
