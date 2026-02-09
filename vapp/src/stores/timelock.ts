import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAccountStore } from './account'
import { useContractStore } from './contract'
import { useNoteStore, type Note } from './note'
import { useWeb3Store } from './web3'
import { proofGenerator, type CircuitName } from '@/lib/proofGenerator'
import { computeTimeLockNoteHash, computeCircuitHash, type NoteData } from '@/lib/circuitInputs'
import { encodeNoteData, decodeNoteData } from '@/utils/noteEncryption'
import { logger } from '@/lib/logger'

export interface TimeLockNote extends Note {
  unlockTime: number      // Unix timestamp
  isUnlocked: boolean     // computed from current time
  remainingTime?: number  // seconds until unlock
  lockType: number        // 0 = time-lock
  salt?: string           // Random salt (needed for spending)
}

export interface CreateTimeLockParams {
  note: Note              // Existing note to convert (for value reference)
  recipientPkX: string    // Recipient public key X
  recipientPkY: string    // Recipient public key Y
  unlockTime: number      // Unix timestamp for unlock
  value: string           // Value to lock
  tokenType: string       // '0' = ETH, '1' = DAI
}

export interface SpendTimeLockParams {
  timeLockNote: TimeLockNote
  recipientPkX: string    // Recipient public key X (can be same or different owner)
  recipientPkY: string    // Recipient public key Y
}

export const useTimeLockStore = defineStore('timelock', () => {
  const accountStore = useAccountStore()
  const contractStore = useContractStore()
  const noteStore = useNoteStore()
  const web3Store = useWeb3Store()

  const timeLockNotes = ref<TimeLockNote[]>([])
  const isLoading = ref(false)
  const isCreating = ref(false)
  const isSpending = ref(false)

  // Computed: unlocked notes (past unlock time)
  const unlockedNotes = computed(() => {
    const now = Math.floor(Date.now() / 1000)
    return timeLockNotes.value.filter(note => note.unlockTime <= now && note.state === '0x1')
  })

  // Computed: locked notes (still waiting)
  const lockedNotes = computed(() => {
    const now = Math.floor(Date.now() / 1000)
    return timeLockNotes.value.filter(note => note.unlockTime > now && note.state === '0x1')
  })

  /**
   * Load time-lock notes from blockchain events
   */
  async function loadTimeLockNotes() {
    if (!contractStore.timeLockContract) {
      logger.warn('[TimeLock] Contract not initialized')
      return
    }

    // Get unlocked account for decryption
    const account = accountStore.accounts.find(acc => acc.secretKey)

    isLoading.value = true
    logger.log('[TimeLock] Loading time-lock notes...')

    try {
      // Get TimeLockCreated events
      const filter = contractStore.timeLockContract.filters.TimeLockCreated()
      const events = await contractStore.timeLockContract.queryFilter(filter, 0, 'latest')

      logger.log(`[TimeLock] Found ${events.length} TimeLockCreated events`)

      const notes: TimeLockNote[] = []
      const now = Math.floor(Date.now() / 1000)

      for (const event of events) {
        const eventLog = event as import('ethers').EventLog
        if (!eventLog.args) continue

        const noteHash = eventLog.args[0] as string
        const value = eventLog.args[1].toString()
        const tokenType = eventLog.args[2].toString()
        const unlockTime = Number(eventLog.args[3])

        // Check note state
        const state = await contractStore.timeLockContract.notes(noteHash)
        const stateHex = `0x${Number(state).toString(16)}`

        // Skip spent notes
        if (stateHex !== '0x1') continue

        // Try to decrypt the note to get pkX, pkY, salt
        let pkX = ''
        let pkY = ''
        let salt = ''

        if (account?.secretKey) {
          try {
            const encryptedData = await contractStore.timeLockContract.encryptedNotes(noteHash)
            if (encryptedData && encryptedData !== '0x') {
              const decoded = await decodeNoteData(encryptedData, account.secretKey)
              if (decoded) {
                pkX = decoded.pkX
                pkY = decoded.pkY
                salt = decoded.salt
                logger.log(`[TimeLock] Decrypted note ${noteHash.slice(0, 10)}...: pkX=${pkX.slice(0, 10)}...`)
              }
            }
          } catch (decryptErr) {
            logger.warn(`[TimeLock] Failed to decrypt note ${noteHash.slice(0, 10)}:`, decryptErr)
          }
        }

        // Only add notes that belong to the current user (decryption succeeded)
        if (pkX && pkY && account?.publicKey) {
          // Check if this note belongs to the current user
          if (pkX === account.publicKey.x && pkY === account.publicKey.y) {
            const timeLockNote: TimeLockNote = {
              hash: noteHash,
              owner: account.address,
              pkX,
              pkY,
              value,
              token: tokenType === '0' ? '0x0' : '0x1',
              state: stateHex,
              isSmart: '0x0',
              unlockTime,
              isUnlocked: now >= unlockTime,
              remainingTime: Math.max(0, unlockTime - now),
              lockType: 0,
              salt
            }

            notes.push(timeLockNote)
          }
        }
      }

      timeLockNotes.value = notes
      logger.log(`[TimeLock] Loaded ${notes.length} time-lock notes for current user`)

    } catch (err) {
      logger.error('[TimeLock] Failed to load notes:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Create a new time-locked note
   */
  async function createTimeLock(params: CreateTimeLockParams): Promise<string | null> {
    // Find an unlocked account (one with secretKey)
    const account = accountStore.accounts.find(acc => acc.secretKey)
    if (!account?.secretKey) {
      throw new Error('Account not unlocked')
    }

    if (!contractStore.timeLockContract) {
      throw new Error('TimeLock contract not initialized')
    }

    // Get blockchain time and validate/adjust unlockTime
    const blockTimestamp = await web3Store.getBlockTimestamp()
    let unlockTime = params.unlockTime

    // Ensure unlockTime is at least 60 seconds in the future relative to block.timestamp
    const minUnlockTime = blockTimestamp + 60
    if (unlockTime <= blockTimestamp) {
      logger.warn(`[TimeLock] unlockTime (${unlockTime}) is not in future relative to block.timestamp (${blockTimestamp}). Adjusting to ${minUnlockTime}`)
      unlockTime = minUnlockTime
    }

    logger.log(`[TimeLock] Block timestamp: ${blockTimestamp}, Unlock time: ${unlockTime}`)

    isCreating.value = true
    logger.log('[TimeLock] Creating time-lock note...')

    try {
      // Generate random salt
      const saltBytes = crypto.getRandomValues(new Uint8Array(16))
      const salt = BigInt('0x' + Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('')).toString()

      // Compute time-lock note hash
      const noteHash = await computeTimeLockNoteHash({
        pkX: params.recipientPkX,
        pkY: params.recipientPkY,
        value: params.value,
        tokenType: params.tokenType,
        salt,
        unlockTime: unlockTime.toString(),
        lockType: '0',
        vk: params.recipientPkX
      })

      logger.log('[TimeLock] Note hash:', noteHash.slice(0, 20) + '...')

      // Generate proof
      // Note: sk is not needed for create_timelock - ownership is verified at spend time
      const circuitInputs = {
        noteHash,
        value: params.value,
        tokenType: params.tokenType,
        unlockTime: unlockTime.toString(),
        pkX: params.recipientPkX,
        pkY: params.recipientPkY,
        salt
      }

      const { proof, publicSignals } = await proofGenerator.generateProof(
        'create_timelock' as CircuitName,
        circuitInputs
      )

      logger.log('[TimeLock] Proof generated')

      // Encrypt note data for recipient
      const encryptedNote = await encodeNoteData({
        pkX: params.recipientPkX,
        pkY: params.recipientPkY,
        value: params.value,
        token: params.tokenType,
        salt
      }, { x: params.recipientPkX, y: params.recipientPkY })

      // Prepare contract call
      const input = [
        BigInt(publicSignals[0]),
        BigInt(publicSignals[1]),
        BigInt(publicSignals[2]),
        BigInt(publicSignals[3]),
        BigInt(publicSignals[4])
      ]

      // Determine value to send
      const ethValue = params.tokenType === '0' ? BigInt(params.value) : 0n

      // Call contract
      const tx = await contractStore.timeLockContract.createTimeLock(
        [BigInt(proof.a[0]), BigInt(proof.a[1])],
        [[BigInt(proof.b[0][0]), BigInt(proof.b[0][1])], [BigInt(proof.b[1][0]), BigInt(proof.b[1][1])]],
        [BigInt(proof.c[0]), BigInt(proof.c[1])],
        input,
        encryptedNote,
        { value: ethValue }
      )

      logger.log('[TimeLock] Transaction sent:', tx.hash)
      await tx.wait()
      logger.log('[TimeLock] Transaction confirmed')

      // Reload notes
      await loadTimeLockNotes()

      return noteHash

    } catch (err) {
      logger.error('[TimeLock] Failed to create time-lock:', err)
      throw err
    } finally {
      isCreating.value = false
    }
  }

  /**
   * Spend a time-locked note after unlock time
   */
  async function spendTimeLock(params: SpendTimeLockParams): Promise<string | null> {
    // Find an unlocked account (one with secretKey)
    const account = accountStore.accounts.find(acc => acc.secretKey)
    if (!account?.secretKey) {
      throw new Error('Account not unlocked')
    }

    if (!contractStore.timeLockContract) {
      throw new Error('TimeLock contract not initialized')
    }

    const { timeLockNote } = params

    // Get current time from blockchain (more reliable than Date.now())
    const blockTimestamp = await web3Store.getBlockTimestamp()
    logger.log(`[TimeLock] Block timestamp: ${blockTimestamp}, Unlock time: ${timeLockNote.unlockTime}`)

    // Verify note is unlocked
    if (timeLockNote.unlockTime > blockTimestamp) {
      throw new Error('Note is still locked')
    }

    isSpending.value = true
    logger.log('[TimeLock] Spending time-lock note...')

    try {
      // Generate random salt for output note
      const outSaltBytes = crypto.getRandomValues(new Uint8Array(16))
      const outSalt = BigInt('0x' + Array.from(outSaltBytes).map(b => b.toString(16).padStart(2, '0')).join('')).toString()

      // Compute output regular note hash
      const outputHash = await computeCircuitHash({
        pkX: params.recipientPkX,
        pkY: params.recipientPkY,
        value: timeLockNote.value,
        token: timeLockNote.token === '0x0' ? '0' : '1',
        salt: outSalt
      })

      logger.log('[TimeLock] Output note hash:', outputHash.slice(0, 20) + '...')

      // Generate proof
      const circuitInputs = {
        noteHash: timeLockNote.hash,
        outputHash,
        currentTime: blockTimestamp.toString(),
        tokenType: timeLockNote.token === '0x0' ? '0' : '1',
        pkX: timeLockNote.pkX,
        pkY: timeLockNote.pkY,
        sk: account.secretKey,
        value: timeLockNote.value,
        salt: timeLockNote.salt || '0',
        unlockTime: timeLockNote.unlockTime.toString(),
        outPkX: params.recipientPkX,
        outPkY: params.recipientPkY,
        outSalt
      }

      const { proof, publicSignals } = await proofGenerator.generateProof(
        'spend_timelock' as CircuitName,
        circuitInputs
      )

      logger.log('[TimeLock] Proof generated')

      // Encrypt output note data
      // IMPORTANT: Store values in same format as used for hash computation
      const outputNoteData = {
        pkX: params.recipientPkX,
        pkY: params.recipientPkY,
        value: timeLockNote.value,
        token: timeLockNote.token === '0x0' ? '0' : '1',
        salt: outSalt
      }
      logger.log('[TimeLock] Output note data being saved:', {
        pkX: outputNoteData.pkX,
        pkY: outputNoteData.pkY,
        value: outputNoteData.value,
        token: outputNoteData.token,
        salt: outputNoteData.salt,
        outputHash
      })
      const encryptedNote = await encodeNoteData(outputNoteData, { x: params.recipientPkX, y: params.recipientPkY })

      // Prepare contract call
      const input = [
        BigInt(publicSignals[0]),
        BigInt(publicSignals[1]),
        BigInt(publicSignals[2]),
        BigInt(publicSignals[3]),
        BigInt(publicSignals[4])
      ]

      // Call contract
      const tx = await contractStore.timeLockContract.spendTimeLock(
        [BigInt(proof.a[0]), BigInt(proof.a[1])],
        [[BigInt(proof.b[0][0]), BigInt(proof.b[0][1])], [BigInt(proof.b[1][0]), BigInt(proof.b[1][1])]],
        [BigInt(proof.c[0]), BigInt(proof.c[1])],
        input,
        encryptedNote
      )

      logger.log('[TimeLock] Transaction sent:', tx.hash)
      await tx.wait()
      logger.log('[TimeLock] Transaction confirmed')

      // Reload both time-lock notes and regular notes
      await loadTimeLockNotes()
      await noteStore.loadNotes()

      return outputHash

    } catch (err) {
      logger.error('[TimeLock] Failed to spend time-lock:', err)
      throw err
    } finally {
      isSpending.value = false
    }
  }

  /**
   * Update remaining time for all locked notes
   */
  function updateRemainingTimes() {
    const now = Math.floor(Date.now() / 1000)
    for (const note of timeLockNotes.value) {
      note.isUnlocked = now >= note.unlockTime
      note.remainingTime = Math.max(0, note.unlockTime - now)
    }
  }

  /**
   * Format remaining time as human-readable string
   */
  function formatRemainingTime(seconds: number): string {
    if (seconds <= 0) return 'Unlocked'

    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    const parts: string[] = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    if (secs > 0 && days === 0) parts.push(`${secs}s`)

    return parts.join(' ') || '0s'
  }

  /**
   * Reset store state
   */
  function reset() {
    timeLockNotes.value = []
    isLoading.value = false
    isCreating.value = false
    isSpending.value = false
  }

  return {
    timeLockNotes,
    isLoading,
    isCreating,
    isSpending,
    unlockedNotes,
    lockedNotes,
    loadTimeLockNotes,
    createTimeLock,
    spendTimeLock,
    updateRemainingTimes,
    formatRemainingTime,
    reset
  }
})
