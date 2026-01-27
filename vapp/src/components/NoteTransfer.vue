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
        <a class="button is-static" style="width: 100%;">{{ fmt.abbreviateZk(noteOwner) }}</a>
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
        <a class="button is-static" style="width: 140px">Note Amount</a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">{{ fmt.hexToNumberString(noteValue || '0x0') }}</a>
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
              >{{ fmt.abbreviateZk(acc.address) }}</option>
            </select>
          </div>
        </template>
        <template v-else>
          <input
            style="width: 100%;"
            class="input"
            type="text"
            placeholder="Recipient address (0x...)"
            v-model="toAccountAddress"
          >
        </template>
      </p>
    </div>
    <!-- No public key needed - address is sufficient for creating notes -->
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
        class="button is-link"
        @click="handleTransferClick"
        :class="{ 'is-static': !canClickTransfer, 'is-loading': loading }"
      >Transfer</button>
    </div>
    <!-- Passphrase modal -->
    <o-modal v-model:active="showPassphraseModal">
      <div class="box" style="width: 400px;">
        <p class="title is-5">Enter Passphrase</p>
        <p class="subtitle is-6">Unlock account to transfer note</p>
        <div class="field">
          <p class="control">
            <input class="input" type="password" v-model="passphrase" placeholder="Passphrase" @keyup.enter="confirmPassphrase">
          </p>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button class="button" @click="showPassphraseModal = false">Cancel</button>
          <button class="button is-link" :class="{ 'is-loading': unlocking }" @click="confirmPassphrase" :disabled="!passphrase">Confirm</button>
        </div>
      </div>
    </o-modal>
    <o-modal v-model:active="createAccountModalActive">
      <div class="box">
        <table class="table">
          <thead>
            <tr>
              <th>address</th>
            </tr>
          </thead>
          <tbody>
            <tr class="hoverable" v-for="acc in accountStore.accounts" :key="acc.address" @click="selectAccountFromModal(acc)">
              <td>{{ fmt.abbreviateZk(acc.address) }}</td>
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
import { toBigInt } from 'ethers'
import { encodeNoteData } from '@/utils/noteEncryption'
import { proofGenerator, type FormattedProof } from '@/lib/proofGenerator'
import { prepareTransferInputs, computeCircuitHash, generateSalt, hexToBigInt, type NoteData } from '@/lib/circuitInputs'

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
  if (event.keyCode < 48 || event.keyCode > 57) {
    event.preventDefault()
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
    console.error('Failed to unlock account:', err)
    alert('Failed to unlock account: Wrong passphrase?')
  } finally {
    unlocking.value = false
    passphrase.value = ''
  }
}

function calculateChange(originalValue: string, transferAmount: string): bigint {
  return toBigInt(originalValue) - toBigInt(transferAmount)
}

function isValidRecipient(): boolean {
  return !!toAccountAddress.value
}

function isValidAmount(fromValue: string, toAmount: string): boolean {
  const from = toBigInt(fromValue)
  const to = toBigInt(toAmount)
  return from >= to
}

interface GeneratedNotes {
  newNote: NoteData & { noteHash: string }
  changeNote: NoteData & { noteHash: string }
}

/**
 * Generate transfer proof entirely in browser
 * Only requires recipient address — no public key needed
 */
async function generateTransferProof(
  oldNote: Note,
  newNoteValue: string,
  changeNoteValue: string,
  secretKey: string,
  recipientAddress: string,
  senderAddress: string
): Promise<{ proof: FormattedProof; notes: GeneratedNotes }> {
  if (!oldNote.ownerAddress) {
    throw new Error('Note does not have ownerAddress. Cannot generate transfer proof.')
  }

  // Create old note data
  const oldNoteData: NoteData = {
    ownerAddress: oldNote.ownerAddress,
    value: oldNote.value,
    token: oldNote.token,
    viewingKey: oldNote.viewingKey || '0x0',
    salt: oldNote.salt || '0x0'
  }

  // Create new note for recipient (viewingKey = address)
  const newNote: NoteData & { noteHash: string } = {
    ownerAddress: recipientAddress,
    value: newNoteValue,
    token: oldNote.token,
    viewingKey: recipientAddress,
    salt: generateSalt(),
    noteHash: ''
  }
  newNote.noteHash = await computeCircuitHash(newNote)

  // Create change note for sender (viewingKey = address)
  const changeNote: NoteData & { noteHash: string } = {
    ownerAddress: senderAddress,
    value: changeNoteValue,
    token: oldNote.token,
    viewingKey: senderAddress,
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
    const change = calculateChange(selectedNote.value.value, amount.value)

    console.log('Generating transfer proof with addresses...')
    console.log('Recipient:', toAccountAddress.value)
    console.log('Sender:', noteOwner.value)

    const { proof, notes } = await generateTransferProof(
      selectedNote.value,
      amount.value,
      change.toString(),
      effectiveSecretKey.value,
      toAccountAddress.value,
      noteOwner.value
    )
    console.log('Transfer proof generated:', proof)
    console.log('Generated notes:', notes)

    // Extract proof components
    const { a, b, c, input } = proof

    // Convert proof values to BigInt for ethers v6
    const aBigInt = a.map(v => BigInt(v))
    const bBigInt = b.map(row => row.map(v => BigInt(v)))
    const cBigInt = c.map(v => BigInt(v))
    const inputBigInt = input.map(v => BigInt(v))

    // Encrypt notes for on-chain storage (ECDH)
    // Recipient note: encrypt with recipient's pk (local account lookup, or sender's pk as fallback)
    const recipientAccount = accountStore.accounts.find(acc => acc.address === toAccountAddress.value)
    const recipientPk = recipientAccount?.publicKey || senderAccount.value!.publicKey
    const encryptedNewNote = await encodeNoteData({
      ownerAddress: notes.newNote.ownerAddress,
      value: notes.newNote.value.toString(),
      token: notes.newNote.token.toString(),
      viewingKey: notes.newNote.viewingKey,
      salt: notes.newNote.salt.toString()
    }, recipientPk)
    // Change note: encrypt with sender's pk (always known)
    const encryptedChangeNote = await encodeNoteData({
      ownerAddress: notes.changeNote.ownerAddress,
      value: notes.changeNote.value.toString(),
      token: notes.changeNote.token.toString(),
      viewingKey: notes.changeNote.viewingKey,
      salt: notes.changeNote.salt.toString()
    }, senderAccount.value!.publicKey)

    console.log('Calling contract spend with:', { a: aBigInt, b: bBigInt, c: cBigInt, input: inputBigInt })
    const tx = await contractStore.dexContract!.spend(
      aBigInt, bBigInt, cBigInt, inputBigInt,
      encryptedNewNote,
      encryptedChangeNote
    )

    console.log('Transaction sent:', tx.hash)
    const receipt = await tx.wait()
    console.log('Transaction receipt:', receipt)

    if (receipt.status === 1) {
      // Notes are now stored on-chain via RLP encoding
      // Both recipient's note and sender's change note will be discovered via blockchain scan

      // Add transfer history records (still local for now)
      // Sender record (type: '0x0' = Send)
      await api.addTransferNote(noteOwner.value, {
        hash: noteHash.value,
        type: '0x0',
        from: noteOwner.value,
        to: toAccountAddress.value,
        value: amount.value,
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
        value: amount.value,
        token: selectedNote.value.token,
        transactionHash: receipt.hash
      })

      // Scan blockchain to discover notes
      await noteStore.loadNotes()
      await noteStore.loadTransferNotes()

      alert('Transfer successful!')
    } else {
      alert('Transaction failed')
    }

    router.push({ path: '/' })
  } catch (err) {
    console.error('Failed to transfer note:', err)
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
