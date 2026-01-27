# ZK-DEX Docker Documentation

Complete guide to the Docker environment, multi-stage build architecture, service configuration, and testing infrastructure.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Dockerfile: Multi-Stage Build](#dockerfile-multi-stage-build)
4. [docker-compose.yml: Service Configuration](#docker-composeyml-service-configuration)
5. [nginx Configuration](#nginx-configuration)
6. [.dockerignore](#dockerignore)
7. [Build Process](#build-process)
8. [Testing](#testing)
9. [Running the Application](#running-the-application)
10. [Design Decisions](#design-decisions)
11. [Troubleshooting](#troubleshooting)

---

## Overview

ZK-DEX uses a unified Dockerfile with 5 named stages that serve all services — from circuit compilation and contract testing to frontend development and production deployment. Docker Compose orchestrates 9 services covering the entire development lifecycle.

### File Structure

```
Dockerfile              # Multi-stage build (circuits, contracts, tests, frontend dev/prod)
docker-compose.yml      # Service orchestration
.dockerignore           # Excluded files list
vapp/nginx.conf         # Frontend production nginx config
```

---

## Architecture

### Build Pipeline (Dockerfile Stages)

Shows how Docker build stages produce artifacts and pass them to downstream stages:

```
┌────────────────────┐
│  circom-builder     │  Rust → circom binary
│  (rust:1.75-slim)   │
└────────┬───────────┘
         │ COPY --from (circom binary)
         ▼
┌────────────────────┐
│  zkdex-base         │  Circuits + Contracts + Tests
│  (node:20-slim)     │  ├── npm install (root + circuits-circom)
│                     │  ├── Conditional circuit build
│                     │  └── npx truffle compile → build/contracts/*.json
│                     │  └── Build-time migration (temp Ganache → deterministic addresses)
└────────┬───────────┘
         │ COPY --from (contract ABIs + circuit artifacts)
         ▼
┌────────────────────┐
│  vapp-development   │  Frontend development (Vite)
│  (node:20-slim)     │  ├── npm ci --legacy-peer-deps
│                     │  ├── Contract ABIs → /build/contracts/
│                     │  └── Circuit wasm/zkey → public/circuits/
└────────┬───────────┘
         │ inherits (FROM vapp-development)
         ▼
┌────────────────────┐
│  vapp-builder       │  npm run build (TypeScript + Vite)
│  (node:20-slim)     │
└────────┬───────────┘
         │ COPY --from (dist/)
         ▼
┌────────────────────┐
│  vapp-production    │  nginx serving static files
│  (nginx:alpine)     │  ├── Built frontend → /usr/share/nginx/html
│                     │  └── nginx.conf (COOP/COEP, SPA routing)
└────────────────────┘
```

### Runtime Architecture (Container Communication)

Shows how containers communicate at runtime when the full stack is running:

```
 Host Machine
+===========================================================================+
|                                                                           |
|  Browser                                                                  |
|  :8080 --------> [vapp]          HTML/JS/CSS, circuit wasm/zkey           |
|  :3000 --------> [vapp-api]      REST API (CORS)                          |
|  :8545 --------> [ganache]       JSON-RPC (MetaMask / ethers.js)          |
|                                                                           |
|  Docker Network: zkdex-network                                            |
|  +---------------------------------------------------------------------+  |
|  |                                                                     |  |
|  |  +------------------+          +------------------+                 |  |
|  |  | ganache          |          | zkdex            |                 |  |
|  |  | Ganache v7.9.1   | <------- | Truffle tests    |                 |  |
|  |  | :8545            | JSON-RPC | (run and exit)   |                 |  |
|  |  | networkId: 5777  |          +------------------+                 |  |
|  |  | 10 accounts      |                                              |  |
|  |  | 1000 ETH each    |          +------------------+                 |  |
|  |  | deterministic    | <------- | migrate          |                 |  |
|  |  |   mnemonic       | JSON-RPC | truffle migrate  |                 |  |
|  |  |                  |          | (run and exit)   |                 |  |
|  |  |                  |          +------------------+                 |  |
|  |  |                  |                                               |  |
|  |  |                  |          +------------------+                 |  |
|  |  |                  | <------- | test-*           |                 |  |
|  |  |                  | JSON-RPC | (run and exit)   |                 |  |
|  |  +--------+---------+          +------------------+                 |  |
|  |           |                                                         |  |
|  |           | JSON-RPC (ganache:8545)                                 |  |
|  |           |                                                         |  |
|  |  +--------v---------+                                               |  |
|  |  | vapp-api         |                                               |  |
|  |  | Express (app.cjs)|                                               |  |
|  |  | :3000            |                                               |  |
|  |  | POST /accounts   |                                               |  |
|  |  | POST /notes      |                                               |  |
|  |  | POST /orders     |                                               |  |
|  |  | CORS: all origins|                                               |  |
|  |  +------------------+                                               |  |
|  |                                                                     |  |
|  |  +------------------+          +------------------+                 |  |
|  |  | vapp             |          | vapp-dev         |                 |  |
|  |  | nginx:alpine     |          | Vite dev server  |                 |  |
|  |  | :80 -> host:8080 |          | :8080 -> host    |                 |  |
|  |  |                  |          |          :8081   |                 |  |
|  |  | /html/           |          | hot reload       |                 |  |
|  |  |   index.html     |          | src/ mounted     |                 |  |
|  |  |   assets/        |          +------------------+                 |  |
|  |  |   circuits/      |                                               |  |
|  |  |     6x wasm+zkey |                                               |  |
|  |  |     (~28MB)      |                                               |  |
|  |  | Headers:         |                                               |  |
|  |  |   COOP + COEP    |                                               |  |
|  |  +------------------+                                               |  |
|  |                                                                     |  |
|  +---------------------------------------------------------------------+  |
|                                                                           |
+===========================================================================+
```

### Data Flow

**Proof generation flow** (browser-side, no server involvement):

```
Browser                         nginx (vapp)
  |                                |
  +-- GET /circuits/X/X.wasm ---->[ ]  circuit WASM
  +-- GET /circuits/X/X.zkey ---->[ ]  proving key
  |
  +-- snarkjs.groth16.fullProve()
  |   (Web Worker + SharedArrayBuffer)
  |   => { proof, publicSignals }
  |
  +-- eth_sendTransaction -----------> ganache:8545
  |   (proof.a, proof.b, proof.c,      (on-chain verification)
  |    proof.input, encryptedNote)
  |
  +-- POST /notes -------------------> vapp-api:3000
      (note metadata)                  (off-chain storage)
```

**Service dependency chain**:

```
ganache (must be healthy first)
  +-- migrate           (deploy contracts, exit)
  |   +-- vapp-api      (long-running API server)
  |   |   +-- vapp      (long-running nginx, production)
  |   |   +-- vapp-dev  (long-running Vite, development)
  +-- zkdex             (run tests, exit)
  +-- test-frontend     (run tests, exit)
  +-- test-production   (run tests, exit)
```

### Network Configuration

All containers share `zkdex-network` (bridge driver). Inter-container communication uses container names as hostnames:

| From | To | Address | Protocol | Purpose |
|------|----|---------|----------|---------|
| `migrate` | `ganache` | `ganache:8545` | JSON-RPC | Contract deployment |
| `zkdex` | `ganache` | `ganache:8545` | JSON-RPC | Contract deployment & test calls |
| `vapp-api` | `ganache` | `ganache:8545` | JSON-RPC | Blockchain queries |
| `test-*` | `ganache` | `ganache:8545` | JSON-RPC | Test transactions |
| Browser | `vapp` | `localhost:8080` | HTTP | Static files (HTML/JS/CSS/wasm/zkey) |
| Browser | `vapp-api` | `localhost:3000` | HTTP (CORS) | REST API (accounts, notes, orders) |
| Browser | `ganache` | `localhost:8545` | JSON-RPC | MetaMask / ethers.js transactions |

Key point: the browser communicates with `vapp-api` and `ganache` directly via host-mapped ports, not through nginx reverse proxy. This is because the frontend uses `VITE_API_URL || 'http://127.0.0.1:3000'` as the axios base URL, and MetaMask connects to `localhost:8545` directly.

---

## Dockerfile: Multi-Stage Build

### Stage 1: circom-builder

```dockerfile
FROM rust:1.75-slim-bookworm AS circom-builder
```

- Clones and builds the Circom 2.1.8 compiler from Rust source
- Output: `/circom/target/release/circom` binary
- Only used to produce the compiler binary; discarded in the final image

### Stage 2: zkdex-base

```dockerfile
FROM node:20-bookworm-slim AS zkdex-base
```

The core build stage used by all backend services:

1. **System dependencies**: git, python3, build-essential, curl
2. **Circom binary**: Copied from `circom-builder`
3. **npm install**: Root dependencies + `circuits-circom` dependencies (separate for layer caching)
4. **Source code**: `COPY . .` — includes pre-built circuit artifacts if available
5. **Conditional circuit build**:
   - If `.zkey` files exist (local pre-build): skip circuit compilation
   - Otherwise: compile circuits → download ptau → trusted setup → generate Solidity verifiers
6. **Contract compilation**: `npx truffle compile` generates `build/contracts/*.json` ABI files
7. **Build-time migration**: Starts a temporary Ganache inside the container, runs `npx truffle migrate --network development --reset`, then kills Ganache. This populates `build/contracts/*.json` with deterministic contract addresses (same mnemonic + fresh chain = same addresses every time). These addresses get bundled into the frontend JavaScript.
8. **Environment**: `PTAU_SIZE=20` (pot20, ~400MB; sufficient for all circuits up to ~1M constraints)

**Used by**: `zkdex`, `zkdex-dev`, `migrate`, `vapp-api`, `test-frontend`, `test-production`

### Stage 3: vapp-development

```dockerfile
FROM node:20-bookworm-slim AS vapp-development
```

Frontend development stage:

1. **npm ci --legacy-peer-deps**: Install vapp dependencies (legacy flag needed for `@pinia/testing` peer dep)
2. **Source code**: Copy `vapp/` source
3. **Contract ABIs**: `COPY --from=zkdex-base /app/build/contracts/ /build/contracts/`
   - Required because `vapp/src/stores/contract.ts` imports from `../../../build/contracts/`
4. **Circuit files**: Copy wasm/zkey for 6 circuits from `zkdex-base`:
   ```
   public/circuits/{circuit_name}/{circuit_name}.wasm
   public/circuits/{circuit_name}/{circuit_name}.zkey
   ```
   Total size: ~28MB
5. **Default command**: `npm run dev -- --host 0.0.0.0` (Vite dev server)

**Used by**: `vapp-dev`

### Stage 4: vapp-builder

```dockerfile
FROM vapp-development AS vapp-builder
```

Inherits from `vapp-development` and runs `npm run build` (TypeScript compilation + Vite production build). Output goes to `/app/dist/`.

### Stage 5: vapp-production

```dockerfile
FROM nginx:alpine AS vapp-production
```

Minimal production image:

1. **Built files**: `COPY --from=vapp-builder /app/dist /usr/share/nginx/html`
2. **nginx config**: Custom `vapp/nginx.conf`
3. **Port**: 80

**Used by**: `vapp`

---

## docker-compose.yml: Service Configuration

### Services Overview

| Service | Target Stage | Port | Profile | Description |
|---------|-------------|------|---------|-------------|
| `ganache` | (image) | 8545 | default | Ganache v7.9.1 local blockchain |
| `migrate` | `zkdex-base` | - | default | Contract deployment (init, runs once) |
| `zkdex` | `zkdex-base` | - | default | Contract test runner (Truffle) |
| `vapp-api` | `zkdex-base` | 3000 | default | Express backend API |
| `vapp` | `vapp-production` | 8080 | default | Production frontend (nginx) |
| `vapp-dev` | `vapp-development` | 8081 | dev | Development frontend (Vite hot reload) |
| `zkdex-dev` | `zkdex-base` | - | dev | Interactive development shell |
| `test-frontend` | `zkdex-base` | - | test | Frontend integration test runner |
| `test-production` | `zkdex-base` | - | test | Production (Groth16) test runner |

### Ganache Configuration

```yaml
image: trufflesuite/ganache:v7.9.1
command:
  - --networkId=5777
  - --accounts=10
  - --defaultBalanceEther=1000
  - --gasLimit=12000000
  - --mnemonic=candy maple cake sugar pudding cream honey rich smooth crumble sweet treat
```

- Deterministic mnemonic for reproducible test accounts
- Health check: HTTP probe every 5s, up to 15 retries
- All services that require blockchain access use `depends_on: ganache: condition: service_healthy`

### Network

All services share `zkdex-network` (bridge driver). Container names resolve as hostnames within the network (e.g., `ganache:8545`).

### Profiles

- **default** (no profile): `ganache`, `migrate`, `zkdex`, `vapp-api`, `vapp`
- **dev**: `vapp-dev`, `zkdex-dev`
- **test**: `test-frontend`, `test-production`

---

## nginx Configuration

`vapp/nginx.conf` configures the production frontend:

### COOP/COEP Headers

```nginx
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Embedder-Policy "require-corp" always;
```

Required for `SharedArrayBuffer`, which snarkjs Web Workers use for browser-side ZK proof generation. Without these headers, `snarkjs.groth16.fullProve()` fails in the browser.

### SPA Routing

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Vue Router history mode requires all routes to fall back to `index.html`.

### Circuit Files

```nginx
location /circuits/ {
    types {
        application/wasm wasm;
        application/octet-stream zkey;
    }
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

- WASM MIME type for circuit files
- 1-year cache (files are content-hashed and immutable)
- COOP/COEP headers applied here as well

### Gzip Compression

Enabled for `text/plain`, `text/css`, `application/json`, `application/javascript`, `text/xml`, `application/xml`, and `application/wasm`.

---

## .dockerignore

Key exclusions to reduce build context size:

| Pattern | Reason |
|---------|--------|
| `node_modules` | Rebuilt inside container |
| `circuits-circom/ptau/` | Large files (~400MB–4.5GB), downloaded during build |
| `circuits-circom/build/*_0000.zkey` | Intermediate ceremony files |
| `*.md` (except `README.md`) | Documentation not needed at build time |
| `Dockerfile`, `docker-compose.yml`, `.dockerignore` | Self-referential files |
| `circuits/` | Old ZoKrates circuits (replaced by Circom) |
| `test/debug-*.js` | Debug scripts with uninstalled dependencies |

Note: `circuits-circom/build` is **not** excluded — pre-built circuit artifacts (`.zkey`, `.wasm`) are intentionally included when available. This enables the conditional build: if artifacts exist locally, Docker skips the circuit compilation step entirely.

---

## Build Process

### First Build (No Pre-built Circuits)

```bash
docker compose build zkdex
```

1. **circom-builder** (~5 min): Clone and compile Circom from Rust
2. **zkdex-base** (~20–30 min):
   - npm install (root + circuits-circom)
   - Compile 6 Circom circuits
   - Download pot20 (~400MB) from Google Storage
   - Trusted setup (generate zkey for each circuit)
   - Generate Solidity verifiers
   - Compile Solidity contracts with Truffle

### First Build (With Pre-built Circuits)

If `circuits-circom/build/` contains pre-built `.zkey` and `.wasm` files:

```bash
docker compose build zkdex
```

1. **circom-builder** (~5 min): Same
2. **zkdex-base** (~3 min): Detects existing `.zkey` files, skips circuit compilation. Only runs `npx truffle compile`.

### Frontend Build

```bash
docker compose build vapp
```

After `zkdex-base` is built:

1. **vapp-development** (~2 min): npm ci, copy ABIs and circuit files
2. **vapp-builder** (~1 min): TypeScript + Vite production build (814 modules)
3. **vapp-production**: Copy dist to nginx (minimal image)

### Build All Services

```bash
docker compose build
```

Builds all default-profile images. Services sharing the same `target` (e.g., `zkdex` and `vapp-api` both target `zkdex-base`) share Docker layer cache.

---

## Testing

### Contract Tests

```bash
# Run all contract tests (19 tests)
docker compose run --rm zkdex
```

Tests executed: `test/ZkDex.groth16.test.js` + `test/ZkDex.production.test.js`

Covers:
- Contract deployment and initialization
- Note minting (ETH/DAI)
- Note transfers with Groth16 proofs
- Order creation, taking, and settlement (E2E trading flow)

**Result: 19/19 passing**

### Frontend Integration Tests

```bash
docker compose --profile test run --rm test-frontend
```

Runs `test/frontend-integration.test.js` — tests the frontend API layer and proof generation without a browser.

### Production Tests

```bash
docker compose --profile test run --rm test-production
```

Runs `test/ZkDex.production.test.js` with real Groth16 proof verification on Ganache.

### Cleanup

```bash
docker compose down -v
```

Removes all containers, networks, and named volumes.

---

## Running the Application

### Full Stack (Production)

```bash
# Start ganache + backend API + frontend (nginx)
docker compose up ganache vapp-api vapp -d

# Frontend: http://localhost:8080
# Backend API: http://localhost:3000
# Ganache RPC: http://localhost:8545
```

### Full Stack (Development)

```bash
# Start with Vite hot reload
docker compose --profile dev up ganache vapp-api vapp-dev -d

# Frontend: http://localhost:8081
# Backend API: http://localhost:3000
```

Development mode mounts `./vapp/src` and `./vapp/public` as volumes for live editing.

### Interactive Development Shell

```bash
docker compose --profile dev run zkdex-dev

# Inside container:
npx truffle test
npx truffle console --network docker
node test/integration-test.js
```

### Individual Services

```bash
docker compose up ganache -d          # Blockchain only
docker compose up vapp-api -d         # Backend only (requires ganache)
docker compose up vapp -d             # Frontend only (requires vapp-api)
```

---

## Design Decisions

### 1. Unified Dockerfile vs. Separate Dockerfiles

**Decision**: Single Dockerfile with named stages for all services.

**Rationale**:
- Frontend stages (`vapp-development`, `vapp-builder`, `vapp-production`) depend on artifacts from `zkdex-base` (contract ABIs, circuit files)
- `COPY --from=zkdex-base` eliminates the need for volume mounts or separate artifact copying
- All services share the same build context, enabling consistent layer caching
- One Dockerfile to maintain instead of two

### 2. pot20 vs. pot22 in Docker

**Decision**: `PTAU_SIZE=20` (pot20, ~400MB) in Docker.

**Rationale**:
- pot20 supports up to ~1M constraints, sufficient for all 6 circuits (largest: `settle_order` at 641K)
- pot22 is 4.5GB — unacceptable for Docker image size and download time
- Local development can still use pot22 via the default in `setup.sh`

### 3. Conditional Circuit Build

**Decision**: Check for existing `.zkey` files before compiling circuits.

**Rationale**:
- Circuit compilation + trusted setup is the slowest part (~20 min)
- Developers who build circuits locally can skip this step in Docker
- First-time Docker users still get a complete build from scratch

### 4. --legacy-peer-deps for Frontend

**Decision**: Use `npm ci --legacy-peer-deps` for vapp dependencies.

**Rationale**:
- `@pinia/testing@1.0.3` declares a peer dependency on `pinia@>=3.0.4`, but the project uses `pinia@2.3.1`
- This is a testing-only package with a loose peer dep mismatch — functionally compatible
- Strict npm 7+ peer dep resolution would block the entire install

### 5. COOP/COEP Headers

**Decision**: Apply `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` globally.

**Rationale**:
- `SharedArrayBuffer` is required by snarkjs for multi-threaded WASM proof generation
- Browsers require both COOP and COEP headers to enable `SharedArrayBuffer`
- Applied in nginx (production) and Vite config (development)

### 6. Direct API Calls (No Reverse Proxy)

**Decision**: Frontend calls backend directly at `http://localhost:3000`.

**Rationale**:
- The Express backend (`vapp/app.cjs`) has CORS enabled
- Frontend axios client uses `VITE_API_URL || 'http://127.0.0.1:3000'` as base URL
- No need for nginx `/api` reverse proxy — simpler architecture
- In Docker, the browser accesses backend via the host-mapped port (3000)

### 7. Deterministic Contract Addresses (Build-time Migration)

**Decision**: Run `truffle migrate` at Docker build time against a temporary Ganache to populate contract addresses in ABI JSON files.

**Rationale**:
- The frontend imports `build/contracts/ZkDex.json` at Vite build time — addresses must be present before `npm run build`
- Ganache cannot run at Docker build time as a separate container, so a temporary in-process Ganache is used
- Contract addresses are deterministic: same mnemonic + fresh chain + same deployment order = identical addresses every time
- At runtime, the `migrate` init service deploys the same contracts to the Docker Ganache, producing the same addresses that were baked into the frontend
- This avoids the need for runtime address injection or frontend code changes

### 8. Init Service for Contract Deployment (migrate)

**Decision**: Use a Docker Compose `service_completed_successfully` dependency to ensure contracts are deployed before the app starts.

**Rationale**:
- Contracts must be deployed to Ganache before the frontend or API can use them
- The `migrate` service runs `npx truffle migrate --network docker --reset` once, then exits
- `vapp-api` and `vapp` use `depends_on: migrate: condition: service_completed_successfully` to wait
- This is the standard Docker Compose pattern for init containers — cleaner than embedding migration in entrypoint scripts

---

## Troubleshooting

### Build Failures

**Circuit compilation fails with "out of memory"**:
- Increase Docker memory limit (recommended: 8GB+)
- The `settle_order` circuit (641K constraints) requires significant memory

**npm install fails with peer dependency errors**:
- Root packages: Use `npm install` (no strict mode)
- vapp packages: Use `npm ci --legacy-peer-deps`

**TypeScript compilation fails in vapp-builder**:
- Ensure contract ABIs exist at `/build/contracts/` (built by `npx truffle compile` in `zkdex-base`)
- Check that `COPY --from=zkdex-base /app/build/contracts/ /build/contracts/` is present

### Runtime Issues

**Frontend loads but proof generation fails**:
- Check COOP/COEP headers with browser DevTools (Network tab → Response Headers)
- Verify circuit files are served: `curl http://localhost:8080/circuits/mint_burn_note/mint_burn_note.wasm`
- Check browser console for `SharedArrayBuffer is not defined` errors

**Backend API returns 502/connection refused**:
- Ensure `vapp-api` container is running: `docker compose ps`
- Check logs: `docker compose logs vapp-api`
- Verify Ganache is healthy: `docker compose ps ganache`

**Tests fail with "could not connect to server"**:
- Ganache health check may not be ready yet. Increase `start_period` in `docker-compose.yml`
- Check Ganache logs: `docker compose logs ganache`
