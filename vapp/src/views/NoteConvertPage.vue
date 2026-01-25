<template>
  <div>
    <NoteList :notes="noteStore.smartNotes" @selectNote="selectNote" />
    <div class="box">
      <div class="field has-addons">
        <p class="control">
          <a class="button is-static" style="width: 140px">
            Note
          </a>
        </p>
        <p class="control is-expanded">
          <a class="button is-static" style="width: 100%;">
            {{ fmt.abbreviate(noteHash) }}
          </a>
        </p>
      </div>
      <div style="margin-top: 10px; display: flex; justify-content: flex-end">
        <button class="button" @click="convertNote" :class="{ 'is-static': noteHash === '', 'is-loading': loading }">Convert</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAccountStore } from '@/stores/account'
import { useNoteStore, type Note } from '@/stores/note'
import { useContractStore } from '@/stores/contract'
import { useFormatters } from '@/composables/useFormatters'
import NoteList from '@/components/NoteList.vue'
import * as api from '@/api'
import { toBigInt } from 'ethers'
import { encodeNoteData } from '@/utils/noteEncryption'

const router = useRouter()
const accountStore = useAccountStore()
const noteStore = useNoteStore()
const contractStore = useContractStore()
const fmt = useFormatters()

const note = ref<Note | null>(null)
const noteHash = ref('')
const loading = ref(false)
const originNote = ref<Note | null>(null)

interface ConvertProofResponse {
  a: string[]
  b: string[][]
  c: string[]
  input: string[]
  newNote: {
    ownerAddress: string
    value: string
    token: string
    viewingKey: string
    salt: string
    hash: string
  }
  newNoteSecretKey: string
}

onMounted(async () => {
  if (accountStore.accounts.length === 0) {
    await accountStore.loadAccounts()
  }
  if (contractStore.isInitialized && noteStore.notes.length === 0) {
    await noteStore.loadNotes()
  }
})

// Watch for contract initialization to load notes
watch(() => contractStore.isInitialized, async (isInitialized) => {
  if (isInitialized && noteStore.notes.length === 0) {
    await noteStore.loadNotes()
  }
})

function selectNote(selectedNote: Note) {
  note.value = selectedNote
  noteHash.value = selectedNote.hash

  // Smart notes have ownerAddress = truncated 160-bit hash of origin note
  // We need to find the origin note to convert
  if (selectedNote.isSmart === '0x1') {
    // The smart note's ownerAddress is the last 160 bits of origin note's hash
    // We need to find a note whose hash ends with this address
    const smartOwnerAddress = selectedNote.ownerAddress.toLowerCase().replace('0x', '').padStart(40, '0')

    // Find origin note by matching truncated hash
    const found = noteStore.notes.find(n => {
      const noteHashLower = n.hash.toLowerCase().replace('0x', '').padStart(64, '0')
      // Last 40 hex chars (160 bits) of hash should match ownerAddress
      return noteHashLower.slice(-40) === smartOwnerAddress
    })
    if (found) {
      originNote.value = found
    } else {
      originNote.value = null
      console.warn('Origin note not found for smart note with ownerAddress:', smartOwnerAddress)
    }
  }
}

async function convertNote() {
  if (!note.value || note.value.isSmart !== '0x1') {
    alert('Please select a smart note to convert.')
    return
  }

  if (!originNote.value) {
    alert('Cannot find the origin note for this smart note. The origin note must be in your wallet.')
    return
  }

  if (!originNote.value.secretKey) {
    alert('Origin note is missing secret key. Cannot convert.')
    return
  }

  loading.value = true

  try {
    // Generate convert proof
    const params = {
      circuit: 'convertNote',
      inputs: {
        params: [
          // Smart note data
          {
            ownerAddress: note.value.ownerAddress,
            value: note.value.value,
            token: note.value.token,
            viewingKey: note.value.viewingKey || '0x0',
            salt: note.value.salt
          },
          // Origin note data
          {
            ownerAddress: originNote.value.ownerAddress,
            value: originNote.value.value,
            token: originNote.value.token,
            viewingKey: originNote.value.viewingKey || '0x0',
            salt: originNote.value.salt
          },
          // Secret key of origin note
          originNote.value.secretKey
        ]
      }
    }
    console.log('Generating convert proof...')
    const proofRes = await api.generateProof(params)
    const proof = proofRes.data.proof as ConvertProofResponse
    console.log('Convert proof generated:', proof)

    // Convert proof values to BigInt for ethers v6
    const aBigInt = proof.a.map(v => BigInt(v))
    const bBigInt = proof.b.map(row => row.map(v => BigInt(v)))
    const cBigInt = proof.c.map(v => BigInt(v))
    const inputBigInt = proof.input.map(v => BigInt(v))

    // Encode new note using RLP for on-chain storage
    const encryptedNewNote = encodeNoteData({
      ownerAddress: proof.newNote.ownerAddress,
      value: proof.newNote.value,
      token: proof.newNote.token,
      viewingKey: proof.newNote.viewingKey,
      salt: proof.newNote.salt
    })

    // Call convert on contract (assuming there's a convert function)
    console.log('Calling contract convert...')
    const tx = await contractStore.dexContract!.convert(
      aBigInt, bBigInt, cBigInt, inputBigInt,
      encryptedNewNote
    )

    console.log('Transaction sent:', tx.hash)
    const receipt = await tx.wait()
    console.log('Transaction receipt:', receipt)

    if (receipt.status === 1) {
      // Update smart note state to SPENT
      await api.updateNoteState(note.value.owner, note.value.hash, '0x3')

      // Add new regular note
      const newNoteObj: Note = {
        owner: note.value.owner,
        ownerAddress: proof.newNote.ownerAddress,
        value: proof.newNote.value,
        token: proof.newNote.token,
        viewingKey: proof.newNote.viewingKey,
        salt: proof.newNote.salt,
        isSmart: '0x0',
        hash: proof.newNote.hash,
        state: '0x1',
        secretKey: proof.newNoteSecretKey
      }
      await api.addNote(note.value.owner, newNoteObj)

      // Reload notes
      await noteStore.loadNotes()

      alert('Note converted successfully!')
      router.push({ path: '/' })
    } else {
      alert('Transaction failed')
    }
  } catch (err) {
    console.error('Failed to convert note:', err)
    alert('Failed to convert note: ' + (err as Error).message)
  } finally {
    loading.value = false
  }
}
</script>
