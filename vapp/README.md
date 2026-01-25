# vapp

ZK-DEX Frontend Application (Vue 3 + TypeScript + Vite)

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Run Backend Server
```bash
npm run server
```
Backend runs on http://localhost:3000

### 3. Run Frontend (in another terminal)
```bash
npm run dev
```
Frontend runs on http://localhost:5173

## Docker (Full Stack)

Run the entire stack with Docker Compose (from project root):

```bash
# Run tests with Ganache
docker-compose up

# Run development shell
docker-compose --profile dev up zkdex-dev

# Run production tests
docker-compose --profile test up test-production
```

### Docker Services
- **ganache**: Local Ethereum blockchain (port 8545)
- **zkdex**: Test runner
- **zkdex-dev**: Development shell with source mounted
- **test-frontend**: Frontend integration tests
- **test-production**: Production tests

## Other Commands

### Production build
```bash
npm run build
```

### Type check
```bash
npm run type-check
```

### Preview production build
```bash
npm run preview
```

## Changelog

### 2026-01-25: Vue 3 Migration & UI Improvements

#### Vue 3 Migration
- Vue 2 → Vue 3 with Composition API (`<script setup>`)
- Vuex → Pinia for state management
- Vue Router 3 → Vue Router 4
- Buefy → Oruga UI
- Vue CLI → Vite
- node-sass → sass
- Added TypeScript support

#### Store Changes (Pinia)
- `useAccountStore` - Account management
- `useNoteStore` - Note management with blockchain scanning
- `useOrderStore` - Order management
- `useContractStore` - Contract instances
- `useWeb3Store` - Web3/ethers connection

#### Note Loading Improvement
- Changed from localStorage API to blockchain event scanning
- Added `scanBlockchainNotes()` for querying on-chain note states
- Fixed contract initialization timing with `watch` pattern

#### UI/UX Improvements
- ZK addresses display with `zk0x` prefix (e.g., `zk0x1234...5678`)
- Account list shows full ZK addresses
- Note list table column alignment fixed
- NoteLiquidate: unlock UI only for VALID notes (not SPENT)
- AccountExport: verify button with loading state
- Dashboard menu left padding added
- NoteBalanceList: added Refresh button for blockchain scan

#### Pages Tested
- **Summary** (`/`) - DashboardSummaryPage
- **Wallets**
  - Transfer (`/transfer`) - NoteTransferPage

#### Pages Migrated (Not Yet Tested)
- **Accounts**
  - Import (`/accounts/import`)
  - Export (`/accounts/export`)
  - Delete (`/accounts/delete`)
- **Wallets**
  - My Wallet (`/wallet`)
  - Combine (`/combine`)
  - Convert (`/convert`)
- **History**
  - Note Transfer (`/notes/transfer`)
  - Order (`/orders`)
- **Exchange**
  - Exchange (`/exchange`)
