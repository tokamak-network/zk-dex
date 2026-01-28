<template>
  <div class="box">
    <div style="float: left;">
      <p style="margin-left: 10px; margin-bottom: 20px;">Ongoing Orders</p>
    </div>
    <div v-if="proofProgress" class="notification is-info is-light" style="margin: 10px;">
      <p>{{ proofProgress }}</p>
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
import { encodeNoteData } from '@/utils/noteEncryption'
import { proofGenerator, type FormattedProof } from '@/lib/proofGenerator'
import { prepareSettleOrderInputs, generateSalt, computeCircuitHash, computeSmartNoteHash, hexToBigInt, type NoteData, type SmartNoteData } from '@/lib/circuitInputs'

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
const proofProgress = ref('')

/**
 * Create smart note data for circuit input (settlement notes are all smart notes)
 */
function createSmartNoteData(parentHash: string, value: string | bigint, tokenType: string): SmartNoteData {
  return {
    parentHash,
    value: value.toString(),
    token: tokenType,
    salt: generateSalt()
  }
}

/**
 * Compute division witness values for settle order circuit
 * The circuit verifies: dividend = quotient * divisor + remainder
 */
function computeDivisionWitness(dividend: bigint, divisor: bigint): { q: string; r: string } {
  if (divisor === BigInt(0)) {
    return { q: '0', r: '0' }
  }
  const q = dividend / divisor
  const r = dividend % divisor
  return { q: q.toString(), r: r.toString() }
}

/**
 * Generate settle order proof entirely in browser
 */
async function generateSettleOrderProof(
  makerNote: Note,
  stakeNote: Note,
  rewardNote: SmartNoteData,
  paymentNote: SmartNoteData,
  changeNote: SmartNoteData,
  price: bigint,
  secretKey: string
): Promise<FormattedProof> {
  // Convert maker note to NoteData format (pkX/pkY-based)
  const makerNoteData: NoteData = {
    pkX: makerNote.pkX!,
    pkY: makerNote.pkY!,
    value: makerNote.value,
    token: makerNote.token,
    salt: makerNote.salt || '0x0'
  }

  // Stake note is a smart note (parentHash-based)
  // pkX stores the parentHash for smart notes
  const stakeNoteData: SmartNoteData = {
    parentHash: stakeNote.pkX!,
    value: stakeNote.value,
    token: stakeNote.token,
    salt: stakeNote.salt || '0x0'
  }

  // Compute division witnesses for circuit verification
  const makerValue = hexToBigInt(makerNote.value)
  const stakeValue = hexToBigInt(stakeNote.value)

  // q0, r0: stakeValue / price = q0 * price + r0
  const { q: q0, r: r0 } = computeDivisionWitness(stakeValue, price)

  // q1, r1: makerValue * price / 1 (for potential overflow handling)
  const { q: q1, r: r1 } = computeDivisionWitness(makerValue * price, BigInt(1))

  // Prepare circuit inputs
  const inputs = await prepareSettleOrderInputs(
    makerNoteData,
    stakeNoteData,
    rewardNote,
    paymentNote,
    changeNote,
    price.toString(),
    secretKey,
    q0, r0, q1, r1
  )

  // Generate proof in browser Web Worker
  proofProgress.value = 'Generating settle order proof (this may take a while)...'
  const result = await proofGenerator.generateProof(
    'settle_order',
    inputs,
    (stage, progress, message) => {
      proofProgress.value = message || `${stage}: ${Math.round(progress * 100)}%`
    }
  )

  return result.proof
}

async function settleOrder(order: OngoingOrder) {
  loading.value = true
  proofProgress.value = ''

  try {
    // Get the secret key from the note store (maker's note)
    const myNotes = noteStore.notes.filter(n => n.hash === order.makerNote)
    if (myNotes.length === 0) {
      alert('Maker note not found in your notes. You can only settle orders you created.')
      return
    }

    const myMakerNote = myNotes[0]
    if (!myMakerNote.secretKey) {
      alert('Note does not have a secret key. Please unlock your account first.')
      return
    }

    if (!myMakerNote.pkX) {
      alert('Note does not have pkX. Cannot settle order.')
      return
    }

    // Get maker and stake notes (full data from API)
    proofProgress.value = 'Loading note data...'
    const makerNote = await api.getNoteByNoteHash(order.orderMaker!, order.makerNote)
    const stakeNote = await api.getNoteByNoteHash(order.orderMaker!, order.takerNoteToMaker!)

    const makerNoteValue = toBigInt(makerNote.value)
    const stakeNoteValue = toBigInt(stakeNote.value)
    const price = toBigInt(order.price)

    // Compute the maker note hash (used as parentHash for smart notes)
    const makerFullHash = await computeCircuitHash({
      pkX: myMakerNote.pkX!,
      pkY: myMakerNote.pkY!,
      value: myMakerNote.value,
      token: myMakerNote.token,
      salt: myMakerNote.salt || '0x0'
    })

    // Create settlement notes (smart notes using parentHash)
    let rewardNote: SmartNoteData, paymentNote: SmartNoteData, changeNote: SmartNoteData

    if (makerNoteValue * price >= stakeNoteValue) {
      // Maker has enough: reward gets stake/price, payment gets all stake, change is remainder
      rewardNote = createSmartNoteData(order.parentNote!, stakeNoteValue / price, order.sourceToken!)
      paymentNote = createSmartNoteData(makerFullHash, stakeNote.value, order.targetToken!)
      changeNote = createSmartNoteData(makerFullHash, (makerNoteValue - stakeNoteValue / price).toString(), order.sourceToken!)
    } else {
      // Maker doesn't have enough: reward gets all maker value, payment is maker*price
      rewardNote = createSmartNoteData(order.parentNote!, makerNoteValue.toString(), order.sourceToken!)
      paymentNote = createSmartNoteData(makerFullHash, (makerNoteValue * price).toString(), order.targetToken!)
      changeNote = createSmartNoteData(order.parentNote!, (stakeNoteValue - makerNoteValue * price).toString(), order.targetToken!)
    }

    // Generate proof entirely in browser (secretKey never leaves browser!)
    console.log('Generating settleOrder proof...')
    const proof = await generateSettleOrderProof(
      { ...makerNote, pkX: myMakerNote.pkX!, pkY: myMakerNote.pkY!, secretKey: myMakerNote.secretKey },
      { ...stakeNote, pkX: stakeNote.pkX || makerFullHash },
      rewardNote,
      paymentNote,
      changeNote,
      price,
      myMakerNote.secretKey
    )
    console.log('SettleOrder proof generated:', proof)

    // Extract proof components
    const { a, b, c, input } = proof

    // Convert proof values to BigInt for ethers v6
    const aBigInt = a.map(v => BigInt(v))
    const bBigInt = b.map(row => row.map(v => BigInt(v)))
    const cBigInt = c.map(v => BigInt(v))
    const inputBigInt = input.map(v => BigInt(v))

    // Encrypt notes for on-chain storage (ECDH)
    // All 3 settlement notes are smart notes. Encrypt with maker's pk (maker is settling).
    // The taker's smart notes will be re-encrypted during convertNote with the converter's pk.
    const makerAccount = accountStore.accounts.find(acc => acc.address === myMakerNote.owner)
    if (!makerAccount?.publicKey) {
      alert('Cannot find maker account. Cannot encrypt notes.')
      return
    }
    const encodedReward = await encodeNoteData({
      pkX: rewardNote.parentHash,
      pkY: '0x0',
      value: rewardNote.value.toString(),
      token: rewardNote.token.toString(),
      salt: rewardNote.salt.toString()
    }, makerAccount.publicKey)
    const encodedPayment = await encodeNoteData({
      pkX: paymentNote.parentHash,
      pkY: '0x0',
      value: paymentNote.value.toString(),
      token: paymentNote.token.toString(),
      salt: paymentNote.salt.toString()
    }, makerAccount.publicKey)
    const encodedChange = await encodeNoteData({
      pkX: changeNote.parentHash,
      pkY: '0x0',
      value: changeNote.value.toString(),
      token: changeNote.token.toString(),
      salt: changeNote.salt.toString()
    }, makerAccount.publicKey)

    // Execute settlement
    proofProgress.value = 'Submitting transaction...'
    console.log('Calling contract settleOrder with:', { a: aBigInt, b: bBigInt, c: cBigInt, input: inputBigInt })
    const tx = await contractStore.dexContract!.settleOrder(
      order.orderId,
      aBigInt, bBigInt, cBigInt, inputBigInt,
      encodedReward,
      encodedPayment,
      encodedChange
    )

    console.log('Transaction sent:', tx.hash)
    const receipt = await tx.wait()
    console.log('Transaction receipt:', receipt)

    if (receipt.status === 1) {
      // Update order state
      await api.updateOrderState(order.orderId, '0x2')
      await api.updateOrderHistoryState(order.orderMaker!, order.orderId, '0x2')
      await api.updateOrderHistoryState(order.orderTaker!, order.orderId, '0x2')

      // Reload data
      await noteStore.loadNotes()
      await orderStore.loadOrders()
      await orderStore.loadOrderHistory()

      alert('Order settled successfully!')
    } else {
      alert('Transaction failed')
    }
  } catch (err) {
    console.error('Failed to settle order:', err)
    alert('Failed to settle order: ' + (err as Error).message)
  } finally {
    loading.value = false
    proofProgress.value = ''
  }
}
</script>
