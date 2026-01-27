import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAccountStore } from './account'
import { useContractStore } from './contract'
import { decodeNoteData, isNoteOwner } from '@/utils/noteEncryption'
import { isECDHEncrypted } from '@/lib/ecdhCrypto'
import { computeCircuitHash, type NoteData } from '@/lib/circuitInputs'
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
  createdAt?: number      // Unix timestamp from block when note was created
  createdInTx?: string    // Transaction hash that created (VALID) this note
  createdBy?: string      // Ethereum address that sent the createdInTx
  spentInTx?: string      // Transaction hash that spent this note
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
   * Compute note hash using Poseidon
   * hash = Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)
   */
  async function computeNoteHashPoseidon(ownerAddress: string, value: string, token: string, viewingKey: string, salt: string): Promise<string> {
    const noteData: NoteData = {
      ownerAddress,
      value,
      token,
      viewingKey: viewingKey || '0x0',
      salt
    }
    return await computeCircuitHash(noteData)
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
      const noteCreatedBlock = new Map<string, number>() // block when note first became Valid
      const noteCreatedTx = new Map<string, string>()    // tx that created (VALID) the note
      const noteSpentTx = new Map<string, string>()      // tx that spent the note
      const noteDataMap = new Map<string, Note>()

      for (const event of events) {
        // Cast to EventLog to access args
        const eventLog = event as import('ethers').EventLog
        if (!eventLog.args) continue

        const noteHash = eventLog.args[0] as string
        const state = Number(eventLog.args[1])

        // Capture block number and tx when note first becomes Valid (created)
        if (state === 1 && !noteCreatedBlock.has(noteHash)) {
          noteCreatedBlock.set(noteHash, eventLog.blockNumber)
          noteCreatedTx.set(noteHash, eventLog.transactionHash)
        }

        // Capture tx when note becomes Spent
        if (state === 3) {
          noteSpentTx.set(noteHash, eventLog.transactionHash)
        }

        // Update state (later events override earlier ones)
        noteStates.set(noteHash, state)
      }

      // Resolve block timestamps
      const blockTimestamps = new Map<number, number>()
      const uniqueBlocks = [...new Set(noteCreatedBlock.values())]
      const web3Store = (await import('./web3')).useWeb3Store()
      if (web3Store.provider) {
        await Promise.all(uniqueBlocks.map(async (blockNum) => {
          try {
            const block = await web3Store.provider!.getBlock(blockNum)
            if (block) blockTimestamps.set(blockNum, block.timestamp)
          } catch { /* skip */ }
        }))
      }

      // Resolve tx senders for createdInTx
      const txSenders = new Map<string, string>()
      const uniqueCreateTxs = [...new Set(noteCreatedTx.values())]
      if (web3Store.provider) {
        await Promise.all(uniqueCreateTxs.map(async (txHash) => {
          try {
            const tx = await web3Store.provider!.getTransaction(txHash)
            if (tx) txSenders.set(txHash, tx.from)
          } catch { /* skip */ }
        }))
      }

      // Collect unlocked secret keys per account (for ECDH decryption)
      const accountSecretKeys = new Map<string, string>()
      for (const account of accounts) {
        if (account.secretKey) {
          accountSecretKeys.set(account.address, account.secretKey)
        }
      }
      // Also check the store-level secretKey (current account)
      if (accountStore.secretKey && accountStore.currentAccount) {
        accountSecretKeys.set(accountStore.currentAccount.address, accountStore.secretKey)
      }

      // For each note, try to get encrypted data and decode
      for (const [noteHash, state] of noteStates) {
        try {
          // Get encrypted note data from contract
          const encryptedData = await contractStore.dexContract!.encryptedNotes(noteHash)

          if (!encryptedData || encryptedData === '0x') {
            continue
          }

          let decoded = null
          let ownerAccount = null

          if (isECDHEncrypted(encryptedData)) {
            // ECDH encrypted: try-decrypt with each unlocked account's sk
            for (const account of accounts) {
              const sk = accountSecretKeys.get(account.address)
              if (!sk) continue

              decoded = await decodeNoteData(encryptedData, sk)
              if (decoded) {
                ownerAccount = account
                break // Successful decrypt = this account owns the note
              }
            }
          } else {
            // Legacy RLP plaintext: decode then check ownership by address
            decoded = await decodeNoteData(encryptedData)
            if (decoded) {
              for (const account of accounts) {
                if (account.publicKey && await isNoteOwner(decoded, account.publicKey)) {
                  ownerAccount = account
                  break
                }
              }
            }
          }

          if (decoded && ownerAccount) {
            const createdBlock = noteCreatedBlock.get(noteHash)
            const note: Note = {
              hash: noteHash,
              owner: ownerAccount.address,
              ownerAddress: decoded.ownerAddress,
              value: decoded.value,
              token: decoded.token,
              viewingKey: decoded.viewingKey,
              salt: decoded.salt,
              state: STATE_MAP[state] || '0x0',
              isSmart: '0x0',
              createdAt: createdBlock ? blockTimestamps.get(createdBlock) : undefined,
              createdInTx: noteCreatedTx.get(noteHash),
              createdBy: noteCreatedTx.has(noteHash) ? txSenders.get(noteCreatedTx.get(noteHash)!) : undefined,
              spentInTx: noteSpentTx.get(noteHash)
            }

            noteDataMap.set(noteHash, note)
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
