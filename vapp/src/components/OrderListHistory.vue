<template>
  <div class="box">
    <div style="float: left;">
      <p style="margin-left: 10px; margin-bottom: 20px;">Order History</p>
    </div>
    <table class="table fixed_header">
      <thead>
        <tr>
          <th>Order</th>
          <th>Type</th>
          <th>Price (DAI)</th>
          <th>DAI Amount</th>
          <th>ETH Amount</th>
          <th>Change</th>
          <th>State</th>
          <th>Timestamp</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="order in completedOrderHistory" :key="order.orderId">
          <td>{{ fmt.hexToNumberString(order.orderId) }}</td>
          <td>{{ fmt.orderType(order.type) }}</td>
          <td>{{ fmt.hexToNumberString(order.price) }}</td>
          <td>{{ fmt.hexToNumberString(order.makerNoteAmount) }}</td>
          <td>{{ fmt.hexToNumberString(order.takerNoteAmount || '0x0') }}</td>
          <td>{{ fmt.hexToNumberString(calculateChange(order)) }}</td>
          <td>{{ fmt.orderState(order.state) }}</td>
          <td>{{ order.timestamp }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { useFormatters } from '@/composables/useFormatters'
import { toBigInt, toBeHex } from 'ethers'

interface OrderHistoryItem {
  orderId: string
  type: string
  price: string
  makerNoteAmount: string
  takerNoteAmount?: string
  state: string
  timestamp?: string
}

defineProps<{
  completedOrderHistory: OrderHistoryItem[]
}>()

const fmt = useFormatters()

function calculateChange(order: OrderHistoryItem): string {
  const makerNoteAmount = toBigInt(order.makerNoteAmount)
  const takerNoteAmount = toBigInt(order.takerNoteAmount || '0')
  const price = toBigInt(order.price)

  if (makerNoteAmount * price >= takerNoteAmount) {
    return toBeHex(makerNoteAmount - takerNoteAmount / price)
  } else {
    return toBeHex(takerNoteAmount - makerNoteAmount * price)
  }
}
</script>
