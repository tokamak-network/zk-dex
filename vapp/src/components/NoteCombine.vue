<template>
  <div class="box" style="text-align: center;">
    <div style="float: left;">
      <p style="margin-left: 10px; margin-bottom: 20px;">Selected Notes</p>
    </div>
    <table class="table fixed_header">
      <thead>
        <tr>
          <th>Note Hash</th>
          <th>Owner</th>
          <th>Token</th>
          <th>VALUE</th>
          <th>STATE</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="note in selectedNotes" :key="note.hash" @click="unselectNote(note)">
          <td>{{ fmt.abbreviate(note.hash) }}</td>
          <td>{{ fmt.abbreviateZk(note.owner) }}</td>
          <td>{{ fmt.tokenType(fmt.hexToNumberString(note.token)) }}</td>
          <td>{{ fmt.hexToNumberString(note.value) }}</td>
          <td>{{ fmt.noteState(note.state) }}</td>
        </tr>
      </tbody>
    </table>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">Total Amount</a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">{{ totalAmount }}</a>
      </p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">To</a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">{{ fmt.abbreviateZk(account) }}</a>
      </p>
    </div>
    <div v-if="proofProgress" class="field" style="margin-top: 10px;">
      <p class="help">{{ proofProgress }}</p>
    </div>
    <div style="margin-top: 10px; display: flex; justify-content: flex-end">
      <button class="button" @click="combineNote" :class="{ 'is-static': selectedNotes.length === 0, 'is-loading': loading }">Combine</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useFormatters } from '@/composables/useFormatters'
import { useContractStore } from '@/stores/contract'
import { useAccountStore } from '@/stores/account'
import { useNoteStore, type Note } from '@/stores/note'
import * as api from '@/api'
import { toBigInt } from 'ethers'
import { encodeNoteData } from '@/utils/noteEncryption'
import { proofGenerator, type FormattedProof } from '@/lib/proofGenerator'
import { prepareTransferInputs, computeCircuitHash, generateSalt, type NoteData } from '@/lib/circuitInputs'

const props = defineProps<{
  account: string
}>()

const router = useRouter()
const contractStore = useContractStore()
const accountStore = useAccountStore()
const noteStore = useNoteStore()
const fmt = useFormatters()

const loading = ref(false)
const selectedNotes = ref<Note[]>([])
const proofProgress = ref('')

const totalAmount = computed(() => {
  let total = BigInt(0)
  for (const note of selectedNotes.value) {
    total += toBigInt(note.value)
  }
  return total.toString()
})

// Get the account for the combined note
const ownerAccount = computed(() => {
  return accountStore.accounts.find(acc => acc.address === props.account)
})

function selectNote(note: Note) {
  // Limit to 2 notes (transfer circuit limitation)
  if (selectedNotes.value.length >= 2) {
    alert('Can only combine 2 notes at a time. Unselect a note first.')
    return
  }
  if (!selectedNotes.value.find(n => n.hash === note.hash)) {
    // Validate notes have same token type
    if (selectedNotes.value.length > 0 && selectedNotes.value[0].token !== note.token) {
      alert('Cannot combine notes with different token types.')
      return
    }
    // Validate notes have secretKey
    if (!note.secretKey || !note.ownerAddress) {
      alert('Note is missing required data (secretKey/ownerAddress). Cannot combine.')
      return
    }
    selectedNotes.value.push(note)
  }
}

function unselectNote(note: Note) {
  const index = selectedNotes.value.findIndex(n => n.hash === note.hash)
  if (index > -1) {
    selectedNotes.value.splice(index, 1)
  }
}

/**
 * Generate combine proof entirely in browser
 * Uses transfer_note circuit with 2 inputs -> 1 combined output + 0 change
 */
async function generateCombineProof(
  note0: Note,
  note1: Note,
  ownerAddress: string
): Promise<{ proof: FormattedProof; combinedNote: NoteData & { noteHash: string } }> {
  if (!note0.secretKey || !note1.secretKey) {
    throw new Error('Notes are missing secret keys. Cannot combine.')
  }

  // Create note data for both input notes
  const noteData0: NoteData = {
    ownerAddress: note0.ownerAddress!,
    value: note0.value,
    token: note0.token,
    viewingKey: note0.viewingKey || '0x0',
    salt: note0.salt || '0x0'
  }

  const noteData1: NoteData = {
    ownerAddress: note1.ownerAddress!,
    value: note1.value,
    token: note1.token,
    viewingKey: note1.viewingKey || '0x0',
    salt: note1.salt || '0x0'
  }

  // Create combined note (new note with total value)
  const combinedValue = (toBigInt(note0.value) + toBigInt(note1.value)).toString()

  const combinedNote: NoteData & { noteHash: string } = {
    ownerAddress,
    value: combinedValue,
    token: note0.token,
    viewingKey: ownerAddress,
    salt: generateSalt(),
    noteHash: ''
  }
  combinedNote.noteHash = await computeCircuitHash(combinedNote)

  // Create zero change note (no change in combine operation)
  const zeroNote: NoteData = {
    ownerAddress: ownerAddress,
    value: '0',
    token: note0.token,
    viewingKey: ownerAddress,
    salt: generateSalt()
  }

  // Prepare circuit inputs (2 old notes -> combined note + zero change note)
  const inputs = await prepareTransferInputs(
    noteData0,
    noteData1,
    combinedNote,
    zeroNote,
    note0.secretKey,
    note1.secretKey
  )

  // Generate proof in browser Web Worker
  proofProgress.value = 'Generating proof...'
  const result = await proofGenerator.generateProof(
    'transfer_note',
    inputs,
    (stage, progress, message) => {
      proofProgress.value = message || `${stage}: ${Math.round(progress * 100)}%`
    }
  )

  return {
    proof: result.proof,
    combinedNote
  }
}

async function combineNote() {
  if (selectedNotes.value.length < 2) {
    alert('Select 2 notes to combine.')
    return
  }

  const note0 = selectedNotes.value[0]
  const note1 = selectedNotes.value[1]

  if (!note0.secretKey || !note1.secretKey) {
    alert('Notes are missing secret keys. Cannot combine.')
    return
  }

  if (!ownerAccount.value) {
    alert('Owner account not found.')
    return
  }

  loading.value = true

  try {
    // Generate combine proof entirely in browser (secretKeys never leave browser!)
    console.log('Generating combine proof...')
    const { proof, combinedNote } = await generateCombineProof(
      note0,
      note1,
      ownerAccount.value.address
    )
    console.log('Combine proof generated:', proof)
    console.log('Combined note:', combinedNote)

    // Extract proof components
    const { a, b, c, input } = proof

    // Convert proof values to BigInt for ethers v6
    const aBigInt = a.map(v => BigInt(v))
    const bBigInt = b.map(row => row.map(v => BigInt(v)))
    const cBigInt = c.map(v => BigInt(v))
    const inputBigInt = input.map(v => BigInt(v))

    // Encrypt combined note for on-chain storage (ECDH with owner's public key)
    const encryptedCombinedNote = await encodeNoteData({
      ownerAddress: combinedNote.ownerAddress,
      value: combinedNote.value.toString(),
      token: combinedNote.token.toString(),
      viewingKey: combinedNote.viewingKey,
      salt: combinedNote.salt.toString()
    }, ownerAccount.value!.publicKey)
    // Zero note (empty change note) - encrypt with owner's pk for consistency
    const encryptedZeroNote = await encodeNoteData({
      ownerAddress: '0x0',
      value: '0x0',
      token: combinedNote.token.toString(),
      viewingKey: '0x0',
      salt: '0x0'
    }, ownerAccount.value!.publicKey)

    // Call spend (transfer) on contract
    console.log('Calling contract spend with:', { a: aBigInt, b: bBigInt, c: cBigInt, input: inputBigInt })
    const tx = await contractStore.dexContract!.spend(
      aBigInt, bBigInt, cBigInt, inputBigInt,
      encryptedCombinedNote,
      encryptedZeroNote
    )

    console.log('Transaction sent:', tx.hash)
    const receipt = await tx.wait()
    console.log('Transaction receipt:', receipt)

    if (receipt.status === 1) {
      // Update original notes state to SPENT
      await api.updateNoteState(note0.owner, note0.hash, '0x3')
      await api.updateNoteState(note1.owner, note1.hash, '0x3')

      // Reload notes from blockchain
      await noteStore.loadNotes()

      alert('Notes combined successfully!')
      selectedNotes.value = []
      router.push({ path: '/' })
    } else {
      alert('Transaction failed')
    }
  } catch (err) {
    console.error('Failed to combine notes:', err)
    alert('Failed to combine notes: ' + (err as Error).message)
  } finally {
    loading.value = false
    proofProgress.value = ''
  }
}

defineExpose({ selectNote })
</script>
