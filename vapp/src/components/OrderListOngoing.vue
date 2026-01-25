<template>
  <div class="box">
    <div style="float: left;">
      <p style="margin-left: 10px; margin-bottom: 20px;">Ongoing Orders</p>
    </div>
    <table class="table fixed_header">
      <thead>
        <tr>
          <th>Market</th>
          <th>Order</th>
          <th>Type</th>
          <th>Price</th>
          <th>Note</th>
          <th>Amount</th>
          <th>Note(Received)</th>
          <th>Amount(Received)</th>
          <th>State</th>
          <th>Timestamp</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="order in ongoingOrderHistory" :key="order.orderId">
          <td>DAI-ETH</td>
          <td>{{ fmt.hexToNumberString(order.orderId) }}</td>
          <td>{{ fmt.orderType(order.type) }}</td>
          <td>{{ fmt.hexToNumberString(order.price) }}</td>
          <td>{{ fmt.abbreviate(order.makerNote) }}</td>
          <td>{{ fmt.hexToNumberString(order.makerNoteAmount) }}</td>
          <td>{{ fmt.abbreviate(order.takerNote || '') }}</td>
          <td>{{ fmt.hexToNumberString(order.takerNoteAmount || '0x0') }}</td>
          <td>{{ fmt.orderState(order.state) }}</td>
          <td>{{ order.timestamp }}</td>
          <td v-if="route.path === '/exchange' && order.type === '0x0' && order.state === '0x1'">
            <button class="button" @click="settleOrder(order)" :class="{'is-loading': loading }">Settle</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useWeb3Store } from '@/stores/web3'
import { useContractStore } from '@/stores/contract'
import { useAccountStore } from '@/stores/account'
import { useNoteStore, type Note } from '@/stores/note'
import { useOrderStore } from '@/stores/order'
import { useFormatters } from '@/composables/useFormatters'
import * as api from '@/api'
import { toBigInt, toBeHex, hexlify, randomBytes, zeroPadValue } from 'ethers'

interface OngoingOrder {
  orderId: string
  type: string
  price: string
  makerNote: string
  makerNoteAmount: string
  takerNote?: string
  takerNoteAmount?: string
  state: string
  timestamp?: string
  orderMaker?: string
  orderTaker?: string
  parentNote?: string
  sourceToken?: string
  targetToken?: string
  takerNoteToMaker?: string
}

defineProps<{
  ongoingOrderHistory: OngoingOrder[]
}>()

const route = useRoute()
const web3Store = useWeb3Store()
const contractStore = useContractStore()
const accountStore = useAccountStore()
const noteStore = useNoteStore()
const orderStore = useOrderStore()
const fmt = useFormatters()

const loading = ref(false)

function createNote(owner: string, value: string | bigint, tokenType: string, isSmart = false) {
  const salt = hexlify(randomBytes(16))
  return {
    owner,
    value: value.toString(),
    token: tokenType,
    viewingKey: '0x0',
    salt,
    isSmart: isSmart ? '0x1' : '0x0'
  }
}

async function settleOrder(order: OngoingOrder) {
  loading.value = true

  try {
    // Get maker and stake notes
    const makerNote = await api.getNoteByNoteHash(order.orderMaker!, order.makerNote)
    const stakeNote = await api.getNoteByNoteHash(order.orderMaker!, order.takerNoteToMaker!)

    const makerNoteValue = toBigInt(makerNote.value)
    const stakeNoteValue = toBigInt(stakeNote.value)
    const price = toBigInt(order.price)

    // Create settlement notes
    let rewardNote, paymentNote, changeNote

    if (makerNoteValue * price >= stakeNoteValue) {
      rewardNote = createNote(order.parentNote!, stakeNoteValue / price, order.sourceToken!, true)
      paymentNote = createNote(makerNote.hash, stakeNote.value, order.targetToken!, true)
      changeNote = createNote(makerNote.hash, makerNoteValue - stakeNoteValue / price, order.sourceToken!, true)
    } else {
      rewardNote = createNote(order.parentNote!, makerNoteValue.toString(), order.sourceToken!, true)
      paymentNote = createNote(makerNote.hash, (makerNoteValue * price).toString(), order.targetToken!, true)
      changeNote = createNote(order.parentNote!, stakeNoteValue - makerNoteValue * price, order.targetToken!, true)
    }

    // Generate proof
    const params = {
      circuit: 'settleOrder',
      inputs: {
        params: [makerNote, stakeNote, rewardNote, paymentNote, changeNote, order.price]
      }
    }
    const proofRes = await api.generateProof(params)
    const proof = proofRes.data.proof

    // Encode notes for transaction
    const encoded = hexlify(new Uint8Array(0)) // Simplified - would need proper RLP encoding

    // Execute settlement
    const proofValues = Object.values(proof as Record<string, unknown>)
    const tx = await contractStore.dexContract!.settleOrder(
      order.orderId,
      ...proofValues,
      encoded
    )

    const receipt = await tx.wait()

    if (receipt.status === 1) {
      // Update order state
      await api.updateOrderState(order.orderId, '0x2')
      await api.updateOrderHistoryState(order.orderMaker!, order.orderId, '0x2')
      await api.updateOrderHistoryState(order.orderTaker!, order.orderId, '0x2')

      // Reload data
      await noteStore.loadNotes()
      await orderStore.loadOrders()
      await orderStore.loadOrderHistory()
    }
  } catch (err) {
    console.error('Failed to settle order:', err)
  } finally {
    loading.value = false
  }
}
</script>
