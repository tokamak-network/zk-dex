<template>
  <div style="text-align: center;" class="box">
    <h2 style="margin-bottom: 40px;">ORDER BOOK</h2>
    <table class="table fixed_header">
      <thead>
        <tr>
          <th>PRICE(DAI)</th>
          <th>Orders</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(count, price) in orderStore.orderList" :key="price" @click="selectOrders(price as string)">
          <td>{{ fmt.hexToNumberString(price as string) }}</td>
          <td>{{ count }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { useOrderStore, type Order } from '@/stores/order'
import { useFormatters } from '@/composables/useFormatters'

const props = defineProps<{
  orders: Order[]
}>()

const emit = defineEmits<{
  selectOrders: [orders: Order[]]
}>()

const orderStore = useOrderStore()
const fmt = useFormatters()

function selectOrders(price: string) {
  const orders = props.orders.filter(o => o.price === price && o.state === '0x0')
  emit('selectOrders', orders)
}
</script>
