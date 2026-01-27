# ZK-DEX

Zero-Knowledge Decentralized Exchange - Private trading on Ethereum using ZK-SNARKs.

## Overview

ZK-DEX enables private token trading through:
- **Private Notes**: ETH/DAI balances hidden via Poseidon hash + Groth16 proofs
- **Private Orders**: Order details only revealed during settlement
- **On-chain Verification**: Groth16 proof verification on Ethereum
- **Client-side Proving**: Browser-based ZK proof generation via Web Workers

## Architecture

```
circuits-circom/     # Circom 2.1 ZK circuits (Poseidon-based)
contracts/           # Solidity smart contracts (0.8.20)
scripts/lib/         # Node.js proof generation utilities
test/                # Integration, production & edge case tests
examples/            # Frontend usage examples
vapp/                # Vue 3 frontend application
  ├── src/components/  # Vue components (NoteTree SVG, forms, etc.)
  ├── src/composables/ # Reusable logic (D3 layout, formatters)
  ├── src/lib/         # Client-side crypto (circuit loader, proof gen, Poseidon)
  ├── src/stores/      # Pinia state management
  ├── src/types/       # TypeScript type definitions
  ├── src/workers/     # Web Worker for proof generation
  └── public/circuits/ # Compiled wasm/zkey files
```

## Quick Start

### Prerequisites

- Node.js 18+
- Docker (optional, for containerized testing)

### Installation

```bash
# Install dependencies
npm install

# Install circuit dependencies
cd circuits-circom && npm install && cd ..

# Install frontend dependencies
cd vapp && npm install && cd ..
```

### Running Tests

#### Local Testing

```bash
# Start Ganache in another terminal
npx ganache --port 8545 --accounts 10 --defaultBalanceEther 1000

# Run all tests
npx truffle test

# Run production tests (real ZK proof verification)
npx truffle test test/ZkDex.production.test.js
```

#### Docker Testing

```bash
# Build and run all tests
docker compose run zkdex

# Run frontend integration tests only
docker compose --profile test run test-frontend

# Run production tests only
docker compose --profile test run test-production

# Cleanup
docker compose down -v
```

## Docker Environment

### Available Services

| Service | Description | Port | Command |
|---------|-------------|------|---------|
| `ganache` | Local Ethereum blockchain | 8545 | `docker compose up ganache -d` |
| `vapp-api` | Backend API server (Express) | 3000 | `docker compose up vapp-api -d` |
| `zkdex` | Main test runner | - | `docker compose run zkdex` |
| `vapp` | Frontend (Production/nginx) | 8080 | `docker compose up vapp -d` |
| `vapp-dev` | Frontend (Development/hot reload) | 8081 | `docker compose --profile dev up vapp-dev -d` |
| `zkdex-dev` | Development shell | - | `docker compose --profile dev run zkdex-dev` |
| `test-frontend` | Frontend integration tests | - | `docker compose --profile test run test-frontend` |
| `test-production` | Production tests | - | `docker compose --profile test run test-production` |

### Quick Start with Docker

```bash
# Start full stack (ganache + backend API + frontend production)
docker compose up ganache vapp-api vapp -d

# Access frontend at http://localhost:8080
# Backend API at http://localhost:3000

# Start full stack (development mode with hot reload)
docker compose --profile dev up ganache vapp-api vapp-dev -d

# Access frontend at http://localhost:8081

# Run all tests in Docker
docker compose run zkdex

# Interactive development shell
docker compose --profile dev run zkdex-dev
```

### Docker Files

| File | Description |
|------|-------------|
| `Dockerfile` | Main ZK-DEX build (circuits, contracts, tests) |
| `vapp/Dockerfile` | Frontend multi-stage build (dev/prod) |
| `docker-compose.yml` | Service orchestration |
| `.dockerignore` | Excludes large files (ptau, intermediate zkeys) |
| `vapp/.dockerignore` | Frontend build exclusions |

## Circuits

Six Circom circuits handle all ZK-DEX operations:

| Circuit | Purpose | Constraints |
|---------|---------|-------------|
| `mint_burn_note` | Deposit/withdraw ETH or DAI | 131K |
| `transfer_note` | Private transfers | 516K |
| `make_order` | Create trade orders | 131K |
| `take_order` | Accept orders | 258K |
| `settle_order` | Execute trades | 641K |
| `convert_note` | Convert smart notes | 385K |

### Building Circuits

```bash
cd circuits-circom

# Compile all circuits
npm run compile

# Run trusted setup (requires Powers of Tau)
npm run setup

# Generate Solidity verifiers
npm run generate-verifiers
```

## Usage Example

```javascript
const noteProofHelper = require('./scripts/lib/noteProofHelper');

// Initialize (loads Poseidon, BabyJubJub)
await noteProofHelper.init();

// Generate keypair (BabyJubJub curve)
const { sk, pk } = await noteProofHelper.generateKeypair();

// Create ETH note (internally: sk → pk → Poseidon address, auto-generates viewingKey & salt)
const { note } = await noteProofHelper.createNote(
    sk,
    BigInt('1000000000000000000'), // 1 ETH
    0  // ETH token type
);

// Generate mint proof (Groth16)
const proof = await noteProofHelper.generateMintProof(note, sk);

// Call contract
await zkDex.mint(proof.a, proof.b, proof.c, proof.input, encryptedNote, { value: '1000000000000000000' });
```

## Frontend (vapp)

The `vapp` directory contains a Vue 3 frontend application for interacting with ZK-DEX.

### Technology Stack

| Component | Version | Description |
|-----------|---------|-------------|
| Vue | 3.4.21 | Reactive UI framework |
| Pinia | 2.1.7 | State management |
| Oruga UI + Bulma | 0.8.12 | UI components & CSS |
| Vite | 5.1.5 | Build tool |
| TypeScript | 5.4.2 | Type safety |
| ethers.js | 6.11.1 | Ethereum interaction |
| snarkjs | 0.7.6 | Client-side Groth16 proving |
| circomlibjs | 0.1.7 | Poseidon hash, BabyJubJub |
| d3-hierarchy | 3.1.2 | Note tree SVG layout |

### Installation

```bash
cd vapp
npm install
```

### Development

```bash
# Start Vite development server (http://localhost:8080)
npm run dev

# Type checking
npm run type-check
```

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Backend Server

The Express backend serves the API for account and note management:

```bash
# Start Express backend server
npm run server
```

### Features

- MetaMask wallet connection
- Account creation with scrypt-based keystore encryption
- Account import/export/delete
- Note minting and liquidation (ETH/DAI)
- Private note transfers with client-side proof generation (Web Worker)
- Note combining (merge multiple notes)
- Order creation, taking, and settlement
- Order history tracking
- Note Transfer Tree visualization (D3.js SVG)
- ZK privacy masking toggle

For detailed migration information, see [migration_vapp.md](migration_vapp.md) or [migration_vapp_ko.md](migration_vapp_ko.md).

## Testing

### Test Suites

| Test File | Description |
|-----------|-------------|
| `test/integration-test.js` | Node.js circuit integration tests |
| `test/frontend-integration.test.js` | Frontend API tests |
| `test/boundary-edge-cases.test.js` | Boundary value and edge case tests |
| `test/ZkDex.production.test.js` | On-chain proof verification (Truffle) |
| `test/ZkDex.groth16.test.js` | Groth16 proof generation & verification |
| `test/proof-generation-test.js` | Proof generation correctness tests |
| `test/verify-sk-field-reduction.js` | Secret key field reduction verification |

### Test Results

- **21/21** Node.js integration tests passing
- **20/20** Frontend integration tests passing
- **33/33** Boundary and edge case tests passing
- **19/19** Truffle tests passing (including E2E trading flow)

## Technical Details

### Proof System

- **Circuit Language**: Circom 2.1.0
- **Proof System**: Groth16
- **Curve**: BN128
- **Hash Function**: Poseidon (note hashing, address derivation)
- **Key Scheme**: BabyJubJub (EdDSA-compatible)
- **Ownership**: Address-based (160-bit, derived from Poseidon(pk.x, pk.y))

### Solidity Contracts

- **Version**: 0.8.20
- **EVM**: Paris
- **Verifiers**: snarkjs-generated Groth16 verifiers

### Client-side Proof Generation

ZK proofs are generated entirely in the browser:
1. Circuit wasm/zkey files loaded from `public/circuits/` via manifest
2. `snarkjs.groth16.fullProve()` runs in a Web Worker (non-blocking)
3. Proof calldata formatted for on-chain verification

### Migration History

- **ZoKrates → Circom/snarkjs**: See [migration.md](migration.md)
- **SHA256 → Poseidon hash**: See [migration.md](migration.md)
- **Public key ownership → Address-based ownership**: 160-bit address derived from BabyJubJub public key

## FAQ

### Viewing Key와 Salt는 무엇인가?

노트 해시는 6개 필드의 Poseidon 해시로 계산됩니다:

```
noteHash = Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)
```

**Viewing Key** (`viewingKey`):
- BabyJubJub 공개키로부터 생성: `viewingKey = Poseidon(pk.x, pk.y)` (254-bit)
- 소유자 주소는 viewing key의 하위 160비트: `ownerAddress = truncate160(viewingKey)`
- 노트 해시에는 128비트씩 분할되어 `vk0`, `vk1`로 입력됨
- 역할: 공개키를 직접 노출하지 않으면서 노트의 소유권을 공개키에 연결
- Smart Note의 경우: `viewingKey = parentNoteHash` (부모 노트의 해시)

**Salt**:
- `crypto.randomBytes(32)`로 생성된 랜덤 값, 254비트로 마스킹 (BN128 필드 호환)
- 역할: Pre-image 공격 방지. 동일한 owner/value/token 조합이라도 salt가 다르면 해시가 달라짐
- salt 없이는 "같은 사람이 같은 금액을 두 번 입금했다"는 정보가 해시 충돌로 노출됨

### 노트 데이터는 어떻게 보호되는가?

프라이버시는 **서킷 레벨**과 **온체인 저장 레벨** 두 계층에서 결정됩니다.

**서킷 레벨: 연산별로 다른 공개 범위**

각 서킷의 public input에 포함된 정보만 외부에 공개됩니다:

| 서킷 | Public inputs | 금액 | 소유자 |
|------|--------------|------|--------|
| `mint_burn_note` | noteHash, value, tokenType | **공개** (필수: `msg.value` 검증) | 비공개 |
| `transfer_note` | o0Hash, o1Hash, newHash, changeHash | **비공개** | **비공개** |
| `make_order` | noteHash, tokenType | 비공개 | 비공개 |
| `take_order` | hashes, newOwnerAddress, types | 비공개 | 일부 공개 |
| `settle_order` | hashes, ownerAddresses, types, price | 비공개 (price만) | 일부 공개 |
| `convert_note` | smartHash, originHash, newHash | **비공개** | **비공개** |

- **입출금 경계** (mint/liquidate): 금액이 반드시 공개됩니다. ETH가 시스템에 들어오고 나갈 때 컨트랙트가 `msg.value`와 노트 금액의 일치를 검증해야 하기 때문입니다.
- **내부 전송** (transfer, convert): 해시만 공개되고 금액과 소유자는 비공개입니다. 값 보존(입력 합 = 출력 합)은 서킷 내부에서 검증됩니다.

**온체인 저장 레벨: 현재 구현의 한계**

서킷이 금액을 비공개로 처리하더라도, `encryptedNotes` 매핑이 모든 필드를 평문으로 저장하여 프라이버시를 무효화합니다:

```solidity
// ZkDaiBase.sol
mapping(bytes32 => bytes) public encryptedNotes;  // noteHash → RLP 데이터 (암호화 아님)
```

이 매핑은 이름과 달리 RLP 인코딩(가역적 직렬화)만 사용하며, `public` 매핑이므로 누구나 읽을 수 있습니다:

```
1. NoteStateChange 이벤트 전체 스캔 → 모든 noteHash 수집
2. encryptedNotes(noteHash) 호출 → RLP 데이터 획득
3. RLP 디코딩 → { ownerAddress, value, token, viewingKey, salt } 전부 노출
```

**요약: 현재 시스템의 프라이버시 보장 범위**

| 계층 | 보호 여부 | 설명 |
|------|----------|------|
| 서킷 (ZK 증명) | **부분 보호** | transfer/convert에서 금액·소유자 비공개, mint에서 금액 공개 |
| 온체인 저장 | **보호 안 됨** | `encryptedNotes`가 평문 RLP → 모든 필드 누구나 조회 가능 |
| 소유권 (노트 사용) | **보호됨** | secret key + ZK 증명 없이는 전송/소비 불가능 |

서킷 설계는 내부 전송의 프라이버시를 보호하지만, 온체인 저장이 이를 무효화합니다. `encryptedNotes`에 실제 암호화를 적용하면 서킷의 프라이버시 설계가 의미를 갖게 됩니다. 이에 대한 개선 방향은 [Future Improvements #1](#1-온체인-노트-데이터-암호화)을 참조하세요.

### 특정 노트만 특정인에게 공개할 수 있는가?

**현재 구현에서는 불가능합니다.** 온체인 데이터가 암호화되지 않았으므로 모든 노트가 이미 공개 상태입니다.

선택적 공개를 구현하려면 먼저 온체인 노트 데이터를 실제 암호화해야 하며, 이후 3가지 수준의 접근법이 가능합니다:

**1. 노트 단위 공개** (추가 서킷 불필요):
   - 특정 노트의 프리이미지 `{ownerAddress, value, tokenType, viewingKey, salt}`를 직접 전달
   - 수신자가 Poseidon 해시를 재계산하여 온체인 노트 해시와 일치 확인
   - 단점: 해당 노트의 모든 필드가 노출됨

**2. 계정 단위 공개** (Zcash viewing key 방식):
   - viewing key를 특정인에게 공유 → 해당 계정의 모든 노트 스캔 가능
   - 단점: 전부 아니면 전무 — 특정 노트만 골라서 공개 불가

**3. ZK 증명 기반 선택적 공개** (가장 강력):
   - 별도 서킷으로 "내가 소유한 노트가 조건 X를 만족한다"는 것만 증명
   - 예: "100 ETH 이상의 유효한 노트를 보유하고 있다"
   - 노트의 구체적 내용(해시, salt 등)은 비공개
   - 단점: 별도 서킷 개발 및 trusted setup 필요

### ZK 증명 기반 선택적 공개의 proving cost는?

서킷 비용의 98%는 BabyJubJub 스칼라 곱(`EscalarMulFix`)에서 발생하며, 이는 소유권 증명 1회당 ~128K constraints의 고정 비용입니다.

`mint_burn_note` 서킷 (131K constraints)의 비용 분해:

| 컴포넌트 | 연산 | Constraints | 비율 |
|----------|------|-------------|------|
| `EscalarMulFix(254)` | sk × G (BabyJubJub 스칼라 곱) | ~128K | 97.7% |
| `Poseidon(6)` | 노트 해시 | ~1,500 | 1.1% |
| `Poseidon(2)` + truncation | pk → address | ~350 | 0.3% |
| `Num2Bits(254)` + 기타 | bit 분해, 등호 비교 | ~300 | 0.2% |

선택적 공개 서킷의 비용은 "무엇을 증명하느냐"에 따라 달라집니다:

| 시나리오 | 필요 연산 | Constraints | 브라우저 proving time |
|----------|----------|-------------|---------------------|
| 프리이미지만 검증 (소유권 증명 없음) | Poseidon(6) + 값 비교 | ~2K | < 1초 |
| 소유권 + 속성 증명 (1개 노트) | EscalarMulFix + Poseidon 해시 + 비교 | ~131K | 3~10초 |
| N개 노트 잔액 합산 증명 | N × (EscalarMulFix + Poseidon) | ~N × 131K | N × 3~10초 |

소유권 증명이 필요한 경우, 비용은 증명에 포함하는 **노트 수에 선형 비례**합니다. 선택적 공개 로직 자체(해시 검증 + 값 비교 ~2K)는 무시할 수준이며, BabyJubJub 스칼라 곱 횟수가 비용을 결정합니다.

## Future Improvements

### 1. 온체인 노트 데이터 암호화

현재 `encryptedNotes` 매핑은 RLP 인코딩만 사용하며 실제 암호화가 적용되지 않습니다. 블록체인 상의 모든 노트 데이터(금액, 토큰 타입, 소유자, viewing key, salt)가 누구에게나 공개되어 있습니다.

**개선 방향**: 노트 데이터를 소유자의 공개키로 ECIES 등 비대칭 암호화하여 저장하면, 소유자만 복호화 가능하고 제3자는 노트 내용을 볼 수 없게 됩니다. 이는 아래 선택적 공개 기능의 선행 조건입니다.

### 2. ZK 증명 기반 선택적 공개

온체인 데이터 암호화가 적용된 후, 별도의 Circom 서킷을 추가하여 특정 속성만 선택적으로 공개할 수 있습니다:

- **잔액 증명**: "내가 소유한 노트의 가치가 X 이상이다"
- **소유 증명**: "특정 해시의 노트를 내가 소유하고 있다"
- **토큰 타입 증명**: "내가 보유한 노트가 ETH/DAI이다"

노트 내용(해시, salt, 구체적 금액 등)을 노출하지 않고 조건만 증명하므로, 규제 준수(자금 증명)와 프라이버시를 동시에 달성할 수 있습니다.

### 3. 서버 사이드 Proving

현재 모든 ZK 증명이 브라우저(WASM)에서 생성됩니다. 복잡한 서킷(settle_order 641K constraints)의 경우 브라우저에서 수십 초 이상 소요될 수 있습니다.

**개선 방향**: 네이티브 환경에서 rapidsnark 등을 활용한 서버 사이드 proving을 도입하면 10~100배 속도 개선이 가능합니다. 사용자의 private input은 클라이언트에서 암호화하여 전송하고, 서버는 증명만 생성하여 반환하는 구조가 필요합니다.

### 4. 증분 증명 (Incremental Proving)

다중 노트에 대한 집계 증명(예: 5개 노트의 잔액 합산)은 현재 모든 노트를 하나의 서킷에서 동시에 증명해야 합니다. 노트 수에 선형 비례하여 비용이 증가합니다(N × ~131K constraints).

**개선 방향**: 개별 노트의 증명을 미리 생성해두고, 이를 집계하는 경량 서킷(recursive proof aggregation)으로 최종 증명을 구성하면, 사용자가 체감하는 대기 시간을 크게 줄일 수 있습니다. Groth16은 재귀 합성이 어려우므로 PLONK 또는 Nova 등의 proof system 전환이 필요합니다.

## Documents

- [Architecture (EN)](ARCHITECTURE.md) / [Architecture (KO)](ARCHITECTURE_ko.md)
- [Circuit Migration (EN)](migration.md) / [Circuit Migration (KO)](migration_ko.md)
- [Frontend Migration (EN)](migration_vapp.md) / [Frontend Migration (KO)](migration_vapp_ko.md)
- [Architecture Presentation](https://docs.google.com/presentation/d/1b6yD4iV-vS_KyK27CG9ImMRdTypm9mtIbd5m3a_MNeU/edit?usp=sharing)
- [Demo Video](https://youtu.be/QvKaqMH_5lk)

## License

MIT
