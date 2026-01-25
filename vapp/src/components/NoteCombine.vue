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
import { useNoteStore, type Note } from '@/stores/note'
import * as api from '@/api'
import { toBigInt } from 'ethers'
import { encodeNoteData } from '@/utils/noteEncryption'

const props = defineProps<{
  account: string
}>()

const router = useRouter()
const contractStore = useContractStore()
const noteStore = useNoteStore()
const fmt = useFormatters()

const loading = ref(false)
const selectedNotes = ref<Note[]>([])

const totalAmount = computed(() => {
  let total = BigInt(0)
  for (const note of selectedNotes.value) {
    total += toBigInt(note.value)
  }
  return total.toString()
})

interface CombineProofResponse {
  a: string[]
  b: string[][]
  c: string[]
  input: string[]
  combinedNote: {
    ownerAddress: string
    value: string
    token: string
    viewingKey: string
    salt: string
    hash: string
  }
  combinedNoteSecretKey: string
}

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

  loading.value = true

  try {
    // Generate combine proof
    const params = {
      circuit: 'combineNotes',
      inputs: {
        params: [
          {
            ownerAddress: note0.ownerAddress,
            value: note0.value,
            token: note0.token,
            viewingKey: note0.viewingKey || '0x0',
            salt: note0.salt
          },
          {
            ownerAddress: note1.ownerAddress,
            value: note1.value,
            token: note1.token,
            viewingKey: note1.viewingKey || '0x0',
            salt: note1.salt
          },
          note0.secretKey,
          note1.secretKey
        ]
      }
    }
    console.log('Generating combine proof...')
    const proofRes = await api.generateProof(params)
    const proof = proofRes.data.proof as CombineProofResponse
    console.log('Combine proof generated:', proof)

    // Convert proof values to BigInt for ethers v6
    const aBigInt = proof.a.map(v => BigInt(v))
    const bBigInt = proof.b.map(row => row.map(v => BigInt(v)))
    const cBigInt = proof.c.map(v => BigInt(v))
    const inputBigInt = proof.input.map(v => BigInt(v))

    // Encode combined note using RLP for on-chain storage
    const encryptedCombinedNote = encodeNoteData({
      ownerAddress: proof.combinedNote.ownerAddress,
      value: proof.combinedNote.value,
      token: proof.combinedNote.token,
      viewingKey: proof.combinedNote.viewingKey,
      salt: proof.combinedNote.salt
    })
    // Zero note (empty change note) - minimal encoding
    const encryptedZeroNote = encodeNoteData({
      ownerAddress: '0x0',
      value: '0x0',
      token: proof.combinedNote.token,
      viewingKey: '0x0',
      salt: '0x0'
    })

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

      // Add combined note
      const combinedNoteObj: Note = {
        owner: props.account,
        ownerAddress: proof.combinedNote.ownerAddress,
        value: proof.combinedNote.value,
        token: proof.combinedNote.token,
        viewingKey: proof.combinedNote.viewingKey,
        salt: proof.combinedNote.salt,
        isSmart: '0x0',
        hash: proof.combinedNote.hash,
        state: '0x1',
        secretKey: proof.combinedNoteSecretKey
      }
      await api.addNote(props.account, combinedNoteObj)

      // Reload notes
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
  }
}

defineExpose({ selectNote })
</script>
