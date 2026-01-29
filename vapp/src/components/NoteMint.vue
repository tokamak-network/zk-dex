<template>
  <div class="box">
    <div>
      <p style="margin-left: 10px; margin-bottom: 40px;">Issue {{ token }} Note</p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">To</a>
      </p>
      <p class="control is-expanded">
        <div class="select is-fullwidth">
          <select v-model="selectedAccountAddress">
            <option value="">Select account...</option>
            <option v-for="acc in accounts" :key="acc.address" :value="acc.address">{{ fmt.formatZkPk(acc.publicKey) }}</option>
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
      <button
        class="button action-button"
        style="margin-top: 20px;"
        :class="{ 'is-static': !canCreate, 'is-loading': loading }"
        @click="createNewNote"
      >Issue</button>
    </div>
    <!-- Passphrase modal -->
    <o-modal v-model:active="showPassphraseModal">
      <div class="box" style="width: 400px;">
        <p class="title is-5">Enter Passphrase</p>
        <p class="subtitle is-6">Unlock account to issue note</p>
        <div class="field">
          <p class="control">
            <input class="input" type="password" v-model="passphrase" placeholder="Passphrase" @keyup.enter="confirmPassphrase">
          </p>
        </div>
        <div v-if="proofProgress" class="field">
          <p class="help">{{ proofProgress }}</p>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button class="button" @click="showPassphraseModal = false">Cancel</button>
          <button class="button action-button" :class="{ 'is-loading': unlocking }" @click="confirmPassphrase" :disabled="!passphrase">Confirm</button>
        </div>
      </div>
    </o-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Contract, parseEther } from 'ethers'
import { useWeb3Store } from '@/stores/web3'
import { useContractStore } from '@/stores/contract'
import { useAccountStore, type Account } from '@/stores/account'
import { useNoteStore } from '@/stores/note'
import { useOrderStore } from '@/stores/order'
import { useFormatters } from '@/composables/useFormatters'
import { encodeNoteData } from '@/utils/noteEncryption'
import { proofGenerator, type FormattedProof } from '@/lib/proofGenerator'
import { prepareMintInputs, computeCircuitHash, generateSalt } from '@/lib/circuitInputs'
import { logger } from '@/lib/logger'

const fmt = useFormatters()

const props = withDefaults(defineProps<{
  accounts: Account[]
  token?: string
}>(), {
  token: 'ETH'
})

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
const proofProgress = ref('')

const ETH_TOKEN_TYPE = '0x0'
const DAI_TOKEN_TYPE = '0x1'

const selectedAccount = computed(() => {
  return props.accounts.find(acc => acc.address === selectedAccountAddress.value)
})

const canCreate = computed(() => {
  return selectedAccountAddress.value !== '' && amount.value !== ''
})

function onlyNumber(event: KeyboardEvent) {
  const char = event.key
  // Allow digits and decimal point
  if (char === '.') {
    // Prevent multiple dots
    if (amount.value.includes('.')) {
      event.preventDefault()
    }
    return
  }
  if (char < '0' || char > '9') {
    event.preventDefault()
  }
}

async function confirmPassphrase() {
  if (!selectedAccount.value || !passphrase.value) return

  unlocking.value = true
  proofProgress.value = ''
  try {
    // Unlock account in browser (secret key never leaves browser!)
    const result = await accountStore.unlockAccountLocal(
      selectedAccount.value.address,
      passphrase.value
    )
    unlockedSecretKey.value = result.secretKey
    showPassphraseModal.value = false
    // Now proceed with note creation
    await doCreateNote()
  } catch (err) {
    logger.error('Failed to unlock account:', err)
    alert('Failed to unlock account: Wrong passphrase?')
  } finally {
    unlocking.value = false
    passphrase.value = ''
    proofProgress.value = ''
  }
}

interface MintNoteData {
  pkX: string
  pkY: string
  value: string
  token: string
  salt: string
  noteHash: string
}

/**
 * Generate mint proof entirely in browser
 */
async function generateMintProof(
  value: string,
  tokenType: string
): Promise<{ proof: FormattedProof; note: MintNoteData }> {
  if (!unlockedSecretKey.value || !selectedAccount.value?.publicKey) {
    throw new Error('Account not unlocked or missing public key')
  }

  const sk = unlockedSecretKey.value

  // Derive public key from secret key
  const { derivePublicKey } = await import('@/lib/accountCrypto')
  const pk = await derivePublicKey(sk)
  const salt = generateSalt()

  // Create note data
  const note: MintNoteData = {
    pkX: pk.x,
    pkY: pk.y,
    value,
    token: tokenType,
    salt,
    noteHash: '' // Will be computed
  }

  // Compute note hash using Poseidon (single field element)
  const noteHash = await computeCircuitHash(note)
  note.noteHash = noteHash

  // Prepare circuit inputs (async - uses Poseidon)
  const inputs = await prepareMintInputs(note, sk)

  // Generate proof in browser Web Worker
  proofProgress.value = 'Generating proof...'
  const result = await proofGenerator.generateProof(
    'mint_burn_note',
    inputs,
    (stage, progress, message) => {
      proofProgress.value = message || `${stage}: ${Math.round(progress * 100)}%`
    }
  )

  return {
    proof: result.proof,
    note
  }
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

    // Convert ETH/DAI amount to wei
    const amountInWei = parseEther(amount.value).toString()

    const { proof, note } = await generateMintProof(amountInWei, tokenType)

    // Extract proof components
    const { a, b, c, input } = proof

    // Convert proof values to BigInt for ethers v6
    const aBigInt = a.map(v => BigInt(v))
    const bBigInt = b.map(row => row.map(v => BigInt(v)))
    const cBigInt = c.map(v => BigInt(v))
    const inputBigInt = input.map(v => BigInt(v))

    // Encrypt note data for on-chain storage (ECDH with owner's public key)
    const encryptedNote = await encodeNoteData({
      pkX: note.pkX,
      pkY: note.pkY,
      value: note.value,
      token: note.token,
      salt: note.salt
    }, selectedAccount.value!.publicKey)
    // Use inline ABI to avoid stale build artifact cache issues
    // Poseidon version: uint256[4] input = [output, noteHash, value, tokenType]
    const mintAbi = ['function mint(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[4] input, bytes encryptedNote) external payable']
    const mintContract = new Contract(contractStore.dexAddress, mintAbi, web3Store.signer!)

    let tx
    if (props.token === 'DAI') {
      const approveTx = await contractStore.daiContract!.approve(
        contractStore.dexAddress,
        parseEther(amount.value)
      )
      await approveTx.wait()

      tx = await mintContract.mint(
        aBigInt, bBigInt, cBigInt, inputBigInt,
        encryptedNote
      )
    } else {
      tx = await mintContract.mint(
        aBigInt, bBigInt, cBigInt, inputBigInt,
        encryptedNote,
        { value: parseEther(amount.value) }
      )
    }

    const receipt = await tx.wait()

    if (receipt.status === 1) {
      // Note data is now stored on-chain via RLP encoding
      // Re-fetch from blockchain and update localStorage
      await noteStore.fetchAllNoteEvents()

      // Update DAI amount (non-blocking)
      updateDaiAmount().catch(err => logger.warn('Failed to update DAI:', err))

      alert('Note issued successfully!')
    } else {
      alert('Transaction failed')
    }

    router.push({ path: '/' })
  } catch (err) {
    logger.error('Failed to issue note:', err)
    alert('Failed to issue note: ' + (err as Error).message)
  } finally {
    loading.value = false
    // Clear secret key from memory after use
    unlockedSecretKey.value = ''
  }
}

async function updateDaiAmount() {
  if (!contractStore.daiContract || !web3Store.account) return
  try {
    const daiAmount = await contractStore.daiContract.balanceOf(web3Store.account)
    orderStore.setDaiAmount(daiAmount.toString())
  } catch (err) {
    logger.warn('Failed to update DAI amount:', err)
    // Non-critical error, continue
  }
}
</script>