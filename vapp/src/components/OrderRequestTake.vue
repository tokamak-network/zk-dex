<template>
  <div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">Order id</a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">{{ fmt.hexToNumberString(orderId || '0x0') }}</a>
      </p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">Price</a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">{{ fmt.hexToNumberString(orderPrice || '0x0') }}</a>
      </p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">Note</a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">{{ fmt.abbreviate(noteHash) }}</a>
      </p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">Note amount</a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">{{ fmt.hexToNumberString(noteValue || '0x0') }}</a>
      </p>
    </div>
    <div v-if="radio === 'buy'" style="margin-top: 10px; display: flex; justify-content: flex-end">
      <button class="button" @click="takeOrder" :class="{ 'is-static': orderId === '' || noteHash === '', 'is-loading': loading }">Buy DAI</button>
    </div>
    <div v-else-if="radio === 'sell'" style="margin-top: 10px; display: flex; justify-content: flex-end">
      <button class="button" @click="takeOrder" :class="{ 'is-static': orderId === '' || noteHash === '', 'is-loading': loading }">Sell DAI</button>
    </div>
    <o-modal v-model:active="orderModalActive">
      <div class="box">
        <table class="table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            <tr class="hoverable" v-for="o in availableOrders" :key="o.orderId" @click="selectOrderFromModal(o)">
              <td>{{ fmt.hexToNumberString(o.orderId) }}</td>
              <td>{{ fmt.hexToNumberString(o.price) }}</td>
            </tr>
          </tbody>
        </table>
        <div style="display: flex; justify-content: flex-end">
          <button class="button" @click="closeModal">Close</button>
        </div>
      </div>
    </o-modal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useWeb3Store } from '@/stores/web3'
import { useContractStore } from '@/stores/contract'
import { useAccountStore } from '@/stores/account'
import { useNoteStore, type Note } from '@/stores/note'
import { useOrderStore, type Order } from '@/stores/order'
import { useFormatters } from '@/composables/useFormatters'
import * as api from '@/api'
import { zeroPadValue, toBeHex, toBigInt } from 'ethers'

interface TakeableOrder extends Order {
  orderId: string
  makerNote: string
  makerViewingKey?: string
  orderMaker?: string
  parentNote?: string
  takerNoteToMaker?: string
  // Full maker note details (for proof generation)
  makerNoteData?: {
    owner0: string
    owner1: string
    value: string
    token: string
    viewingKey: string
    salt: string
  }
}

interface TakeOrderProofResponse {
  a: string[]
  b: string[][]
  c: string[]
  input: string[]
  stakeNote: {
    owner0: string
    owner1: string
    value: string
    token: string
    viewingKey: string
    salt: string
    hash: string
  }
}

defineProps<{
  radio: string
}>()

const web3Store = useWeb3Store()
const contractStore = useContractStore()
const accountStore = useAccountStore()
const noteStore = useNoteStore()
const orderStore = useOrderStore()
const fmt = useFormatters()

const orderModalActive = ref(false)
const loading = ref(false)
const orderId = ref('')
const orderPrice = ref('')
const selectedOrder = ref<TakeableOrder | null>(null)
const availableOrders = ref<TakeableOrder[]>([])
const selectedNote = ref<Note | null>(null)
const noteHash = ref('')
const noteValue = ref('')

function closeModal() {
  orderModalActive.value = false
}

function selectNote(note: Note) {
  selectedNote.value = note
  noteHash.value = note.hash
  noteValue.value = note.value
}

function selectOrderFromModal(order: TakeableOrder) {
  selectedOrder.value = order
  orderId.value = order.orderId
  orderPrice.value = order.price
  orderModalActive.value = false
}

function selectOrders(orders: TakeableOrder[]) {
  orderModalActive.value = true
  availableOrders.value = orders
}

async function takeOrder() {
  if (!selectedOrder.value || !selectedNote.value) return

  if (!selectedNote.value.secretKey) {
    alert('Note does not have a secret key. Cannot take order.')
    return
  }

  if (!selectedNote.value.owner0 || !selectedNote.value.owner1) {
    alert('Note does not have owner0/owner1. Cannot take order.')
    return
  }

  if (!selectedOrder.value.makerNoteData) {
    alert('Order does not have maker note details. Cannot take order.')
    return
  }

  loading.value = true

  try {
    // Generate proof with proper parameters
    const params = {
      circuit: 'takeOrder',
      inputs: {
        params: [
          // Parent note (maker's note)
          selectedOrder.value.makerNoteData,
          // Taker's note
          {
            owner0: selectedNote.value.owner0,
            owner1: selectedNote.value.owner1,
            value: selectedNote.value.value,
            token: selectedNote.value.token,
            viewingKey: selectedNote.value.viewingKey || '0x0',
            salt: selectedNote.value.salt
          },
          // Stake note params
          { value: selectedNote.value.value, token: selectedOrder.value.targetToken },
          // Secret key
          selectedNote.value.secretKey
        ]
      }
    }
    console.log('Generating takeOrder proof...')
    const proofRes = await api.generateProof(params)
    const proof = proofRes.data.proof as TakeOrderProofResponse
    console.log('TakeOrder proof generated:', proof)

    // Convert proof values to BigInt for ethers v6
    const aBigInt = proof.a.map(v => BigInt(v))
    const bBigInt = proof.b.map(row => row.map(v => BigInt(v)))
    const cBigInt = proof.c.map(v => BigInt(v))
    const inputBigInt = proof.input.map(v => BigInt(v))

    // Encrypt stake note
    const encryptedStakeNote = zeroPadValue(toBeHex(toBigInt(proof.stakeNote.owner0)), 32)

    // Execute take order
    console.log('Calling contract takeOrder with:', { a: aBigInt, b: bBigInt, c: cBigInt, input: inputBigInt })
    const tx = await contractStore.dexContract!.takeOrder(
      selectedOrder.value.orderId,
      aBigInt, bBigInt, cBigInt, inputBigInt,
      encryptedStakeNote
    )

    console.log('Transaction sent:', tx.hash)
    const receipt = await tx.wait()
    console.log('Transaction receipt:', receipt)

    if (receipt.status === 1) {
      const noteOwner = zeroPadValue(toBeHex(toBigInt(selectedNote.value.owner)), 20)

      // Update taker note state to TRADING
      await api.updateNoteState(noteOwner, noteHash.value, '0x2')

      // Update order state
      await api.updateOrderState(selectedOrder.value.orderId, '0x1')
      await api.updateOrderTaker(selectedOrder.value.orderId, noteOwner)

      // Save stake note
      const stakeNoteObj: Note = {
        owner: noteOwner,
        owner0: proof.stakeNote.owner0,
        owner1: proof.stakeNote.owner1,
        value: proof.stakeNote.value,
        token: proof.stakeNote.token,
        viewingKey: proof.stakeNote.viewingKey,
        salt: proof.stakeNote.salt,
        isSmart: '0x1',
        hash: proof.stakeNote.hash,
        state: '0x1'
      }
      await api.addNote(noteOwner, stakeNoteObj)

      // Reload data
      await noteStore.loadNotes()
      await orderStore.loadOrders()
      await orderStore.loadOrderHistory()

      alert('Order taken successfully!')
      clear()
    } else {
      alert('Transaction failed')
    }
  } catch (err) {
    console.error('Failed to take order:', err)
    alert('Failed to take order: ' + (err as Error).message)
  } finally {
    loading.value = false
  }
}

function clear() {
  orderId.value = ''
  orderPrice.value = ''
  noteHash.value = ''
  noteValue.value = ''
  selectedNote.value = null
  selectedOrder.value = null
}

defineExpose({ selectNote, selectOrders })
</script>

<style scoped>
.hoverable {
  cursor: pointer;
}
</style>
