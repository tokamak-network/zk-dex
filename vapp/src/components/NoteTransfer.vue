<template>
  <div class="box">
    <div style="float: left;">
      <p style="margin-left: 10px; margin-bottom: 20px;">Transfer</p>
    </div>
    <div class="block" style="display: flex; justify-content: flex-end">
      <o-switch v-model="isSelfTransfer">self-transfer</o-switch>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">From</a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">{{ fmt.formatZkPk(senderAccount?.publicKey) }}</a>
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
        <a class="button is-static" style="width: 140px">Value</a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">{{ formatNoteValue(noteValue) }}</a>
      </p>
    </div>
    <div class="field has-addons" style="margin-top: 40px;">
      <p class="control">
        <a class="button is-static" style="width: 140px">To</a>
      </p>
      <p class="control is-expanded">
        <template v-if="isSelfTransfer">
          <div class="select is-fullwidth">
            <select v-model="toAccountAddress">
              <option value="">Select account...</option>
              <option
                v-for="acc in accountStore.accounts"
                :key="acc.address"
                :value="acc.address"
              >{{ fmt.formatZkPk(acc.publicKey) }}</option>
            </select>
          </div>
        </template>
        <template v-else>
          <input
            style="width: 100%;"
            class="input"
            type="text"
            placeholder="Recipient z-pk JSON ({&quot;x&quot;:&quot;0x...&quot;,&quot;y&quot;:&quot;0x...&quot;})"
            v-model="toAccountAddress"
          >
        </template>
      </p>
    </div>
    <!-- Public key is resolved internally from local account lookup -->
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">Amount</a>
      </p>
      <p class="control is-expanded">
        <input style="width: 100%; text-align: right;" class="input" type="text" v-model="amount" @keypress="onlyNumber">
      </p>
    </div>
    <div v-if="proofProgress" class="field" style="margin-top: 10px;">
      <p class="help">{{ proofProgress }}</p>
    </div>
    <div style="margin-top: 20px; display: flex; justify-content: flex-end">
      <button
        class="button action-button"
        @click="handleTransferClick"
        :class="{ 'is-static': !canClickTransfer, 'is-loading': loading }"
      >Transfer</button>
    </div>
    <!-- Passphrase modal -->
    <o-modal v-model:active="showPassphraseModal">
      <div class="box" style="width: 400px; position: relative;">
        <button class="delete" style="position: absolute; top: 10px; right: 10px;" @click="showPassphraseModal = false"></button>
        <p class="title is-5">Enter Passphrase</p>
        <p class="subtitle is-6">Unlock account to transfer note</p>
        <div class="field">
          <p class="control">
            <input class="input" type="password" v-model="passphrase" placeholder="Passphrase" @keyup.enter="confirmPassphrase">
          </p>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button class="button" @click="showPassphraseModal = false">Cancel</button>
          <button class="button action-button" :class="{ 'is-loading': unlocking }" @click="confirmPassphrase" :disabled="!passphrase">Confirm</button>
        </div>
      </div>
    </o-modal>
    <o-modal v-model:active="createAccountModalActive">
      <div class="box" style="position: relative;">
        <button class="delete" style="position: absolute; top: 10px; right: 10px;" @click="closeModal"></button>
        <table class="table">
          <thead>
            <tr>
              <th>z-pk</th>
            </tr>
          </thead>
          <tbody>
            <tr class="hoverable" v-for="acc in accountStore.accounts" :key="acc.address" @click="selectAccountFromModal(acc)">
              <td>{{ fmt.formatZkPk(acc.publicKey) }}</td>
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
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useContractStore } from '@/stores/contract'
import { useAccountStore, type Account } from '@/stores/account'
import { useNoteStore, type Note } from '@/stores/note'
import { useFormatters } from '@/composables/useFormatters'
import * as api from '@/api'
import { toBigInt, parseEther, formatEther } from 'ethers'
import { encodeNoteData } from '@/utils/noteEncryption'
import { proofGenerator, type FormattedProof } from '@/lib/proofGenerator'
import { prepareTransferInputs, computeCircuitHash, generateSalt, type NoteData } from '@/lib/circuitInputs'
import { logger } from '@/lib/logger'

const emit = defineEmits<{
  complete: []
}>()

const router = useRouter()
const contractStore = useContractStore()
const accountStore = useAccountStore()
const noteStore = useNoteStore()
const fmt = useFormatters()

const createAccountModalActive = ref(false)
const loading = ref(false)
const unlocking = ref(false)
const selectedNote = ref<Note | null>(null)
const noteOwner = ref('')
const noteHash = ref('')
const noteValue = ref('')
const toAccountAddress = ref('')
const amount = ref('')
const isSelfTransfer = ref(false)
const passphrase = ref('')
const unlockedSecretKey = ref('')
const showPassphraseModal = ref(false)
const proofProgress = ref('')

// Get the sender account object with publicKey
const senderAccount = computed(() => {
  return accountStore.accounts.find(acc => acc.address === noteOwner.value)
})

// Get the effective secret key (either from note or from unlock)
const effectiveSecretKey = computed(() => {
  return selectedNote.value?.secretKey || unlockedSecretKey.value
})

// Can we click the transfer button? (doesn't require secretKey yet)
const canClickTransfer = computed(() => {
  return noteHash.value !== '' &&
         amount.value !== '' &&
         toAccountAddress.value !== ''
})

function onlyNumber(event: KeyboardEvent) {
  const char = event.key
  // Allow digits (0-9) and decimal point (.)
  if (!/^\d$/.test(char) && char !== '.') {
    event.preventDefault()
    return
  }
  // Allow only one decimal point
  if (char === '.' && amount.value.includes('.')) {
    event.preventDefault()
  }
}

function formatNoteValue(value: string): string {
  if (!value || value === '0x0') return '0'
  try {
    const wei = toBigInt(value)
    const ether = formatEther(wei)
    // Determine token symbol based on selected note
    const token = selectedNote.value?.token === '0x1' ? 'DAI' : 'ETH'
    return `${ether} ${token}`
  } catch {
    return '0'
  }
}

function closeModal() {
  createAccountModalActive.value = false
}

function selectNote(note: Note) {
  selectedNote.value = note
  // note.owner is already formatted (either 20-byte address or stored format)
  noteOwner.value = note.owner
  noteHash.value = note.hash
  noteValue.value = note.value
  // Reset unlock state
  unlockedSecretKey.value = ''
  passphrase.value = ''
  showPassphraseModal.value = false
  proofProgress.value = ''
  // Reset recipient fields
  toAccountAddress.value = isSelfTransfer.value ? noteOwner.value : ''
}

function selectAccountFromModal(account: Account) {
  toAccountAddress.value = account.address
  closeModal()
}

function handleTransferClick() {
  if (!canClickTransfer.value) return

  // If note already has secretKey, proceed directly
  if (selectedNote.value?.secretKey) {
    unlockedSecretKey.value = selectedNote.value.secretKey
    doTransfer()
  } else {
    // Show passphrase modal to unlock account
    showPassphraseModal.value = true
  }
}

async function confirmPassphrase() {
  if (!senderAccount.value || !passphrase.value) return

  logger.log('[NoteTransfer] confirmPassphrase called')
  logger.log('[NoteTransfer] noteOwner.value:', noteOwner.value)
  logger.log('[NoteTransfer] senderAccount.value:', senderAccount.value ? {
    address: senderAccount.value.address,
    name: senderAccount.value.name,
    hasKeystore: !!senderAccount.value.keystore
  } : 'null')
  logger.log('[NoteTransfer] selectedNote.value:', selectedNote.value ? {
    hash: selectedNote.value.hash?.slice(0, 12),
    owner: selectedNote.value.owner
  } : 'null')

  unlocking.value = true
  try {
    // Unlock account in browser (secret key never leaves browser!)
    const result = await accountStore.unlockAccountLocal(
      senderAccount.value.address,
      passphrase.value
    )
    unlockedSecretKey.value = result.secretKey
    showPassphraseModal.value = false
    // Now proceed with transfer
    await doTransfer()
  } catch (err) {
    logger.error('[NoteTransfer] Failed to unlock account:', err)
    logger.error('[NoteTransfer] Error details:', {
      message: (err as Error).message,
      noteOwner: noteOwner.value,
      senderAccountAddress: senderAccount.value?.address
    })
    alert('Failed to unlock account: Wrong passphrase?')
  } finally {
    unlocking.value = false
    passphrase.value = ''
  }
}

function calculateChange(originalValue: string, transferAmount: string): bigint {
  // Both originalValue and transferAmount are in wei
  return toBigInt(originalValue) - toBigInt(transferAmount)
}

function isValidRecipient(): boolean {
  return !!toAccountAddress.value
}

function isValidAmount(fromValue: string, toAmount: string): boolean {
  const from = toBigInt(fromValue)
  // toAmount is in ETH (user input like "1.2"), convert to wei
  const to = parseEther(toAmount)
  return from >= to
}

interface GeneratedNotes {
  newNote: NoteData & { noteHash: string }
  changeNote: NoteData & { noteHash: string }
}

/**
 * Generate transfer proof entirely in browser
 * Uses pk-based note hashes (pkX, pkY)
 */
async function generateTransferProof(
  oldNote: Note,
  newNoteValue: string,
  changeNoteValue: string,
  secretKey: string,
  recipientPk: { x: string; y: string },
  senderPk: { x: string; y: string }
): Promise<{ proof: FormattedProof; notes: GeneratedNotes }> {
  if (!oldNote.pkX || !oldNote.pkY) {
    throw new Error('Note does not have public key. Cannot generate transfer proof.')
  }

  // Create old note data
  const oldNoteData: NoteData = {
    pkX: oldNote.pkX,
    pkY: oldNote.pkY,
    value: oldNote.value,
    token: oldNote.token,
    salt: oldNote.salt || '0x0'
  }

  // Create new note for recipient (pk-based)
  const newNote: NoteData & { noteHash: string } = {
    pkX: recipientPk.x,
    pkY: recipientPk.y,
    value: newNoteValue,
    token: oldNote.token,
    salt: generateSalt(),
    noteHash: ''
  }
  newNote.noteHash = await computeCircuitHash(newNote)

  // Create change note for sender (pk-based)
  const changeNote: NoteData & { noteHash: string } = {
    pkX: senderPk.x,
    pkY: senderPk.y,
    value: changeNoteValue,
    token: oldNote.token,
    salt: generateSalt(),
    noteHash: ''
  }
  changeNote.noteHash = await computeCircuitHash(changeNote)

  // Prepare circuit inputs (single note transfer: oldNote0, null, newNote, changeNote)
  const inputs = await prepareTransferInputs(
    oldNoteData,
    null,  // No second old note
    newNote,
    changeNote,
    secretKey,
    null   // No second secret key
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
    notes: { newNote, changeNote }
  }
}

async function doTransfer() {
  if (!selectedNote.value || selectedNote.value.state !== '0x1') {
    alert('Invalid note')
    return
  }

  if (!effectiveSecretKey.value) {
    alert('Please unlock your account first.')
    return
  }

  if (!isValidRecipient() || !isValidAmount(selectedNote.value.value, amount.value)) {
    alert('Invalid recipient or amount')
    return
  }

  if (!senderAccount.value) {
    alert('Sender account not found')
    return
  }

  loading.value = true

  try {
    // Convert user input (ETH) to wei for consistency with minted notes
    const amountInWei = parseEther(amount.value).toString()
    const change = calculateChange(selectedNote.value.value, amountInWei)

    // Get recipient pk
    let recipientPk: { x: string; y: string }
    const recipientAccount = accountStore.accounts.find(acc => acc.address === toAccountAddress.value)
    if (recipientAccount?.publicKey) {
      recipientPk = recipientAccount.publicKey
    } else {
      // For external transfers, parse JSON pk
      try {
        const parsedPk = JSON.parse(toAccountAddress.value)
        if (!parsedPk.x || !parsedPk.y) {
          throw new Error('Invalid public key format')
        }
        recipientPk = { x: parsedPk.x, y: parsedPk.y }
      } catch (err) {
        alert('Invalid recipient public key JSON. Expected format: {"x":"0x...","y":"0x..."}')
        loading.value = false
        return
      }
    }

    logger.log('Generating transfer proof with public keys...')
    logger.log('Recipient pk:', recipientPk)
    logger.log('Sender pk:', senderAccount.value!.publicKey)

    const { proof, notes } = await generateTransferProof(
      selectedNote.value,
      amountInWei,
      change.toString(),
      effectiveSecretKey.value,
      recipientPk,
      senderAccount.value!.publicKey
    )
    logger.log('Transfer proof generated:', proof)
    logger.log('Generated notes:', notes)

    // Extract proof components
    const { a, b, c, input } = proof

    // Convert proof values to BigInt for ethers v6
    const aBigInt = a.map(v => BigInt(v))
    const bBigInt = b.map(row => row.map(v => BigInt(v)))
    const cBigInt = c.map(v => BigInt(v))
    const inputBigInt = input.map(v => BigInt(v))

    // Encrypt notes for on-chain storage (ECDH)
    // Recipient note: encrypt with recipient's pk
    const encryptedNewNote = await encodeNoteData({
      pkX: notes.newNote.pkX,
      pkY: notes.newNote.pkY,
      value: notes.newNote.value.toString(),
      token: notes.newNote.token.toString(),
      salt: notes.newNote.salt.toString()
    }, recipientPk)

    // Change note: encrypt with sender's pk (always known)
    const encryptedChangeNote = await encodeNoteData({
      pkX: notes.changeNote.pkX,
      pkY: notes.changeNote.pkY,
      value: notes.changeNote.value.toString(),
      token: notes.changeNote.token.toString(),
      salt: notes.changeNote.salt.toString()
    }, senderAccount.value!.publicKey)

    logger.log('Calling contract spend with:', { a: aBigInt, b: bBigInt, c: cBigInt, input: inputBigInt })
    const tx = await contractStore.dexContract!.spend(
      aBigInt, bBigInt, cBigInt, inputBigInt,
      encryptedNewNote,
      encryptedChangeNote
    )

    logger.log('Transaction sent:', tx.hash)
    const receipt = await tx.wait()
    logger.log('Transaction receipt:', receipt)

    if (receipt.status === 1) {
      // Notes are now stored on-chain via RLP encoding
      // Both recipient's note and sender's change note will be discovered via blockchain scan

      // Save known note for the recipient (so we can show it in tree even if recipient is locked)
      api.saveKnownNote({
        hash: notes.newNote.noteHash,
        ownerPkX: notes.newNote.pkX,
        ownerPkY: notes.newNote.pkY,
        value: notes.newNote.value.toString(),
        token: notes.newNote.token.toString(),
        salt: notes.newNote.salt.toString(),
        createdInTx: receipt.hash,
        parentNoteHash: noteHash.value,
        senderAddress: noteOwner.value,  // Save sender info for filtering
        state: 1 // VALID
      })
      logger.log('[NoteTransfer] Saved known note:', notes.newNote.noteHash)

      // Add transfer history records (still local for now)
      // Sender record (type: '0x0' = Send)
      await api.addTransferNote(noteOwner.value, {
        hash: noteHash.value,
        type: '0x0',
        from: noteOwner.value,
        to: toAccountAddress.value,
        value: amountInWei,
        token: selectedNote.value.token,
        change: change.toString(),
        transactionHash: receipt.hash
      })

      // Receiver record (type: '0x1' = Receive)
      await api.addTransferNote(toAccountAddress.value, {
        hash: notes.newNote.noteHash,
        type: '0x1',
        from: noteOwner.value,
        to: toAccountAddress.value,
        value: amountInWei,
        token: selectedNote.value.token,
        transactionHash: receipt.hash
      })

      // Re-fetch from blockchain and update localStorage (important for state sync)
      await noteStore.fetchAllNoteEvents()
      await noteStore.loadTransferNotes()

      alert('Transfer successful!')
      emit('complete')
    } else {
      alert('Transaction failed')
    }
  } catch (err) {
    logger.error('Failed to transfer note:', err)
    alert('Failed to transfer note: ' + (err as Error).message)
  } finally {
    loading.value = false
    // Clear secret key from memory after use
    unlockedSecretKey.value = ''
    proofProgress.value = ''
  }
}

watch(isSelfTransfer, (selfTransfer) => {
  // Reset recipient fields when toggling self-transfer
  toAccountAddress.value = ''
  if (selfTransfer) {
    createAccountModalActive.value = true
  }
})

// Expose selectNote for parent components
defineExpose({ selectNote })
</script>

<style scoped>
.hoverable {
  cursor: pointer;
}
</style>
