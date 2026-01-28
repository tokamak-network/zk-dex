# vapp Vue 3 Migration Guide

## Overview

This document describes the migration of the `vapp` frontend application from Vue 2 to Vue 3.

### Migration Summary

| Component | Before | After |
|-----------|--------|-------|
| Vue | 2.6.10 | 3.4.21 |
| State Management | Vuex 3 | Pinia 2.1.7 |
| UI Library | Buefy 0.8.2 | Oruga UI 0.8.12 + Bulma |
| Build Tool | Vue CLI 3.9.0 | Vite 5.1.5 |
| Language | JavaScript | TypeScript 5.4.2 |
| Web3 Library | web3.js 1.0.0-beta.37 | ethers.js 6.11.1 |
| CSS Preprocessor | node-sass | sass (dart-sass) 1.71.1 |
| Router | Vue Router 3 | Vue Router 4.3.0 |

## File Structure Changes

### New Files Created

```
vapp/
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
├── tsconfig.node.json      # Node TypeScript configuration
├── index.html              # Vite entry HTML (moved from public/)
├── src/
│   ├── main.ts             # New entry point (replaces main.js)
│   ├── env.d.ts            # TypeScript environment declarations
│   ├── stores/             # Pinia stores (replaces store/)
│   │   ├── index.ts
│   │   ├── account.ts
│   │   ├── contract.ts
│   │   ├── note.ts
│   │   ├── order.ts
│   │   └── web3.ts
│   ├── api/
│   │   └── index.ts        # Typed API module
│   ├── composables/
│   │   └── useFormatters.ts  # Replaces Vue 2 filters
│   └── router/
│       └── index.ts        # Vue Router 4 configuration
```

### Deleted Files

```
vapp/
├── src/
│   ├── main.js             # Replaced by main.ts
│   ├── store/              # Replaced by stores/ (Pinia)
│   │   ├── index.js
│   │   ├── state.js
│   │   ├── mutations.js
│   │   ├── actions.js
│   │   └── getters.js
│   ├── filters/            # Replaced by composables
│   │   └── index.js
│   └── router/
│       └── index.js        # Replaced by index.ts
├── babel.config.js         # Not needed with Vite
└── vue.config.js           # Replaced by vite.config.ts
```

## Key Migration Changes

### 1. Entry Point (main.ts)

**Before (Vue 2):**
```javascript
import Vue from 'vue'
import Vuex from 'vuex'
import Buefy from 'buefy'
import App from './App.vue'
import router from './router'
import store from './store'

Vue.use(Vuex)
Vue.use(Buefy)

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
```

**After (Vue 3):**
```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Oruga from '@oruga-ui/oruga-next'
import { bulmaConfig } from '@oruga-ui/theme-bulma'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(Oruga, bulmaConfig)
app.mount('#app')
```

### 2. Component Syntax (Script Setup)

**Before (Options API):**
```javascript
<script>
import { mapState, mapMutations } from 'vuex'

export default {
  data() {
    return {
      loading: false
    }
  },
  computed: {
    ...mapState(['accounts', 'notes'])
  },
  created() {
    this.loadData()
  },
  methods: {
    ...mapMutations(['SET_ACCOUNTS']),
    async loadData() {
      // ...
    }
  }
}
</script>
```

**After (Composition API with Script Setup):**
```typescript
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAccountStore } from '@/stores/account'
import { useNoteStore } from '@/stores/note'

const accountStore = useAccountStore()
const noteStore = useNoteStore()

const loading = ref(false)

onMounted(async () => {
  await loadData()
})

async function loadData() {
  // ...
}
</script>
```

### 3. State Management (Vuex → Pinia)

**Before (Vuex):**
```javascript
// store/index.js
export default new Vuex.Store({
  state: {
    accounts: null,
    notes: null
  },
  mutations: {
    SET_ACCOUNTS(state, accounts) {
      state.accounts = accounts
    }
  },
  actions: {
    async loadAccounts({ commit }) {
      const accounts = await api.getAccounts()
      commit('SET_ACCOUNTS', accounts)
    }
  },
  getters: {
    validNotes: state => state.notes?.filter(n => n.state === '0x1')
  }
})
```

**After (Pinia):**
```typescript
// stores/account.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as api from '@/api'

export interface Account {
  address: string
  publicKey: string
}

export const useAccountStore = defineStore('account', () => {
  const accounts = ref<Account[]>([])

  const accountCount = computed(() => accounts.value.length)

  async function loadAccounts() {
    const data = await api.getAccounts(key.value!)
    accounts.value = data || []
  }

  function reset() {
    accounts.value = []
  }

  return { accounts, accountCount, loadAccounts, reset }
})
```

### 4. Filters → Composables

**Before (Vue 2 Filter):**
```javascript
// filters/index.js
Vue.filter('abbreviate', (value) => {
  if (!value) return ''
  return value.slice(0, 6) + '...' + value.slice(-4)
})

// Usage in template
{{ address | abbreviate }}
```

**After (Composable):**
```typescript
// composables/useFormatters.ts
export function useFormatters() {
  function abbreviate(value: string): string {
    if (!value) return ''
    return value.slice(0, 6) + '...' + value.slice(-4)
  }

  return { abbreviate }
}

// Usage in component
const fmt = useFormatters()

// Usage in template
{{ fmt.abbreviate(address) }}
```

### 5. Event Bus → Props/Emits or Pinia

**Before (Event Bus):**
```javascript
// In parent
this.$bus.$emit('select-note', note)

// In child
created() {
  this.$bus.$on('select-note', this.handleNote)
},
beforeDestroy() {
  this.$bus.$off('select-note')
}
```

**After (Emits/Props):**
```typescript
// In child component
const emit = defineEmits<{
  selectNote: [note: Note]
}>()

// Emit event
emit('selectNote', note)

// In parent template
<ChildComponent @selectNote="handleNote" />
```

### 6. UI Components (Buefy → Oruga)

| Buefy | Oruga |
|-------|-------|
| `<b-field>` | `<o-field>` |
| `<b-input>` | `<o-input>` |
| `<b-button>` | `<o-button>` |
| `<b-modal>` | `<o-modal>` |
| `<b-table>` | `<o-table>` |
| `<b-tabs>` | `<o-tabs>` |
| `<b-radio>` | `<o-radio>` |
| `<b-switch>` | `<o-switch>` |
| `<b-select>` | `<o-select>` |

### 7. Web3 Library (web3.js → ethers.js)

**Before (web3.js):**
```javascript
import Web3 from 'web3'

const web3 = new Web3(window.ethereum)
const accounts = await web3.eth.getAccounts()
const balance = await web3.eth.getBalance(account)
```

**After (ethers.js):**
```typescript
import { BrowserProvider } from 'ethers'

const provider = new BrowserProvider(window.ethereum)
const accounts = await provider.send('eth_requestAccounts', [])
const balance = await provider.getBalance(account)
```

## Build Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Type checking
npm run type-check

# Preview production build
npm run preview

# Start Express backend
npm run server
```

## Post-Migration Enhancements

### Client-side Cryptography (`src/lib/`)

| Module | Description |
|--------|-------------|
| `accountCrypto.ts` | BabyJubJub key generation, scrypt keystore encryption |
| `poseidon.ts` | Poseidon hash (note hashing, address derivation) |
| `ecdhCrypto.ts` | ECDH shared secret (BabyJubJub) + AES-256-GCM |
| `circuitInputs.ts` | Circuit input preparation for all 6 circuits |
| `circuitLoader.ts` | IndexedDB-cached circuit wasm/zkey loading |
| `proofGenerator.ts` | Web Worker-based proof generation service |

### Web Worker Proof Generation (`src/workers/`)

ZK proofs are generated in a Web Worker to avoid blocking the main thread:

```typescript
import { ProofGeneratorService } from '@/lib/proofGenerator'

const prover = new ProofGeneratorService()
await prover.preloadCircuit('mint_burn_note')
const result = await prover.generateProof('mint_burn_note', inputs)
```

### ECDH Note Encryption (`src/utils/noteEncryption.ts`)

Note data is encrypted with the recipient's BabyJubJub public key before on-chain storage:

```
On-chain format: 0x01 || epk_x(32B) || epk_y(32B) || nonce(12B) || ciphertext || authTag(16B)
```

Backward compatible: detects `0x01` prefix for ECDH, otherwise decodes legacy plaintext RLP.

### Note Transfer Tree Visualization (`src/composables/useNoteTreeLayout.ts`)

D3.js-based hierarchical SVG layout for visualizing note transfer chains. Uses `d3-hierarchy` for tree computation and custom SVG rendering.

### Unit Test Infrastructure

| Tool | Description |
|------|-------------|
| Vitest | Test runner (16 test files, 308+ tests) |
| `src/test-utils/fixtures.ts` | Cryptographically valid test fixtures (BabyJubJub keys, Poseidon hashes) |

Test files cover: stores (account, note, order, web3, contract), lib (accountCrypto, poseidon, ecdhCrypto, circuitInputs, noteEncryption, keystoreStorage, circuitLoader, proofGenerator), composables (useNoteTreeLayout, useFormatters), and API layer.

### New Type Definitions (`src/types/`)

| Type | Description |
|------|-------------|
| `note.ts` | Note, NoteState, TokenType interfaces |
| `order.ts` | Order, OrderHistory, OrderState interfaces |
| `noteTree.ts` | NoteTreeNode, CreatorGroup for tree visualization |
| `circuit.ts` | CircuitName, CircuitInput types |

### PK-Based Note Hash Architecture

The note hash system has been migrated from address-based ownership to BabyJubJub public key (pk) based ownership.

#### NoteData Interface

**Before (address-based):**
```typescript
interface NoteData {
  ownerAddress: string    // Ethereum address
  value: string | bigint
  token: string | bigint
  viewingKey: string
  salt: string | bigint
}
```

**After (pk-based):**
```typescript
// src/lib/circuitInputs.ts
export interface NoteData {
  pkX: string             // BabyJubJub public key X coordinate
  pkY: string             // BabyJubJub public key Y coordinate
  value: string | bigint
  token: string | bigint
  salt: string | bigint
  noteHash?: string
}

// For DEX smart notes
export interface SmartNoteData {
  parentHash: string      // Parent note hash (split into owner0/owner1)
  value: string | bigint
  token: string | bigint
  salt: string | bigint
  noteHash?: string
}
```

#### Note Store Interface

```typescript
// src/stores/note.ts
export interface Note {
  hash: string
  owner: string           // Account address (for display/lookup only)
  pkX: string             // BabyJubJub public key X coordinate
  pkY: string             // BabyJubJub public key Y coordinate
  value: string
  token: string           // '0x0' = ETH, '0x1' = DAI
  state: string           // '0x0' = INVALID, '0x1' = VALID, '0x2' = TRADING, '0x3' = SPENT
  isSmart: string         // '0x0' = false, '0x1' = true
  salt?: string
  secretKey?: string      // For proving ownership in transfers
  createdAt?: number
  createdInTx?: string
  createdBy?: string
  spentInTx?: string
}
```

#### 7-Input Poseidon Note Hash

Note hashes are now computed using Poseidon with 7 inputs:

```typescript
// Regular notes:
// hash = Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)
// where owner0 = pkX, owner1 = pkY, vk0 = pkX, vk1 = pkY

import { computeCircuitHash } from '@/lib/circuitInputs'

const noteHash = await computeCircuitHash({
  pkX: '0x...',
  pkY: '0x...',
  value: '1000000000000000000',
  token: '0x0',
  salt: '0x...'
})

// Smart notes (DEX orders):
// owner0 = parentHash >> 128, owner1 = parentHash & MASK_128
// vk0 = owner0, vk1 = owner1

import { computeSmartNoteHash } from '@/lib/circuitInputs'

const smartHash = await computeSmartNoteHash({
  parentHash: '0x...',
  value: '500000000000000000',
  token: '0x1',
  salt: '0x...'
})
```

#### Ownership Verification

**Before (address-based):**
```typescript
function isOwner(note: NoteData, userAddress: string): boolean {
  return note.ownerAddress.toLowerCase() === userAddress.toLowerCase()
}
```

**After (pk-based):**
```typescript
// src/utils/noteEncryption.ts
export async function isNoteOwner(
  noteData: EncodedNoteData,
  accountPublicKey: { x: string; y: string }
): Promise<boolean> {
  const notePkX = BigInt(noteData.pkX)
  const notePkY = BigInt(noteData.pkY)
  const accountPkX = BigInt(accountPublicKey.x)
  const accountPkY = BigInt(accountPublicKey.y)
  return notePkX === accountPkX && notePkY === accountPkY
}
```

#### Encrypted Note Data Format

On-chain note data is ECDH-encrypted with the recipient's BabyJubJub public key:

```typescript
// src/utils/noteEncryption.ts
export interface EncodedNoteData {
  pkX: string    // BabyJubJub public key X coordinate
  pkY: string    // BabyJubJub public key Y coordinate
  value: string
  token: string
  salt: string
}

// RLP encoding: 5 fields [pkX, pkY, value, token, salt]
// On-chain format: 0x01 || epk_x(32B) || epk_y(32B) || nonce(12B) || ciphertext || authTag(16B)

// Encode for on-chain storage
const encryptedData = await encodeNoteData(noteData, recipientPk)

// Decode from on-chain (requires secret key for ECDH decryption)
const decodedNote = await decodeNoteData(encryptedHex, secretKey)
```

**Legacy format support**: The system detects `0x01` prefix for ECDH encryption. Legacy 6-field RLP format `[owner0, owner1, value, token, viewingKey, salt]` is automatically converted to the new format.

## Known Issues and Notes

1. **Chunk Size Warning**: The production build shows a warning about chunk size (>500 kB). Consider implementing code splitting for production optimization.

2. **Sass Deprecation Warning**: The legacy JS API warning from Sass can be resolved by updating to `sass-embedded` or configuring Vite's sass options.

3. **Backend Server**: The Express backend (`app.js` and `router/` directory) was not modified and continues to work as before.

## Testing Checklist

- [x] MetaMask connection
- [x] Account import/export/delete
- [x] Note minting and liquidation
- [x] Note transfer
- [x] Note combining
- [x] Order creation (make order)
- [x] Order taking (take order)
- [x] Order settlement
- [x] Order history display

## Dependencies

### Production Dependencies
```json
{
  "@oruga-ui/oruga-next": "^0.8.12",
  "@oruga-ui/theme-bulma": "^0.3.0",
  "axios": "^1.6.7",
  "bulma": "^0.9.4",
  "ethers": "^6.11.1",
  "pinia": "^2.1.7",
  "vue": "^3.4.21",
  "vue-router": "^4.3.0"
}
```

### Development Dependencies
```json
{
  "@vitejs/plugin-vue": "^5.0.4",
  "sass": "^1.71.1",
  "typescript": "^5.4.2",
  "vite": "^5.1.5",
  "vue-tsc": "^2.0.6"
}
```
