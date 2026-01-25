import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAccountStore } from './account'
import { useContractStore } from './contract'
import { decodeNoteData, isNoteOwner, deriveAddressFromPublicKey } from '@/utils/noteEncryption'
import { sha256 } from 'ethers'
import * as api from '@/api'

export interface Note {
  hash: string
  owner: string           // Account address (for display/lookup)
  ownerAddress: string    // 160-bit note owner address
  value: string
  token: string           // '0x0' = ETH, '0x1' = DAI
  state: string           // '0x0' = INVALID, '0x1' = VALID, '0x2' = TRADING, '0x3' = SPENT
  isSmart: string         // '0x0' = false, '0x1' = true
  salt?: string
  viewingKey?: string
  secretKey?: string      // For proving ownership in transfers
}

export interface TransferNote {
  hash: string
  type: string  // '0x0' = Send, '0x1' = Receive
  from?: string
  to?: string
  value: string
  token: string
  change?: string
  transactionHash?: string
}

// State enum from contract
const STATE_MAP: Record<number, string> = {
  0: '0x0',  // Invalid
  1: '0x1',  // Valid
  2: '0x2',  // Trading
  3: '0x3',  // Spent
}

export const useNoteStore = defineStore('note', () => {
  const accountStore = useAccountStore()
  const contractStore = useContractStore()

  const notes = ref<Note[]>([])
  const transferNotes = ref<TransferNote[]>([])
  const selectedNote = ref<Note | null>(null)
  const isScanning = ref(false)
  const lastScannedBlock = ref(0)

  const validNotes = computed(() => {
    return notes.value.filter(note => note.state === '0x1')
  })

  const smartNotes = computed(() => {
    return notes.value.filter(note => note.isSmart === '0x1')
  })

  const ethNotes = computed(() => {
    return notes.value.filter(note => note.token === '0x0' && note.state === '0x1')
  })

  const daiNotes = computed(() => {
    return notes.value.filter(note => note.token === '0x1' && note.state === '0x1')
  })

  function numberOfNotesInAccount(accountAddress: string): number {
    return notes.value.filter(note => note.owner === accountAddress).length
  }

  function setNotes(newNotes: Note[]) {
    notes.value = newNotes
  }

  function addNote(note: Note) {
    // Check if note already exists
    const existing = notes.value.find(n => n.hash === note.hash)
    if (!existing) {
      notes.value.push(note)
    }
  }

  function updateNoteState(noteHash: string, newState: string) {
    const note = notes.value.find(n => n.hash === noteHash)
    if (note) {
      note.state = newState
    }
  }

  function setTransferNotes(newTransferNotes: TransferNote[]) {
    transferNotes.value = newTransferNotes
  }

  function setSelectedNote(note: Note | null) {
    selectedNote.value = note
  }

  /**
   * Compute note hash from note data (matching circuit's SHA256 hash)
   * Hash format: SHA256(ownerAddress(160) || value(256) || type(256) || vk0(128) || vk1(128) || salt(256))
   */
  function computeNoteHash(ownerAddress: string, value: string, token: string, viewingKey: string, salt: string): string {
    // Convert to BigInt and pad to correct sizes
    const addrBig = BigInt(ownerAddress)
    const valueBig = BigInt(value)
    const tokenBig = BigInt(token)
    const vkBig = BigInt(viewingKey || '0')
    const saltBig = BigInt(salt)

    // Split viewingKey into two 128-bit parts
    const mask128 = (BigInt(1) << BigInt(128)) - BigInt(1)
    const vk1 = vkBig & mask128          // low 128 bits
    const vk0 = vkBig >> BigInt(128)     // high 128 bits

    // Build message: ownerAddress(20B) + value(32B) + token(32B) + vk0(16B) + vk1(16B) + salt(32B) = 148 bytes
    const addrHex = addrBig.toString(16).padStart(40, '0')   // 160 bits = 40 hex
    const valueHex = valueBig.toString(16).padStart(64, '0') // 256 bits = 64 hex
    const tokenHex = tokenBig.toString(16).padStart(64, '0') // 256 bits = 64 hex
    const vk0Hex = vk0.toString(16).padStart(32, '0')        // 128 bits = 32 hex
    const vk1Hex = vk1.toString(16).padStart(32, '0')        // 128 bits = 32 hex
    const saltHex = saltBig.toString(16).padStart(64, '0')   // 256 bits = 64 hex

    const data = '0x' + addrHex + valueHex + tokenHex + vk0Hex + vk1Hex + saltHex
    return sha256(data)
  }

  /**
   * Scan blockchain for notes belonging to user's accounts
   */
  async function scanBlockchainNotes() {
    if (!contractStore.dexContract) {
      // Contract not yet initialized - this is expected during initial page load
      // User can click Refresh button once connected, or notes will load on next navigation
      console.log('Waiting for contract initialization...')
      return
    }

    if (isScanning.value) {
      console.log('Already scanning...')
      return
    }

    isScanning.value = true
    console.log('Scanning blockchain for notes...')

    try {
      const accounts = accountStore.accounts || []
      if (accounts.length === 0) {
        console.log('No accounts to scan for')
        return
      }

      // Get NoteStateChange events
      const filter = contractStore.dexContract.filters.NoteStateChange()
      const events = await contractStore.dexContract.queryFilter(filter, 0, 'latest')
      console.log(`Found ${events.length} NoteStateChange events`)

      // Track note states and data
      const noteStates = new Map<string, number>()
      const noteDataMap = new Map<string, Note>()

      for (const event of events) {
        // Cast to EventLog to access args
        const eventLog = event as import('ethers').EventLog
        if (!eventLog.args) continue

        const noteHash = eventLog.args[0] as string
        const state = Number(eventLog.args[1])

        // Update state (later events override earlier ones)
        noteStates.set(noteHash, state)
      }

      // For each note, try to get encrypted data and decode
      for (const [noteHash, state] of noteStates) {
        try {
          // Get encrypted note data from contract
          const encryptedData = await contractStore.dexContract!.encryptedNotes(noteHash)

          if (!encryptedData || encryptedData === '0x') {
            continue
          }

          // Decode the note data
          const decoded = decodeNoteData(encryptedData)
          if (!decoded) {
            continue
          }

          // Check if this note belongs to any of our accounts
          for (const account of accounts) {
            if (account.publicKey && isNoteOwner(decoded, account.publicKey)) {
              // Create note with address-based ownership
              const note: Note = {
                hash: noteHash,
                owner: account.address,
                ownerAddress: decoded.ownerAddress,
                value: decoded.value,
                token: decoded.token,
                viewingKey: decoded.viewingKey,
                salt: decoded.salt,
                state: STATE_MAP[state] || '0x0',
                isSmart: '0x0'
              }

              noteDataMap.set(noteHash, note)
              break // Found owner, no need to check other accounts
            }
          }
        } catch (err) {
          console.warn(`Failed to process note ${noteHash}:`, err)
        }
      }

      // Update notes
      notes.value = Array.from(noteDataMap.values())
      console.log(`Found ${notes.value.length} notes belonging to user`)

    } catch (err) {
      console.error('Failed to scan blockchain:', err)
    } finally {
      isScanning.value = false
    }
  }

  /**
   * Load notes - now scans blockchain instead of API
   */
  async function loadNotes() {
    await scanBlockchainNotes()
  }

  async function loadTransferNotes() {
    // Transfer history still uses local storage for now
    // Could be derived from blockchain events in the future
    try {
      const accounts = accountStore.accounts || []
      const allTransferNotes: TransferNote[] = []

      for (const account of accounts) {
        const accountTransferNotes = await api.getTransferNotes(account.address)
        if (accountTransferNotes) {
          allTransferNotes.push(...accountTransferNotes)
        }
      }

      transferNotes.value = allTransferNotes
    } catch (err) {
      console.error('Failed to load transfer notes:', err)
    }
  }

  function reset() {
    notes.value = []
    transferNotes.value = []
    selectedNote.value = null
    lastScannedBlock.value = 0
  }

  return {
    notes,
    transferNotes,
    selectedNote,
    isScanning,
    validNotes,
    smartNotes,
    ethNotes,
    daiNotes,
    numberOfNotesInAccount,
    setNotes,
    addNote,
    updateNoteState,
    setTransferNotes,
    setSelectedNote,
    loadNotes,
    loadTransferNotes,
    scanBlockchainNotes,
    reset
  }
})
