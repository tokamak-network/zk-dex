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
# Start full stack (ganache + API + frontend production)
docker compose up ganache vapp-api vapp -d
# Frontend: http://localhost:8080
# Backend API: http://localhost:3000

# Start full stack (development mode with hot reload)
docker compose --profile dev up ganache vapp-api vapp-dev -d
# Frontend: http://localhost:8081

# Run all tests
docker compose run zkdex

# Development shell
docker compose --profile dev run zkdex-dev

# Cleanup
docker compose down -v
```

### Docker Services

| Service | Description | Port |
|---------|-------------|------|
| `ganache` | Local Ethereum blockchain | 8545 |
| `vapp-api` | Backend API server (Express) | 3000 |
| `vapp` | Frontend (Production/nginx) | 8080 |
| `vapp-dev` | Frontend (Development/hot reload) | 8081 |
| `zkdex` | Test runner | - |
| `zkdex-dev` | Development shell | - |
| `test-frontend` | Frontend integration tests | - |
| `test-production` | Production tests | - |

### Backend API (vapp-api)

Express server providing:
- Account management (create, unlock, import/export)
- ZK-SNARK proof generation (mint, transfer, order circuits)
- Note and order state management

API endpoints:
| Path | Description |
|------|-------------|
| `POST /accounts` | Create new account |
| `POST /accounts/unlock` | Unlock account |
| `POST /circuits` | Generate ZK proof |
| `GET/POST /notes` | Note management |
| `GET/POST /orders` | Order management |

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
