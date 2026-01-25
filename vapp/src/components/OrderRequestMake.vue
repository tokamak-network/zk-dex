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
}

interface MakeOrderProofResponse {
  a: string[]
  b: string[][]
  c: string[]
  input: string[]
}

async function makeNewOrder() {
  if (!selectedNote.value || !price.value) return

  if (!selectedNote.value.secretKey) {
    alert('Note does not have a secret key. Cannot make order.')
    return
  }

  if (!selectedNote.value.owner0 || !selectedNote.value.owner1) {
    alert('Note does not have owner0/owner1. Cannot make order.')
    return
  }

  loading.value = true

  try {
    // Generate proof with note data and secretKey
    const params = {
      circuit: 'makeOrder',
      inputs: {
        params: [
          {
            owner0: selectedNote.value.owner0,
            owner1: selectedNote.value.owner1,
            value: selectedNote.value.value,
            token: selectedNote.value.token,
            viewingKey: selectedNote.value.viewingKey || '0x0',
            salt: selectedNote.value.salt
          },
          selectedNote.value.secretKey
        ]
      }
    }
    console.log('Generating makeOrder proof...')
    const proofRes = await api.generateProof(params)
    const proof = proofRes.data.proof as MakeOrderProofResponse
    console.log('MakeOrder proof generated:', proof)

    // Determine target token
    const targetToken = selectedNote.value.token === ETH_TOKEN_TYPE ? DAI_TOKEN_TYPE : ETH_TOKEN_TYPE

    // Convert proof values to BigInt for ethers v6
    const aBigInt = proof.a.map(v => BigInt(v))
    const bBigInt = proof.b.map(row => row.map(v => BigInt(v)))
    const cBigInt = proof.c.map(v => BigInt(v))
    const inputBigInt = proof.input.map(v => BigInt(v))

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
  }
}

function clear() {
  noteHash.value = ''
  noteValue.value = ''
  price.value = ''
  selectedNote.value = null
}

defineExpose({ selectNote })
</script>

<style scoped>
</style>
