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
      <div v-if="proofProgress" class="field" style="margin-top: 10px;">
        <p class="help">{{ proofProgress }}</p>
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
import { proofGenerator, type FormattedProof } from '@/lib/proofGenerator'
import { prepareConvertInputs, generateSalt, computeCircuitHash, type NoteData, type SmartNoteData } from '@/lib/circuitInputs'
import { logger } from '@/lib/logger'

const router = useRouter()
const accountStore = useAccountStore()
const noteStore = useNoteStore()
const contractStore = useContractStore()
const fmt = useFormatters()

const note = ref<Note | null>(null)
const noteHash = ref('')
const loading = ref(false)
const originNote = ref<Note | null>(null)
const proofProgress = ref('')

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

  // Smart notes store the parent note hash in pkX
  // We need to find the origin note to convert
  if (selectedNote.isSmart === '0x1') {
    // Smart notes store the parent note hash in pkX
    const parentHash = BigInt(selectedNote.pkX || '0').toString()

    // Find origin note by matching its hash with the smart note's parentHash
    const found = noteStore.notes.find(n => {
      try {
        return BigInt(n.hash).toString() === parentHash
      } catch {
        return false
      }
    })
    if (found) {
      originNote.value = found
    } else {
      originNote.value = null
      logger.warn('Origin note not found for smart note with parentHash:', parentHash)
    }
  }
}

/**
 * Generate convert note proof entirely in browser
 */
async function generateConvertProof(
  smartNote: Note,
  originNoteData: Note,
  newNote: NoteData,
  secretKey: string
): Promise<FormattedProof> {
  // Convert to SmartNoteData format for the smart note
  const smartNoteData: SmartNoteData = {
    parentHash: smartNote.pkX!, // pkX stores parentHash for smart notes
    value: smartNote.value,
    token: smartNote.token,
    salt: smartNote.salt || '0x0'
  }

  const originNoteDataConverted: NoteData = {
    pkX: originNoteData.pkX!,
    pkY: originNoteData.pkY!,
    value: originNoteData.value,
    token: originNoteData.token,
    salt: originNoteData.salt || '0x0'
  }

  // Prepare circuit inputs
  const inputs = await prepareConvertInputs(smartNoteData, originNoteDataConverted, newNote, secretKey)

  // Generate proof in browser Web Worker
  proofProgress.value = 'Generating convert proof...'
  const result = await proofGenerator.generateProof(
    'convert_note',
    inputs,
    (stage, progress, message) => {
      proofProgress.value = message || `${stage}: ${Math.round(progress * 100)}%`
    }
  )

  return result.proof
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

  if (!originNote.value.pkX) {
    alert('Origin note does not have pkX. Cannot convert.')
    return
  }

  if (!note.value.pkX) {
    alert('Smart note does not have pkX. Cannot convert.')
    return
  }

  loading.value = true
  proofProgress.value = ''

  try {
    // Create new regular note with same value/token but owned by user's account
    // The new note uses the same secretKey as the origin note since it comes from the same ownership
    const newNoteData: NoteData = {
      pkX: originNote.value.pkX!,
      pkY: originNote.value.pkY!,
      value: note.value.value,
      token: note.value.token,
      salt: generateSalt()
    }

    // Compute new note hash
    const newNoteHash = await computeCircuitHash(newNoteData)

    // Generate proof entirely in browser (secretKey never leaves browser!)
    logger.log('Generating convertNote proof...')
    const proof = await generateConvertProof(
      note.value,
      originNote.value,
      newNoteData,
      originNote.value.secretKey
    )
    logger.log('ConvertNote proof generated:', proof)

    // Extract proof components
    const { a, b, c, input } = proof

    // Convert proof values to BigInt for ethers v6
    const aBigInt = a.map(v => BigInt(v))
    const bBigInt = b.map(row => row.map(v => BigInt(v)))
    const cBigInt = c.map(v => BigInt(v))
    const inputBigInt = input.map(v => BigInt(v))

    // Encrypt new note for on-chain storage (ECDH with origin note owner's public key)
    const originOwnerAccount = accountStore.accounts.find(acc => acc.address === originNote.value!.owner)
    if (!originOwnerAccount?.publicKey) {
      alert('Cannot find origin note owner account. Cannot encrypt note.')
      return
    }
    const encryptedNewNote = await encodeNoteData({
      pkX: newNoteData.pkX,
      pkY: newNoteData.pkY,
      value: newNoteData.value.toString(),
      token: newNoteData.token.toString(),
      salt: newNoteData.salt.toString()
    }, originOwnerAccount.publicKey)

    // Call convert on contract
    proofProgress.value = 'Submitting transaction...'
    logger.log('Calling contract convert with:', { a: aBigInt, b: bBigInt, c: cBigInt, input: inputBigInt })
    const tx = await contractStore.dexContract!.convert(
      aBigInt, bBigInt, cBigInt, inputBigInt,
      encryptedNewNote
    )

    logger.log('Transaction sent:', tx.hash)
    const receipt = await tx.wait()
    logger.log('Transaction receipt:', receipt)

    if (receipt.status === 1) {
      // Update smart note state to SPENT
      await api.updateNoteState(note.value.owner, note.value.hash, '0x3')

      // Add new regular note (with same secretKey as origin)
      const newNoteObj: Note = {
        owner: note.value.owner,
        pkX: newNoteData.pkX,
        pkY: newNoteData.pkY,
        value: newNoteData.value.toString(),
        token: newNoteData.token.toString(),
        salt: newNoteData.salt.toString(),
        isSmart: '0x0',
        hash: newNoteHash,
        state: '0x1',
        secretKey: originNote.value.secretKey
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
    logger.error('Failed to convert note:', err)
    alert('Failed to convert note: ' + (err as Error).message)
  } finally {
    loading.value = false
    proofProgress.value = ''
  }
}
</script>
