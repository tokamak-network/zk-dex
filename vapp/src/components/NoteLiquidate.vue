<template>
  <div class="box">
    <div>
      <p style="margin-left: 10px; margin-bottom: 40px;">Redeem {{ token }} Note</p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">Account</a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">{{ fmt.formatZkPk(ownerAccount?.publicKey) }}</a>
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
        <a class="button is-static" style="width: 100%;">{{ fmt.formatNoteValue(noteValue || '0x0') }}</a>
      </p>
    </div>
    <!-- Show unlock UI if note doesn't have secretKey -->
    <div v-if="needsUnlock" class="field has-addons" style="margin-top: 20px;">
      <p class="control">
        <a class="button is-static" style="width: 140px">Passphrase</a>
      </p>
      <p class="control is-expanded">
        <input style="width: 100%; text-align: right;" class="input" type="password" v-model="passphrase" placeholder="Unlock account to redeem">
      </p>
      <p class="control">
        <button class="button" :class="{ 'is-success': isUnlocked, 'is-loading': unlocking }" @click="unlockAccountHandler" :disabled="!passphrase">
          {{ isUnlocked ? '✓ Unlocked' : 'Unlock' }}
        </button>
      </p>
    </div>
    <div v-if="proofProgress" class="field" style="margin-top: 10px;">
      <p class="help">{{ proofProgress }}</p>
    </div>
    <div style="display: flex; justify-content: flex-end">
      <a class="button is-link" style="margin-top: 20px;" :class="{ 'is-static': !canLiquidate, 'is-loading': loading }" @click="liquidateNote">Redeem</a>
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
import { proofGenerator, type FormattedProof } from '@/lib/proofGenerator'
import { prepareMintInputs, type NoteData } from '@/lib/circuitInputs'

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
const proofProgress = ref('')

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
  proofProgress.value = ''
}

async function unlockAccountHandler() {
  if (!ownerAccount.value || !passphrase.value) return

  unlocking.value = true
  try {
    // Unlock account in browser (secret key never leaves browser!)
    const result = await accountStore.unlockAccountLocal(
      ownerAccount.value.address,
      passphrase.value
    )
    unlockedSecretKey.value = result.secretKey
    isUnlocked.value = true
  } catch (err) {
    console.error('Failed to unlock account:', err)
    alert('Failed to unlock account: Wrong passphrase?')
    isUnlocked.value = false
  } finally {
    unlocking.value = false
  }
}

/**
 * Generate burn proof entirely in browser
 * Uses the same mint_burn_note circuit
 */
async function generateBurnProof(): Promise<FormattedProof> {
  if (!effectiveSecretKey.value) {
    throw new Error('No secret key available. Please unlock account.')
  }
  if (!selectedNote.value?.pkX || !selectedNote.value?.pkY) {
    throw new Error('Note does not have public key. Cannot generate burn proof.')
  }

  // Create note data for circuit input
  const noteData: NoteData = {
    pkX: selectedNote.value.pkX,
    pkY: selectedNote.value.pkY,
    value: selectedNote.value.value,
    token: selectedNote.value.token,
    salt: selectedNote.value.salt || '0x0'
  }

  // Prepare circuit inputs (same as mint - mint_burn_note circuit)
  const inputs = await prepareMintInputs(noteData, effectiveSecretKey.value)

  // Generate proof in browser Web Worker
  proofProgress.value = 'Generating proof...'
  const result = await proofGenerator.generateProof(
    'mint_burn_note',
    inputs,
    (stage, progress, message) => {
      proofProgress.value = message || `${stage}: ${Math.round(progress * 100)}%`
    }
  )

  return result.proof
}

async function liquidateNote() {
  if (!selectedNote.value) return

  if (selectedNote.value.state !== '0x1') {
    alert('Note is not in VALID state. Cannot redeem.')
    return
  }

  if (!effectiveSecretKey.value) {
    alert('Please unlock your account first.')
    return
  }

  loading.value = true

  try {
    console.log('Generating burn proof...')
    const proof = await generateBurnProof()
    console.log('Burn proof generated:', proof)

    // Extract proof components
    const { a, b, c, input } = proof

    // Convert proof values to BigInt for ethers v6
    const aBigInt = a.map(v => BigInt(v))
    const bBigInt = b.map(row => row.map(v => BigInt(v)))
    const cBigInt = c.map(v => BigInt(v))
    const inputBigInt = input.map(v => BigInt(v))

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
      alert('Redemption successful!')
    } else {
      alert('Transaction failed')
    }

    router.push({ path: '/' })
  } catch (err) {
    console.error('Failed to redeem note:', err)
    alert('Failed to redeem note: ' + (err as Error).message)
  } finally {
    loading.value = false
    // Clear secret key from memory after use
    unlockedSecretKey.value = ''
    proofProgress.value = ''
  }
}

async function updateDaiAmount() {
  if (!contractStore.daiContract || !web3Store.account) return
  const daiAmount = await contractStore.daiContract.balanceOf(web3Store.account)
  orderStore.setDaiAmount(daiAmount.toString())
}

defineExpose({ selectNote })
</script>
