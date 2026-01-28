import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAccountStore } from './account'
import { useContractStore } from './contract'
import { decodeNoteData, isNoteOwner } from '@/utils/noteEncryption'
import { isECDHEncrypted } from '@/lib/ecdhCrypto'
import { computeCircuitHash, type NoteData } from '@/lib/circuitInputs'
import * as api from '@/api'
import type { RawNoteEvent } from '@/api'

export interface Note {
  hash: string
  owner: string           // Account address (for display/lookup)
  pkX: string             // BabyJubJub public key X coordinate
  pkY: string             // BabyJubJub public key Y coordinate
  value: string
  token: string           // '0x0' = ETH, '0x1' = DAI
  state: string           // '0x0' = INVALID, '0x1' = VALID, '0x2' = TRADING, '0x3' = SPENT
  isSmart: string         // '0x0' = false, '0x1' = true
  salt?: string
  secretKey?: string      // For proving ownership in transfers
  createdAt?: number      // Unix timestamp
  createdInTx?: string    // Transaction hash
  createdBy?: string      // Ethereum address
  spentInTx?: string      // Transaction hash
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

  /**
   * Counts notes belonging to a specific account.
   * @param accountAddress - the account address to filter by
   * @returns the number of notes owned by the account
   */
  function numberOfNotesInAccount(accountAddress: string): number {
    return notes.value.filter(note => note.owner === accountAddress).length
  }

  /** Replaces the notes list. */
  function setNotes(newNotes: Note[]) {
    notes.value = newNotes
  }

  /**
   * Adds a note if not already present (deduplicates by hash).
   * @param note - the note to add
   */
  function addNote(note: Note) {
    // Check if note already exists
    const existing = notes.value.find(n => n.hash === note.hash)
    if (!existing) {
      notes.value.push(note)
    }
  }

  /**
   * Updates the state of a note in memory.
   * @param noteHash - the hash identifying the note
   * @param newState - the new state hex code to set
   */
  function updateNoteState(noteHash: string, newState: string) {
    const note = notes.value.find(n => n.hash === noteHash)
    if (note) {
      note.state = newState
    }
  }

  /** Replaces the transfer notes list. */
  function setTransferNotes(newTransferNotes: TransferNote[]) {
    transferNotes.value = newTransferNotes
  }

  /** Sets the currently selected note. */
  function setSelectedNote(note: Note | null) {
    selectedNote.value = note
  }

  /**
   * Compute note hash using Poseidon
   * hash = Poseidon(pkX, pkY, value, token, salt)
   */
  async function computeNoteHashPoseidon(pkX: string, pkY: string, value: string, token: string, salt: string): Promise<string> {
    const noteData: NoteData = {
      pkX,
      pkY,
      value,
      token,
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
              pkX: decoded.pkX,
              pkY: decoded.pkY,
              value: decoded.value,
              token: decoded.token,
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

  /** Loads transfer history from the API for all accounts. */
  async function loadTransferNotes() {
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

  /**
   * Scan blockchain for transfer history and save to localStorage.
   * Reconstructs transfer records from NoteStateChange events.
   */
  async function scanTransferHistory() {
    if (!contractStore.dexContract) {
      console.log('Contract not initialized')
      return
    }

    console.log('Scanning blockchain for transfer history...')

    try {
      // Get all NoteStateChange events
      const filter = contractStore.dexContract.filters.NoteStateChange()
      const events = await contractStore.dexContract.queryFilter(filter, 0, 'latest')

      // Group events by transaction
      const txEvents = new Map<string, { spent: string[]; created: string[] }>()

      for (const event of events) {
        const eventLog = event as import('ethers').EventLog
        if (!eventLog.args) continue

        const noteHash = eventLog.args[0] as string
        const state = Number(eventLog.args[1])
        const txHash = eventLog.transactionHash

        if (!txEvents.has(txHash)) {
          txEvents.set(txHash, { spent: [], created: [] })
        }

        const txData = txEvents.get(txHash)!
        if (state === 3) {
          // Note spent
          txData.spent.push(noteHash)
        } else if (state === 1) {
          // Note created
          txData.created.push(noteHash)
        }
      }

      // For each transaction with both spent and created notes, it's a transfer
      const accounts = accountStore.accounts || []
      const accountSecretKeys = new Map<string, string>()
      for (const account of accounts) {
        if (account.secretKey) {
          accountSecretKeys.set(account.address, account.secretKey)
        }
      }
      if (accountStore.secretKey && accountStore.currentAccount) {
        accountSecretKeys.set(accountStore.currentAccount.address, accountStore.secretKey)
      }

      let transferCount = 0

      for (const [txHash, txData] of txEvents) {
        // Skip if no spent notes (mint) or no created notes (burn/liquidate)
        if (txData.spent.length === 0 || txData.created.length === 0) continue

        // Try to decode notes involved
        const spentNotes: Array<{ hash: string; owner: string; value: string; token: string }> = []
        const createdNotes: Array<{ hash: string; owner: string; value: string; token: string }> = []

        for (const noteHash of [...txData.spent, ...txData.created]) {
          try {
            const encryptedData = await contractStore.dexContract!.encryptedNotes(noteHash)
            if (!encryptedData || encryptedData === '0x') continue

            let decoded = null
            let ownerAddress = ''

            if (isECDHEncrypted(encryptedData)) {
              for (const account of accounts) {
                const sk = accountSecretKeys.get(account.address)
                if (!sk) continue
                decoded = await decodeNoteData(encryptedData, sk)
                if (decoded) {
                  ownerAddress = account.address
                  break
                }
              }
            } else {
              decoded = await decodeNoteData(encryptedData)
              if (decoded) {
                for (const account of accounts) {
                  if (account.publicKey && await isNoteOwner(decoded, account.publicKey)) {
                    ownerAddress = account.address
                    break
                  }
                }
              }
            }

            if (decoded && ownerAddress) {
              const noteInfo = {
                hash: noteHash,
                owner: ownerAddress,
                value: decoded.value,
                token: decoded.token
              }
              if (txData.spent.includes(noteHash)) {
                spentNotes.push(noteInfo)
              } else {
                createdNotes.push(noteInfo)
              }
            }
          } catch (err) {
            console.warn(`Failed to decode note ${noteHash}:`, err)
          }
        }

        // If we have decoded notes from both sides, create transfer records
        if (spentNotes.length > 0 && createdNotes.length > 0) {
          const fromOwner = spentNotes[0].owner
          const totalSpent = spentNotes.reduce((sum, n) => sum + BigInt(n.value), 0n)

          // Find recipient notes (different owner) and change notes (same owner)
          const recipientNotes = createdNotes.filter(n => n.owner !== fromOwner)
          const changeNotes = createdNotes.filter(n => n.owner === fromOwner)

          for (const recipientNote of recipientNotes) {
            // Save send record for sender
            await api.addTransferNote(fromOwner, {
              hash: spentNotes[0].hash,
              type: '0x0', // Send
              from: fromOwner,
              to: recipientNote.owner,
              value: recipientNote.value,
              token: recipientNote.token,
              change: changeNotes.length > 0 ? changeNotes[0].value : '0',
              transactionHash: txHash
            })

            // Save receive record for recipient
            await api.addTransferNote(recipientNote.owner, {
              hash: recipientNote.hash,
              type: '0x1', // Receive
              from: fromOwner,
              to: recipientNote.owner,
              value: recipientNote.value,
              token: recipientNote.token,
              transactionHash: txHash
            })

            transferCount++
          }

          // Self-transfer (combine/split) - only change notes
          if (recipientNotes.length === 0 && changeNotes.length > 0) {
            await api.addTransferNote(fromOwner, {
              hash: spentNotes[0].hash,
              type: '0x0', // Self-transfer
              from: fromOwner,
              to: fromOwner,
              value: changeNotes[0].value,
              token: changeNotes[0].token,
              transactionHash: txHash
            })
            transferCount++
          }
        }
      }

      console.log(`Found ${transferCount} transfer records`)

      // Reload transfer notes from storage
      await loadTransferNotes()

    } catch (err) {
      console.error('Failed to scan transfer history:', err)
    }
  }

  /**
   * Fetch all NoteStateChange events from blockchain and store raw encrypted data
   * in localStorage. This does NOT decrypt the data - just stores it for later use.
   */
  async function fetchAllNoteEvents() {
    if (!contractStore.dexContract) {
      console.log('Contract not initialized')
      return
    }

    if (isScanning.value) {
      console.log('Already scanning...')
      return
    }

    isScanning.value = true
    console.log('Fetching all note events from blockchain...')

    try {
      const filter = contractStore.dexContract.filters.NoteStateChange()
      const events = await contractStore.dexContract.queryFilter(filter, 0, 'latest')
      console.log(`Found ${events.length} NoteStateChange events`)

      // Track latest state for each note
      const noteStates = new Map<string, number>()
      const noteCreatedBlock = new Map<string, number>()
      const noteCreatedTx = new Map<string, string>()
      const noteSpentTx = new Map<string, string>()

      for (const event of events) {
        const eventLog = event as import('ethers').EventLog
        if (!eventLog.args) continue

        const noteHash = eventLog.args[0] as string
        const state = Number(eventLog.args[1])

        // Capture block/tx when note first becomes Valid
        if (state === 1 && !noteCreatedBlock.has(noteHash)) {
          noteCreatedBlock.set(noteHash, eventLog.blockNumber)
          noteCreatedTx.set(noteHash, eventLog.transactionHash)
        }

        // Capture tx when note becomes Spent
        if (state === 3) {
          noteSpentTx.set(noteHash, eventLog.transactionHash)
        }

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

      // Resolve tx senders for createdInTx (Ethereum address that minted the note)
      const txSenders = new Map<string, string>()
      const uniqueCreateTxs = [...new Set(noteCreatedTx.values())]
      if (web3Store.provider) {
        await Promise.all(uniqueCreateTxs.map(async (txHash) => {
          try {
            const tx = await web3Store.provider!.getTransaction(txHash)
            if (tx?.from) txSenders.set(txHash, tx.from)
          } catch { /* skip */ }
        }))
      }

      // Fetch encrypted data for each note and store in localStorage
      const rawEvents: RawNoteEvent[] = []

      for (const [noteHash, state] of noteStates) {
        try {
          const encryptedData = await contractStore.dexContract!.encryptedNotes(noteHash)

          if (!encryptedData || encryptedData === '0x') continue

          const createdBlock = noteCreatedBlock.get(noteHash)
          const createdTx = noteCreatedTx.get(noteHash)
          rawEvents.push({
            hash: noteHash,
            encryptedData,
            state,
            createdInTx: createdTx,
            createdAtBlock: createdBlock,
            createdAt: createdBlock ? blockTimestamps.get(createdBlock) : undefined,
            createdBy: createdTx ? txSenders.get(createdTx) : undefined,
            spentInTx: noteSpentTx.get(noteHash)
          })
        } catch (err) {
          console.warn(`Failed to fetch encrypted data for ${noteHash}:`, err)
        }
      }

      // Save to localStorage
      api.saveRawNoteEvents(rawEvents)
      console.log(`Saved ${rawEvents.length} raw note events to localStorage`)

      // After fetching, decrypt and display notes for unlocked accounts
      await decryptAndDisplayNotes()

    } catch (err) {
      console.error('Failed to fetch note events:', err)
    } finally {
      isScanning.value = false
    }
  }

  /**
   * Decrypt notes from localStorage based on unlocked accounts.
   * This is called after fetchAllNoteEvents or when an account is unlocked.
   */
  async function decryptAndDisplayNotes() {
    const rawEvents = api.getRawNoteEvents()
    const accounts = accountStore.accounts || []

    console.log('[decryptAndDisplayNotes] Starting...', {
      rawEventCount: Object.keys(rawEvents).length,
      accountCount: accounts.length,
      accountsWithSk: accounts.filter(a => a.secretKey).map(a => a.address)
    })

    // Collect unlocked secret keys from accounts array
    // Each account stores its own secretKey after unlock
    const accountSecretKeys = new Map<string, string>()
    for (const account of accounts) {
      if (account.secretKey) {
        accountSecretKeys.set(account.address, account.secretKey)
      }
    }
    // Note: We no longer use accountStore.secretKey here because it only
    // holds the most recently unlocked account's key, which could overwrite
    // the correct key for a different account

    console.log('[decryptAndDisplayNotes] Unlocked accounts:', [...accountSecretKeys.keys()])

    if (accountSecretKeys.size === 0) {
      console.log('No unlocked accounts - cannot decrypt notes')
      notes.value = []
      return
    }

    const decryptedNotes: Note[] = []
    const newTransferNotes: TransferNote[] = []

    // Group events by tx for transfer reconstruction
    const txEvents = new Map<string, { spent: RawNoteEvent[]; created: RawNoteEvent[] }>()

    // Debug: show secretKey lengths for each account
    console.log('[decryptAndDisplayNotes] Account secretKey status:',
      accounts.map(a => ({ addr: a.address.slice(0,8), hasSk: !!a.secretKey, skLen: a.secretKey?.length })))

    for (const [noteHash, rawEvent] of Object.entries(rawEvents)) {
      try {
        const encryptedData = rawEvent.encryptedData
        if (!encryptedData || encryptedData === '0x') continue

        let decoded = null
        let ownerAccount = null

        if (isECDHEncrypted(encryptedData)) {
          // Try decrypt with each unlocked account's sk
          for (const account of accounts) {
            const sk = accountSecretKeys.get(account.address)
            if (!sk) continue

            decoded = await decodeNoteData(encryptedData, sk)
            if (decoded) {
              ownerAccount = account
              break
            }
          }
        } else {
          // Legacy RLP plaintext
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
          const note: Note = {
            hash: noteHash,
            owner: ownerAccount.address,
            pkX: decoded.pkX,
            pkY: decoded.pkY,
            value: decoded.value,
            token: decoded.token,
            salt: decoded.salt,
            state: STATE_MAP[rawEvent.state] || '0x0',
            isSmart: '0x0',
            createdAt: rawEvent.createdAt,
            createdInTx: rawEvent.createdInTx,
            createdBy: rawEvent.createdBy,
            spentInTx: rawEvent.spentInTx
          }
          decryptedNotes.push(note)

          // Group by tx for transfer reconstruction
          if (rawEvent.createdInTx) {
            if (!txEvents.has(rawEvent.createdInTx)) {
              txEvents.set(rawEvent.createdInTx, { spent: [], created: [] })
            }
            if (rawEvent.state === 1) {
              txEvents.get(rawEvent.createdInTx)!.created.push(rawEvent)
            }
          }
          if (rawEvent.spentInTx) {
            if (!txEvents.has(rawEvent.spentInTx)) {
              txEvents.set(rawEvent.spentInTx, { spent: [], created: [] })
            }
            txEvents.get(rawEvent.spentInTx)!.spent.push(rawEvent)
          }
        }
      } catch (err) {
        console.warn(`Failed to decrypt note ${noteHash}:`, err)
      }
    }

    // Fill in missing createdBy from other notes (temporary workaround for old data)
    const knownCreatedBy = decryptedNotes.find(n => n.createdBy)?.createdBy
    if (knownCreatedBy) {
      for (const note of decryptedNotes) {
        if (!note.createdBy) {
          note.createdBy = knownCreatedBy
        }
      }
    }

    notes.value = decryptedNotes
    console.log(`Decrypted ${decryptedNotes.length} notes for unlocked accounts`)

    // Reconstruct transfer history from decrypted notes
    const noteDataMap = new Map<string, { owner: string; value: string; token: string }>()
    for (const note of decryptedNotes) {
      noteDataMap.set(note.hash, { owner: note.owner, value: note.value, token: note.token })
    }

    for (const [txHash, txData] of txEvents) {
      if (txData.spent.length === 0 || txData.created.length === 0) continue

      const spentNotes = txData.spent
        .filter(e => noteDataMap.has(e.hash))
        .map(e => ({ hash: e.hash, ...noteDataMap.get(e.hash)! }))

      const createdNotes = txData.created
        .filter(e => noteDataMap.has(e.hash))
        .map(e => ({ hash: e.hash, ...noteDataMap.get(e.hash)! }))

      if (spentNotes.length > 0 && createdNotes.length > 0) {
        const fromOwner = spentNotes[0].owner

        const recipientNotes = createdNotes.filter(n => n.owner !== fromOwner)
        const changeNotes = createdNotes.filter(n => n.owner === fromOwner)

        for (const recipientNote of recipientNotes) {
          // Send record
          newTransferNotes.push({
            hash: spentNotes[0].hash,
            type: '0x0',
            from: fromOwner,
            to: recipientNote.owner,
            value: recipientNote.value,
            token: recipientNote.token,
            change: changeNotes.length > 0 ? changeNotes[0].value : '0',
            transactionHash: txHash
          })

          // Receive record
          newTransferNotes.push({
            hash: recipientNote.hash,
            type: '0x1',
            from: fromOwner,
            to: recipientNote.owner,
            value: recipientNote.value,
            token: recipientNote.token,
            transactionHash: txHash
          })
        }

        // Self-transfer
        if (recipientNotes.length === 0 && changeNotes.length > 0) {
          newTransferNotes.push({
            hash: spentNotes[0].hash,
            type: '0x0',
            from: fromOwner,
            to: fromOwner,
            value: changeNotes[0].value,
            token: changeNotes[0].token,
            transactionHash: txHash
          })
        }
      }
    }

    transferNotes.value = newTransferNotes
    console.log(`Reconstructed ${newTransferNotes.length} transfer records`)
  }

  /** Resets all note state to initial values. */
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
    scanTransferHistory,
    fetchAllNoteEvents,
    decryptAndDisplayNotes,
    reset
  }
})
