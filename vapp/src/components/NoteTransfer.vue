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
    <template v-if="!isSelfTransfer">
      <div class="field has-addons">
        <p class="control">
          <a class="button is-static" style="width: 140px">PublicKey X</a>
        </p>
        <p class="control is-expanded">
          <input
            style="width: 100%;"
            class="input"
            type="text"
            placeholder="Recipient public key X (0x...)"
            v-model="manualPublicKeyX"
          >
        </p>
      </div>
      <div class="field has-addons">
        <p class="control">
          <a class="button is-static" style="width: 140px">PublicKey Y</a>
        </p>
        <p class="control is-expanded">
          <input
            style="width: 100%;"
            class="input"
            type="text"
            placeholder="Recipient public key Y (0x...)"
            v-model="manualPublicKeyY"
          >
        </p>
      </div>
    </template>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">Amount</a>
      </p>
      <p class="control is-expanded">
        <input style="width: 100%; text-align: right;" class="input" type="text" v-model="amount" @keypress="onlyNumber">
      </p>
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
import { useAccountStore, type Account, type BabyJubJubPublicKey } from '@/stores/account'
import { useNoteStore, type Note } from '@/stores/note'
import { useFormatters } from '@/composables/useFormatters'
import * as api from '@/api'
import { toBigInt } from 'ethers'
import { encodeNoteData } from '@/utils/noteEncryption'

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
const manualPublicKeyX = ref('')
const manualPublicKeyY = ref('')

// Get the recipient account object with publicKey (for self-transfer)
const recipientAccount = computed(() => {
  return accountStore.accounts.find(acc => acc.address === toAccountAddress.value)
})

// Get the effective recipient public key (from account or manual input)
const recipientPublicKey = computed((): BabyJubJubPublicKey | null => {
  if (isSelfTransfer.value) {
    return recipientAccount.value?.publicKey || null
  } else {
    if (manualPublicKeyX.value && manualPublicKeyY.value) {
      return { x: manualPublicKeyX.value, y: manualPublicKeyY.value }
    }
    return null
  }
})

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
         toAccountAddress.value !== '' &&
         recipientPublicKey.value &&
         senderAccount.value?.publicKey
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
  // Reset recipient fields
  toAccountAddress.value = isSelfTransfer.value ? noteOwner.value : ''
  manualPublicKeyX.value = ''
  manualPublicKeyY.value = ''
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
    const res = await api.unlockAccount(passphrase.value, senderAccount.value.keystore)
    unlockedSecretKey.value = res.data.secretKey
    showPassphraseModal.value = false
    // Now proceed with transfer
    await doTransfer()
  } catch (err) {
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
  // Check if we have a valid recipient address and public key
  return !!toAccountAddress.value && !!recipientPublicKey.value
}

function isValidAmount(fromValue: string, toAmount: string): boolean {
  const from = toBigInt(fromValue)
  const to = toBigInt(toAmount)
  return from >= to
}

interface TransferProofResponse {
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
  changeNote: {
    ownerAddress: string
    value: string
    token: string
    viewingKey: string
    salt: string
    hash: string
  }
}

async function generateProof(
  oldNote: Note,
  newNoteValue: string,
  changeNoteValue: string,
  secretKey: string,
  recipientPubKey: BabyJubJubPublicKey,
  senderPubKey: BabyJubJubPublicKey
): Promise<TransferProofResponse> {
  if (!oldNote.ownerAddress) {
    throw new Error('Note does not have ownerAddress. Cannot generate transfer proof.')
  }

  const params = {
    circuit: 'transferNote',
    inputs: {
      params: [
        // Old note data
        {
          ownerAddress: oldNote.ownerAddress,
          value: oldNote.value,
          token: oldNote.token,
          viewingKey: oldNote.viewingKey || '0x0',
          salt: oldNote.salt
        },
        // New note params (for recipient)
        { value: newNoteValue, token: oldNote.token },
        // Change note params (back to sender)
        { value: changeNoteValue, token: oldNote.token },
        // Secret key
        secretKey,
        // Recipient's public key
        recipientPubKey,
        // Sender's public key (for change note)
        senderPubKey
      ]
    }
  }
  const res = await api.generateProof(params)
  return res.data.proof as TransferProofResponse
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

  if (!senderAccount.value || !senderAccount.value.publicKey) {
    alert('Sender account not found or missing public key')
    return
  }

  loading.value = true

  try {
    const change = calculateChange(selectedNote.value.value, amount.value)

    console.log('Generating transfer proof with public keys...')
    console.log('Recipient:', recipientPublicKey.value)
    console.log('Sender:', senderAccount.value.publicKey)

    const proof = await generateProof(
      selectedNote.value,
      amount.value,
      change.toString(),
      effectiveSecretKey.value,
      recipientPublicKey.value!,
      senderAccount.value.publicKey
    )
    console.log('Transfer proof generated:', proof)

    // Convert proof values to BigInt for ethers v6
    const aBigInt = proof.a.map(v => BigInt(v))
    const bBigInt = proof.b.map(row => row.map(v => BigInt(v)))
    const cBigInt = proof.c.map(v => BigInt(v))
    const inputBigInt = proof.input.map(v => BigInt(v))

    // Encode notes using RLP for on-chain storage and recovery
    const encryptedNewNote = encodeNoteData({
      ownerAddress: proof.newNote.ownerAddress,
      value: proof.newNote.value,
      token: proof.newNote.token,
      viewingKey: proof.newNote.viewingKey,
      salt: proof.newNote.salt
    })
    const encryptedChangeNote = encodeNoteData({
      ownerAddress: proof.changeNote.ownerAddress,
      value: proof.changeNote.value,
      token: proof.changeNote.token,
      viewingKey: proof.changeNote.viewingKey,
      salt: proof.changeNote.salt
    })

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
        hash: proof.newNote.hash,
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
  }
}

watch(isSelfTransfer, (selfTransfer) => {
  // Reset recipient fields when toggling self-transfer
  toAccountAddress.value = ''
  manualPublicKeyX.value = ''
  manualPublicKeyY.value = ''
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
