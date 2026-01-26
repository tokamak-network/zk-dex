<template>
  <div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">Price</a>
      </p>
      <p class="control is-expanded">
        <input style="width: 100%; text-align: right;" class="input" type="text" placeholder="price" v-model="price" @keypress="onlyNumber">
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
      <button class="button" @click="makeNewOrder" :class="{ 'is-static': noteHash === '' || price === '', 'is-loading': loading }">Buy ETH</button>
    </div>
    <div v-else-if="radio === 'sell'" style="margin-top: 10px; display: flex; justify-content: flex-end">
      <button class="button" @click="makeNewOrder" :class="{ 'is-static': noteHash === '' || price === '', 'is-loading': loading }">Sell ETH</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useWeb3Store } from '@/stores/web3'
import { useContractStore } from '@/stores/contract'
import { useAccountStore } from '@/stores/account'
import { useNoteStore, type Note } from '@/stores/note'
import { useOrderStore } from '@/stores/order'
import { useFormatters } from '@/composables/useFormatters'
import * as api from '@/api'
import { zeroPadValue, toBeHex, toBigInt } from 'ethers'
import { proofGenerator, type FormattedProof } from '@/lib/proofGenerator'
import { prepareMakeOrderInputs, type NoteData } from '@/lib/circuitInputs'

defineProps<{
  radio: string
}>()

const web3Store = useWeb3Store()
const contractStore = useContractStore()
const accountStore = useAccountStore()
const noteStore = useNoteStore()
const orderStore = useOrderStore()
const fmt = useFormatters()

const loading = ref(false)
const selectedNote = ref<Note | null>(null)
const noteHash = ref('')
const noteValue = ref('')
const price = ref('')
const proofProgress = ref('')

const ETH_TOKEN_TYPE = '0x0'
const DAI_TOKEN_TYPE = '0x1'

function onlyNumber(event: KeyboardEvent) {
  if (event.keyCode < 48 || event.keyCode > 57) {
    event.preventDefault()
  }
}

function selectNote(note: Note) {
  selectedNote.value = note
  noteHash.value = note.hash
  noteValue.value = note.value
  proofProgress.value = ''
}

/**
 * Generate makeOrder proof entirely in browser
 */
async function generateMakeOrderProof(note: Note, secretKey: string): Promise<FormattedProof> {
  if (!note.ownerAddress) {
    throw new Error('Note does not have ownerAddress. Cannot make order.')
  }

  // Create note data for circuit input
  const noteData: NoteData = {
    ownerAddress: note.ownerAddress,
    value: note.value,
    token: note.token,
    viewingKey: note.viewingKey || '0x0',
    salt: note.salt || '0x0'
  }

  // Prepare circuit inputs
  const inputs = await prepareMakeOrderInputs(noteData, secretKey)

  // Generate proof in browser Web Worker
  proofProgress.value = 'Generating proof...'
  const result = await proofGenerator.generateProof(
    'make_order',
    inputs,
    (stage, progress, message) => {
      proofProgress.value = message || `${stage}: ${Math.round(progress * 100)}%`
    }
  )

  return result.proof
}

async function makeNewOrder() {
  if (!selectedNote.value || !price.value) return

  if (!selectedNote.value.secretKey) {
    alert('Note does not have a secret key. Cannot make order.')
    return
  }

  if (!selectedNote.value.ownerAddress) {
    alert('Note does not have ownerAddress. Cannot make order.')
    return
  }

  loading.value = true

  try {
    // Generate proof entirely in browser (secretKey never leaves browser!)
    console.log('Generating makeOrder proof...')
    const proof = await generateMakeOrderProof(selectedNote.value, selectedNote.value.secretKey)
    console.log('MakeOrder proof generated:', proof)

    // Determine target token
    const targetToken = selectedNote.value.token === ETH_TOKEN_TYPE ? DAI_TOKEN_TYPE : ETH_TOKEN_TYPE

    // Extract proof components
    const { a, b, c, input } = proof

    // Convert proof values to BigInt for ethers v6
    const aBigInt = a.map(v => BigInt(v))
    const bBigInt = b.map(row => row.map(v => BigInt(v)))
    const cBigInt = c.map(v => BigInt(v))
    const inputBigInt = input.map(v => BigInt(v))

    // Execute make order
    console.log('Calling contract makeOrder with:', { a: aBigInt, b: bBigInt, c: cBigInt, input: inputBigInt })
    const tx = await contractStore.dexContract!.makeOrder(
      selectedNote.value.token,
      targetToken,
      price.value,
      aBigInt, bBigInt, cBigInt, inputBigInt
    )

    console.log('Transaction sent:', tx.hash)
    const receipt = await tx.wait()
    console.log('Transaction receipt:', receipt)

    if (receipt.status === 1) {
      const noteOwner = zeroPadValue(toBeHex(toBigInt(selectedNote.value.owner)), 20)

      // Update note state to TRADING
      await api.updateNoteState(noteOwner, noteHash.value, '0x2')

      // Reload data
      await noteStore.loadNotes()
      await orderStore.loadOrders()
      await orderStore.loadOrderHistory()

      alert('Order created successfully!')
      clear()
    } else {
      alert('Transaction failed')
    }
  } catch (err) {
    console.error('Failed to make order:', err)
    alert('Failed to make order: ' + (err as Error).message)
  } finally {
    loading.value = false
    proofProgress.value = ''
  }
}

function clear() {
  noteHash.value = ''
  noteValue.value = ''
  price.value = ''
  selectedNote.value = null
  proofProgress.value = ''
}

defineExpose({ selectNote })
</script>

<style scoped>
</style>
