<template>
  <div class="box">
    <div>
      <p style="margin-left: 10px; margin-bottom: 40px;">Create {{ token }} Note</p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">To</a>
      </p>
      <p class="control is-expanded">
        <div class="select is-fullwidth">
          <select v-model="selectedAccountAddress">
            <option value="">Select account...</option>
            <option v-for="acc in accounts" :key="acc.address" :value="acc.address">{{ fmt.abbreviateZk(acc.address) }}</option>
          </select>
        </div>
      </p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">Amount</a>
      </p>
      <p class="control is-expanded">
        <input style="width: 100%; text-align: right;" class="input" @keypress="onlyNumber" v-model="amount">
      </p>
    </div>
    <div style="display: flex; justify-content: flex-end">
      <a
        class="button is-link"
        style="margin-top: 20px;"
        :class="{ 'is-static': !canCreate, 'is-loading': loading }"
        @click="createNewNote"
      >Create</a>
    </div>
    <!-- Passphrase modal -->
    <o-modal v-model:active="showPassphraseModal">
      <div class="box" style="width: 400px;">
        <p class="title is-5">Enter Passphrase</p>
        <p class="subtitle is-6">Unlock account to create note</p>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWeb3Store } from '@/stores/web3'
import { useContractStore } from '@/stores/contract'
import { useAccountStore, type Account } from '@/stores/account'
import { useNoteStore } from '@/stores/note'
import { useOrderStore } from '@/stores/order'
import { useFormatters } from '@/composables/useFormatters'
import * as api from '@/api'
import { toBigInt } from 'ethers'
import { encodeNoteData } from '@/utils/noteEncryption'

const fmt = useFormatters()

const props = defineProps<{
  accounts: Account[]
  token: string
}>()

const router = useRouter()
const web3Store = useWeb3Store()
const contractStore = useContractStore()
const accountStore = useAccountStore()
const noteStore = useNoteStore()
const orderStore = useOrderStore()

const loading = ref(false)
const unlocking = ref(false)
const selectedAccountAddress = ref('')
const passphrase = ref('')
const amount = ref('')
const showPassphraseModal = ref(false)
const unlockedSecretKey = ref('')

const ETH_TOKEN_TYPE = '0x0'
const DAI_TOKEN_TYPE = '0x1'

const selectedAccount = computed(() => {
  return props.accounts.find(acc => acc.address === selectedAccountAddress.value)
})

const canCreate = computed(() => {
  return selectedAccountAddress.value !== '' && amount.value !== ''
})

function onlyNumber(event: KeyboardEvent) {
  if (event.keyCode < 48 || event.keyCode > 57) {
    event.preventDefault()
  }
}

async function confirmPassphrase() {
  if (!selectedAccount.value || !passphrase.value) return

  unlocking.value = true
  try {
    const res = await api.unlockAccount(passphrase.value, selectedAccount.value.keystore)
    unlockedSecretKey.value = res.data.secretKey
    showPassphraseModal.value = false
    // Now proceed with note creation
    await doCreateNote()
  } catch (err) {
    alert('Failed to unlock account: Wrong passphrase?')
  } finally {
    unlocking.value = false
    passphrase.value = ''
  }
}

interface MintProofResponse {
  a: string[]
  b: string[][]
  c: string[]
  input: string[]
  note: {
    owner0: string
    owner1: string
    value: string
    token: string
    viewingKey: string
    salt: string
    hash: string
  }
}

async function generateProof(value: string, tokenType: string): Promise<MintProofResponse> {
  if (!unlockedSecretKey.value || !selectedAccount.value?.publicKey) {
    throw new Error('Account not unlocked or missing public key')
  }

  const params = {
    circuit: 'mintNBurnNote',
    inputs: {
      params: [
        { value, token: tokenType, viewingKey: '0x0' },
        unlockedSecretKey.value,
        selectedAccount.value.publicKey
      ]
    }
  }
  const res = await api.generateProof(params)
  return res.data.proof as MintProofResponse
}

function encryptNote(noteData: MintProofResponse['note']): string {
  // Encode note data using RLP for on-chain storage
  // This allows note recovery by scanning blockchain events
  return encodeNoteData({
    owner0: noteData.owner0,
    owner1: noteData.owner1,
    value: noteData.value,
    token: noteData.token,
    viewingKey: noteData.viewingKey,
    salt: noteData.salt
  })
}

async function createNewNote() {
  if (!canCreate.value) return

  // Show passphrase modal to unlock account
  showPassphraseModal.value = true
}

async function doCreateNote() {
  loading.value = true

  try {
    const tokenType = props.token === 'DAI' ? DAI_TOKEN_TYPE : ETH_TOKEN_TYPE

    console.log('Generating proof with account public key:', selectedAccount.value?.publicKey)
    const proof = await generateProof(amount.value, tokenType)
    console.log('Proof generated:', proof)

    // Extract only the proof components needed by the contract
    const { a, b, c, input, note: generatedNote } = proof

    // Convert proof values to BigInt for ethers v6
    const aBigInt = a.map(v => BigInt(v))
    const bBigInt = b.map(row => row.map(v => BigInt(v)))
    const cBigInt = c.map(v => BigInt(v))
    const inputBigInt = input.map(v => BigInt(v))

    const encryptedNote = encryptNote(generatedNote)
    console.log('Calling contract mint with:', { a: aBigInt, b: bBigInt, c: cBigInt, input: inputBigInt, encryptedNote })

    let tx
    if (props.token === 'DAI') {
      console.log('Approving DAI...')
      const approveTx = await contractStore.daiContract!.approve(
        contractStore.dexAddress,
        BigInt(amount.value)
      )
      await approveTx.wait()
      console.log('DAI approved, calling mint...')

      tx = await contractStore.dexContract!.mint(
        aBigInt, bBigInt, cBigInt, inputBigInt,
        encryptedNote
      )
    } else {
      console.log('Calling ETH mint with value:', amount.value)
      tx = await contractStore.dexContract!.mint(
        aBigInt, bBigInt, cBigInt, inputBigInt,
        encryptedNote,
        { value: BigInt(amount.value) }
      )
    }

    console.log('Transaction sent:', tx.hash)
    const receipt = await tx.wait()
    console.log('Transaction receipt:', receipt)

    if (receipt.status === 1) {
      // Note data is now stored on-chain via RLP encoding
      // Scan blockchain to discover the new note
      await noteStore.loadNotes()

      // Update DAI amount (non-blocking)
      updateDaiAmount().catch(err => console.warn('Failed to update DAI:', err))

      alert('Note created successfully!')
    } else {
      alert('Transaction failed')
    }

    router.push({ path: '/' })
  } catch (err) {
    console.error('Failed to create note:', err)
    alert('Failed to create note: ' + (err as Error).message)
  } finally {
    loading.value = false
  }
}

async function updateDaiAmount() {
  if (!contractStore.daiContract || !web3Store.account) return
  try {
    const daiAmount = await contractStore.daiContract.balanceOf(web3Store.account)
    orderStore.setDaiAmount(daiAmount.toString())
  } catch (err) {
    console.warn('Failed to update DAI amount:', err)
    // Non-critical error, continue
  }
}
</script>
