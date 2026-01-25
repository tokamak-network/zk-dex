<template>
  <div>
    <OrderListOngoing :ongoingOrderHistory="orderStore.ongoingOrderHistory" />
    <OrderListHistory :completedOrderHistory="orderStore.completedOrderHistory" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAccountStore } from '@/stores/account'
import { useOrderStore } from '@/stores/order'
import OrderListOngoing from '@/components/OrderListOngoing.vue'
import OrderListHistory from '@/components/OrderListHistory.vue'

const accountStore = useAccountStore()
const orderStore = useOrderStore()

onMounted(async () => {
  if (accountStore.accounts.length === 0) {
    await accountStore.loadAccounts()
  }
  if (orderStore.orderHistory.length === 0) {
    await orderStore.loadOrderHistory()
  }
})
</script>
