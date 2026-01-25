<template>
  <div class="box">
    <div>
      <p style="margin-left: 10px; margin-bottom: 40px;">Liquidate {{ token }} Note</p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">Account</a>
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
    <!-- Show unlock UI if note doesn't have secretKey -->
    <div v-if="needsUnlock" class="field has-addons" style="margin-top: 20px;">
      <p class="control">
        <a class="button is-static" style="width: 140px">Passphrase</a>
      </p>
      <p class="control is-expanded">
        <input style="width: 100%; text-align: right;" class="input" type="password" v-model="passphrase" placeholder="Unlock account to liquidate">
      </p>
      <p class="control">
        <button class="button" :class="{ 'is-success': isUnlocked, 'is-loading': unlocking }" @click="unlockAccount" :disabled="!passphrase">
          {{ isUnlocked ? '✓ Unlocked' : 'Unlock' }}
        </button>
      </p>
    </div>
    <div style="display: flex; justify-content: flex-end">
      <a class="button is-link" style="margin-top: 20px;" :class="{ 'is-static': !canLiquidate, 'is-loading': loading }" @click="liquidateNote">Liquidate</a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWeb3Store } from '@/stores/web3'
import { useContractStore } from '@/stores/contract'
import { useAccountStore } from '@/stores/account'
import { useNoteStore, type Note } from '@/stores/note'
import { useOrderStore } from '@/stores/order'
import { useFormatters } from '@/composables/useFormatters'
import * as api from '@/api'
import { zeroPadValue, toBeHex, toBigInt } from 'ethers'

defineProps<{
  token: string
}>()

const router = useRouter()
const web3Store = useWeb3Store()
const contractStore = useContractStore()
const accountStore = useAccountStore()
const noteStore = useNoteStore()
const orderStore = useOrderStore()
const fmt = useFormatters()

const loading = ref(false)
const unlocking = ref(false)
const selectedNote = ref<Note | null>(null)
const noteOwner = ref('')
const noteHash = ref('')
const noteValue = ref('')
const passphrase = ref('')
const isUnlocked = ref(false)
const unlockedSecretKey = ref('')

// Check if we need to unlock (only for VALID notes that don't have secretKey)
const needsUnlock = computed(() => {
  return selectedNote.value &&
         selectedNote.value.state === '0x1' &&  // Only VALID notes
         !selectedNote.value.secretKey &&
         noteHash.value !== ''
})

// Get the effective secret key (either from note or from unlock)
const effectiveSecretKey = computed(() => {
  return selectedNote.value?.secretKey || unlockedSecretKey.value
})

// Only allow liquidation if note is VALID (0x1) and we have secretKey
const canLiquidate = computed(() => {
  return selectedNote.value &&
         selectedNote.value.state === '0x1' &&
         effectiveSecretKey.value &&
         noteHash.value !== ''
})

// Get the owner account to unlock
const ownerAccount = computed(() => {
  return accountStore.accounts.find(acc => acc.address === noteOwner.value)
})

function selectNote(note: Note) {
  selectedNote.value = note
  noteOwner.value = note.owner
  noteHash.value = note.hash
  noteValue.value = note.value
  // Reset unlock state
  isUnlocked.value = false
  unlockedSecretKey.value = ''
  passphrase.value = ''
}

async function unlockAccount() {
  if (!ownerAccount.value || !passphrase.value) return

  unlocking.value = true
  try {
    const res = await api.unlockAccount(passphrase.value, ownerAccount.value.keystore)
    unlockedSecretKey.value = res.data.secretKey
    isUnlocked.value = true
  } catch (err) {
    alert('Failed to unlock account: Wrong passphrase?')
    isUnlocked.value = false
  } finally {
    unlocking.value = false
  }
}

interface BurnProofResponse {
  a: string[]
  b: string[][]
  c: string[]
  input: string[]
  note: {
    ownerAddress: string
    value: string
    token: string
    viewingKey: string
    salt: string
    hash: string
  }
}

async function generateProof(): Promise<BurnProofResponse> {
  if (!effectiveSecretKey.value) {
    throw new Error('No secret key available. Please unlock account.')
  }
  if (!selectedNote.value?.ownerAddress) {
    throw new Error('Note does not have ownerAddress. Cannot generate burn proof.')
  }

  const params = {
    circuit: 'burnNote',
    inputs: {
      params: [
        {
          ownerAddress: selectedNote.value.ownerAddress,
          value: selectedNote.value.value,
          token: selectedNote.value.token,
          viewingKey: selectedNote.value.viewingKey || '0x0',
          salt: selectedNote.value.salt
        },
        effectiveSecretKey.value
      ]
    }
  }
  const res = await api.generateProof(params)
  return res.data.proof as BurnProofResponse
}

async function liquidateNote() {
  if (!selectedNote.value) return

  if (selectedNote.value.state !== '0x1') {
    alert('Note is not in VALID state. Cannot liquidate.')
    return
  }

  if (!effectiveSecretKey.value) {
    alert('Please unlock your account first.')
    return
  }

  loading.value = true

  try {
    console.log('Generating burn proof...')
    const proof = await generateProof()
    console.log('Burn proof generated:', proof)

    // Convert proof values to BigInt for ethers v6
    const aBigInt = proof.a.map(v => BigInt(v))
    const bBigInt = proof.b.map(row => row.map(v => BigInt(v)))
    const cBigInt = proof.c.map(v => BigInt(v))
    const inputBigInt = proof.input.map(v => BigInt(v))

    // First parameter is the recipient address for the liquidated funds
    const recipientAddress = web3Store.account
    console.log('Calling contract liquidate with:', { to: recipientAddress, a: aBigInt, b: bBigInt, c: cBigInt, input: inputBigInt })
    const tx = await contractStore.dexContract!.liquidate(
      recipientAddress, aBigInt, bBigInt, cBigInt, inputBigInt
    )

    console.log('Transaction sent:', tx.hash)
    const receipt = await tx.wait()
    console.log('Transaction receipt:', receipt)

    if (receipt.status === 1) {
      // Update note state to spent
      await api.updateNoteState(noteOwner.value, noteHash.value, '0x3')
      await noteStore.loadNotes()
      await updateDaiAmount()
      alert('Liquidation successful!')
    } else {
      alert('Transaction failed')
    }

    router.push({ path: '/' })
  } catch (err) {
    console.error('Failed to liquidate note:', err)
    alert('Failed to liquidate note: ' + (err as Error).message)
  } finally {
    loading.value = false
  }
}

async function updateDaiAmount() {
  if (!contractStore.daiContract || !web3Store.account) return
  const daiAmount = await contractStore.daiContract.balanceOf(web3Store.account)
  orderStore.setDaiAmount(daiAmount.toString())
}

defineExpose({ selectNote })
</script>
