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
      <button class="button action-button" style="margin-top: 20px;" :class="{ 'is-static': !canLiquidate, 'is-loading': loading }" @click="liquidateNote">Redeem</button>
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
import { logger } from '@/lib/logger'

withDefaults(defineProps<{
  token?: string
}>(), {
  token: 'ETH'
})

const emit = defineEmits<{
  complete: []
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
  logger.log('[NoteLiquidate] selectNote called with:', {
    hash: note.hash?.slice(0, 12),
    owner: note.owner?.slice(0, 12),
    value: note.value,
    state: note.state,
    pkX: note.pkX?.slice(0, 12),
    pkY: note.pkY?.slice(0, 12),
    salt: note.salt?.slice(0, 12),
    secretKey: note.secretKey ? 'present' : 'missing'
  })
  selectedNote.value = note
  noteOwner.value = note.owner
  noteHash.value = note.hash
  noteValue.value = note.value
  // Reset unlock state
  isUnlocked.value = false
  unlockedSecretKey.value = ''
  passphrase.value = ''
  proofProgress.value = ''

  logger.log('[NoteLiquidate] After selectNote:', {
    canLiquidate: canLiquidate.value,
    needsUnlock: needsUnlock.value,
    effectiveSecretKey: effectiveSecretKey.value ? 'present' : 'missing'
  })
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
    logger.error('Failed to unlock account:', err)
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
  logger.log('[NoteLiquidate] generateBurnProof called')
  logger.log('[NoteLiquidate] effectiveSecretKey:', effectiveSecretKey.value ? 'present' : 'MISSING')
  logger.log('[NoteLiquidate] selectedNote FULL data:', {
    hash: selectedNote.value?.hash,
    pkX: selectedNote.value?.pkX,
    pkY: selectedNote.value?.pkY,
    value: selectedNote.value?.value,
    token: selectedNote.value?.token,
    salt: selectedNote.value?.salt,
    owner: selectedNote.value?.owner
  })

  if (!effectiveSecretKey.value) {
    throw new Error('No secret key available. Please unlock account.')
  }
  if (!selectedNote.value?.pkX || !selectedNote.value?.pkY) {
    logger.error('[NoteLiquidate] CRITICAL: Note missing pkX or pkY!')
    throw new Error('Note does not have public key. Cannot generate burn proof.')
  }
  if (!selectedNote.value?.salt) {
    logger.error('[NoteLiquidate] WARNING: Note missing salt! Using 0x0')
  }

  // Create note data for circuit input
  const noteData: NoteData = {
    pkX: selectedNote.value.pkX,
    pkY: selectedNote.value.pkY,
    value: selectedNote.value.value,
    token: selectedNote.value.token,
    salt: selectedNote.value.salt || '0x0'
  }

  logger.log('[NoteLiquidate] noteData for circuit:', noteData)

  // Prepare circuit inputs (same as mint - mint_burn_note circuit)
  const inputs = await prepareMintInputs(noteData, effectiveSecretKey.value)
  logger.log('[NoteLiquidate] Circuit inputs:', inputs)
  logger.log('[NoteLiquidate] Expected noteHash (from note):', selectedNote.value.hash)
  logger.log('[NoteLiquidate] Computed noteHash (from inputs):', inputs.noteHash)

  // Check if hashes match
  const expectedHashBigInt = BigInt(selectedNote.value.hash)
  const computedHashBigInt = BigInt(inputs.noteHash)
  if (expectedHashBigInt !== computedHashBigInt) {
    logger.error('[NoteLiquidate] HASH MISMATCH!')
    logger.error('[NoteLiquidate] Expected (hex):', '0x' + expectedHashBigInt.toString(16))
    logger.error('[NoteLiquidate] Computed (hex):', '0x' + computedHashBigInt.toString(16))
    logger.error('[NoteLiquidate] Note data used for hash:')
    logger.error('[NoteLiquidate]   pkX:', noteData.pkX)
    logger.error('[NoteLiquidate]   pkY:', noteData.pkY)
    logger.error('[NoteLiquidate]   value:', noteData.value)
    logger.error('[NoteLiquidate]   token:', noteData.token)
    logger.error('[NoteLiquidate]   salt:', noteData.salt)
    logger.error('[NoteLiquidate] Raw selectedNote data:')
    logger.error('[NoteLiquidate]   hash:', selectedNote.value.hash)
    logger.error('[NoteLiquidate]   pkX:', selectedNote.value.pkX)
    logger.error('[NoteLiquidate]   pkY:', selectedNote.value.pkY)
    logger.error('[NoteLiquidate]   value:', selectedNote.value.value)
    logger.error('[NoteLiquidate]   token:', selectedNote.value.token)
    logger.error('[NoteLiquidate]   salt:', selectedNote.value.salt)
    throw new Error('Note hash mismatch! The note data (pkX, pkY, salt) does not match the on-chain note. Check console for details.')
  }
  logger.log('[NoteLiquidate] Hash verification PASSED')

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
  logger.log('[NoteLiquidate] liquidateNote called')
  logger.log('[NoteLiquidate] selectedNote:', selectedNote.value ? {
    hash: selectedNote.value.hash?.slice(0, 12),
    state: selectedNote.value.state,
    pkX: selectedNote.value.pkX ? 'present' : 'MISSING',
    pkY: selectedNote.value.pkY ? 'present' : 'MISSING',
    salt: selectedNote.value.salt ? 'present' : 'MISSING',
    secretKey: selectedNote.value.secretKey ? 'present' : 'missing'
  } : 'null')

  if (!selectedNote.value) {
    logger.log('[NoteLiquidate] No note selected!')
    return
  }

  if (selectedNote.value.state !== '0x1') {
    logger.log('[NoteLiquidate] Note state is not VALID:', selectedNote.value.state)
    alert('Note is not in VALID state. Cannot redeem.')
    return
  }

  if (!effectiveSecretKey.value) {
    logger.log('[NoteLiquidate] No secret key!')
    alert('Please unlock your account first.')
    return
  }

  loading.value = true

  try {
    // First, verify on-chain note state
    logger.log('[NoteLiquidate] Checking on-chain note state...')
    // Convert hash to bytes32 hex format if it's a decimal string
    let hashForQuery = selectedNote.value.hash
    if (!selectedNote.value.hash.startsWith('0x')) {
      hashForQuery = '0x' + BigInt(selectedNote.value.hash).toString(16).padStart(64, '0')
    }

    // Check both ZkDex and TimeLock contracts for the note
    let onChainState = await contractStore.dexContract!.notes(hashForQuery)
    let useTimeLockContract = false

    // If note is invalid in ZkDex, check TimeLock contract
    if (Number(onChainState) === 0 && contractStore.timeLockContract) {
      logger.log('[NoteLiquidate] Note not found in ZkDex, checking TimeLock contract...')
      const timeLockState = await contractStore.timeLockContract.notes(hashForQuery)
      if (Number(timeLockState) === 1) {
        logger.log('[NoteLiquidate] Note found in TimeLock contract')
        onChainState = timeLockState
        useTimeLockContract = true
      }
    }

    logger.log('[NoteLiquidate] On-chain note state:', onChainState.toString())
    logger.log('[NoteLiquidate] Using TimeLock contract:', useTimeLockContract)
    logger.log('[NoteLiquidate] Frontend note state:', selectedNote.value.state)

    // State enum: 0=Invalid, 1=Valid, 2=Trading, 3=Spent
    const stateNames = ['Invalid', 'Valid', 'Trading', 'Spent']
    const onChainStateName = stateNames[Number(onChainState)] || 'Unknown'

    if (Number(onChainState) !== 1) {
      // Sync all note states from blockchain
      await noteStore.refreshNoteStatesFromChain()

      // Also update local selectedNote state
      const stateMap: Record<number, string> = { 0: '0x0', 1: '0x1', 2: '0x2', 3: '0x3' }
      selectedNote.value.state = stateMap[Number(onChainState)] || '0x0'

      alert(`Cannot redeem: Note is "${onChainStateName}" on-chain (expected "Valid").\n\nNote states have been synced from blockchain.`)
      return
    }

    logger.log('[NoteLiquidate] On-chain state verified: Valid')
    logger.log('[NoteLiquidate] Generating burn proof...')
    const proof = await generateBurnProof()
    logger.log('[NoteLiquidate] Burn proof generated:', proof)

    // Extract proof components
    const { a, b, c, input } = proof
    logger.log('[NoteLiquidate] Proof input (public signals):', input)
    logger.log('[NoteLiquidate] input[0] (out):', input[0])
    logger.log('[NoteLiquidate] input[1] (noteHash):', input[1])
    logger.log('[NoteLiquidate] input[2] (value):', input[2])
    logger.log('[NoteLiquidate] input[3] (tokenType):', input[3])

    // Verify the proof input matches expected values
    const expectedNoteHash = BigInt(selectedNote.value!.hash)
    const proofNoteHash = BigInt(input[1])
    logger.log('[NoteLiquidate] Expected noteHash:', expectedNoteHash.toString())
    logger.log('[NoteLiquidate] Proof noteHash:', proofNoteHash.toString())
    if (expectedNoteHash !== proofNoteHash) {
      logger.error('[NoteLiquidate] CRITICAL: Proof noteHash does not match expected!')
    }

    // Convert proof values to BigInt for ethers v6
    const aBigInt = a.map(v => BigInt(v))
    const bBigInt = b.map(row => row.map(v => BigInt(v)))
    const cBigInt = c.map(v => BigInt(v))
    const inputBigInt = input.map(v => BigInt(v))

    // First parameter is the recipient address for the liquidated funds
    const recipientAddress = web3Store.account
    logger.log('[NoteLiquidate] Calling contract liquidate with:')
    logger.log('  to:', recipientAddress)
    logger.log('  a:', aBigInt)
    logger.log('  b:', bBigInt)
    logger.log('  c:', cBigInt)
    logger.log('  input:', inputBigInt)

    // Select the appropriate contract based on where the note exists
    const liquidateContract = useTimeLockContract
      ? contractStore.timeLockContract!
      : contractStore.dexContract!

    logger.log('[NoteLiquidate] Using contract for liquidate:', useTimeLockContract ? 'TimeLock' : 'ZkDex')

    // Try to estimate gas first to catch errors early
    try {
      const gasEstimate = await liquidateContract.liquidate.estimateGas(
        recipientAddress, aBigInt, bBigInt, cBigInt, inputBigInt
      )
      logger.log('[NoteLiquidate] Gas estimate:', gasEstimate.toString())
    } catch (gasErr) {
      logger.error('[NoteLiquidate] Gas estimation failed:', gasErr)
      // Try to get more details by calling staticCall
      try {
        await liquidateContract.liquidate.staticCall(
          recipientAddress, aBigInt, bBigInt, cBigInt, inputBigInt
        )
      } catch (staticErr) {
        logger.error('[NoteLiquidate] Static call error:', staticErr)
      }
      throw gasErr
    }

    const tx = await liquidateContract.liquidate(
      recipientAddress, aBigInt, bBigInt, cBigInt, inputBigInt
    )

    logger.log('Transaction sent:', tx.hash)
    const receipt = await tx.wait()
    logger.log('Transaction receipt:', receipt)

    if (receipt.status === 1) {
      // Try to update note state via API (optional - server may not be running)
      try {
        await api.updateNoteState(noteOwner.value, noteHash.value, '0x3')
      } catch (apiErr) {
        logger.warn('[NoteLiquidate] API update failed (server may not be running):', apiErr)
        // Continue anyway - on-chain transaction succeeded
      }
      // Re-fetch from blockchain and update localStorage (important for state sync)
      try {
        await noteStore.fetchAllNoteEvents()
      } catch (fetchErr) {
        logger.warn('[NoteLiquidate] Failed to refresh notes:', fetchErr)
      }
      await updateDaiAmount()
      alert('Redemption successful!')
      emit('complete')
    } else {
      alert('Transaction failed')
    }
  } catch (err) {
    logger.error('Failed to redeem note:', err)
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
