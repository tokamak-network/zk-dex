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
    <div v-if="proofProgress" class="field" style="margin-top: 10px;">
      <p class="help">{{ proofProgress }}</p>
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
import { encodeNoteData } from '@/utils/noteEncryption'
import { proofGenerator, type FormattedProof } from '@/lib/proofGenerator'
import { prepareTakeOrderInputs, computeCircuitHash, generateSalt, getSmartNoteOwnerAddress, hexToBigInt, type NoteData } from '@/lib/circuitInputs'

interface TakeableOrder extends Order {
  orderId: string
  makerNote: string
  makerViewingKey?: string
  orderMaker?: string
  parentNote?: string
  takerNoteToMaker?: string
  // Full maker note details (for proof generation)
  makerNoteData?: {
    ownerAddress: string
    value: string
    token: string
    viewingKey: string
    salt: string
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
const proofProgress = ref('')

function closeModal() {
  orderModalActive.value = false
}

function selectNote(note: Note) {
  selectedNote.value = note
  noteHash.value = note.hash
  noteValue.value = note.value
  proofProgress.value = ''
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

/**
 * Generate takeOrder proof entirely in browser
 */
async function generateTakeOrderProof(
  makerNoteData: NoteData,
  takerNote: Note,
  targetToken: string,
  secretKey: string
): Promise<{ proof: FormattedProof; stakeNote: NoteData & { noteHash: string } }> {
  if (!takerNote.ownerAddress) {
    throw new Error('Taker note does not have ownerAddress')
  }

  // Create taker note data
  const takerNoteData: NoteData = {
    ownerAddress: takerNote.ownerAddress,
    value: takerNote.value,
    token: takerNote.token,
    viewingKey: takerNote.viewingKey || '0x0',
    salt: takerNote.salt || '0x0'
  }

  // Compute maker note hash to derive stake note owner address
  const makerNoteHashStr = await computeCircuitHash(makerNoteData)
  const stakeOwnerAddress = getSmartNoteOwnerAddress(makerNoteHashStr)

  // Create stake note (smart note with owner = truncated hash of maker's note)
  const stakeNote: NoteData & { noteHash: string } = {
    ownerAddress: stakeOwnerAddress,
    value: takerNote.value,
    token: targetToken,
    viewingKey: takerNote.viewingKey || '0x0',
    salt: generateSalt(),
    noteHash: ''
  }
  stakeNote.noteHash = await computeCircuitHash(stakeNote)

  // Prepare circuit inputs
  const inputs = await prepareTakeOrderInputs(takerNoteData, stakeNote, secretKey)

  // Generate proof in browser Web Worker
  proofProgress.value = 'Generating proof...'
  const result = await proofGenerator.generateProof(
    'take_order',
    inputs,
    (stage, progress, message) => {
      proofProgress.value = message || `${stage}: ${Math.round(progress * 100)}%`
    }
  )

  return {
    proof: result.proof,
    stakeNote
  }
}

async function takeOrder() {
  if (!selectedOrder.value || !selectedNote.value) return

  if (!selectedNote.value.secretKey) {
    alert('Note does not have a secret key. Cannot take order.')
    return
  }

  if (!selectedNote.value.ownerAddress) {
    alert('Note does not have ownerAddress. Cannot take order.')
    return
  }

  if (!selectedOrder.value.makerNoteData) {
    alert('Order does not have maker note details. Cannot take order.')
    return
  }

  loading.value = true

  try {
    // Generate proof entirely in browser (secretKey never leaves browser!)
    console.log('Generating takeOrder proof...')
    const { proof, stakeNote } = await generateTakeOrderProof(
      selectedOrder.value.makerNoteData,
      selectedNote.value,
      selectedOrder.value.targetToken,
      selectedNote.value.secretKey
    )
    console.log('TakeOrder proof generated:', proof)
    console.log('Stake note:', stakeNote)

    // Extract proof components
    const { a, b, c, input } = proof

    // Convert proof values to BigInt for ethers v6
    const aBigInt = a.map(v => BigInt(v))
    const bBigInt = b.map(row => row.map(v => BigInt(v)))
    const cBigInt = c.map(v => BigInt(v))
    const inputBigInt = input.map(v => BigInt(v))

    // Encode stake note using RLP for on-chain storage
    const encryptedStakeNote = encodeNoteData({
      ownerAddress: stakeNote.ownerAddress,  // 160-bit truncated maker hash
      value: stakeNote.value.toString(),
      token: stakeNote.token.toString(),
      viewingKey: stakeNote.viewingKey,
      salt: stakeNote.salt.toString()
    })

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

      // Reload data from blockchain
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
    proofProgress.value = ''
  }
}

function clear() {
  orderId.value = ''
  orderPrice.value = ''
  noteHash.value = ''
  noteValue.value = ''
  selectedNote.value = null
  selectedOrder.value = null
  proofProgress.value = ''
}

defineExpose({ selectNote, selectOrders })
</script>

<style scoped>
.hoverable {
  cursor: pointer;
}
</style>
