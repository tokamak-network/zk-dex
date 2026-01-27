# ZK-DEX

영지식 증명 기반 탈중앙화 거래소 - ZK-SNARK를 활용한 이더리움 프라이빗 거래.

## 개요

ZK-DEX는 다음을 통해 프라이빗 토큰 거래를 구현합니다:
- **프라이빗 노트**: Poseidon 해시 + Groth16 증명으로 ETH/DAI 잔액 은닉
- **프라이빗 주문**: 체결 시에만 주문 세부사항 공개
- **온체인 검증**: 이더리움에서 Groth16 증명 검증
- **클라이언트 측 증명 생성**: Web Worker를 통한 브라우저 기반 ZK 증명 생성

## 아키텍처

```
circuits-circom/     # Circom 2.1 ZK 회로 (Poseidon 기반)
contracts/           # Solidity 스마트 컨트랙트 (0.8.20)
scripts/lib/         # Node.js 증명 생성 유틸리티
test/                # 통합, 프로덕션 & 엣지 케이스 테스트
examples/            # 프론트엔드 사용 예제
vapp/                # Vue 3 프론트엔드 애플리케이션
  ├── src/components/  # Vue 컴포넌트 (NoteTree SVG, 폼 등)
  ├── src/composables/ # 재사용 로직 (D3 레이아웃, 포맷터)
  ├── src/lib/         # 클라이언트 암호화 (회로 로더, 증명 생성, Poseidon)
  ├── src/stores/      # Pinia 상태 관리
  ├── src/types/       # TypeScript 타입 정의
  ├── src/workers/     # 증명 생성용 Web Worker
  └── public/circuits/ # 컴파일된 wasm/zkey 파일
```

## 빠른 시작

### 사전 요구사항

- Node.js 18+
- Docker (선택, 컨테이너화된 테스트용)

### 설치

```bash
# 의존성 설치
npm install

# 회로 의존성 설치
cd circuits-circom && npm install && cd ..

# 프론트엔드 의존성 설치
cd vapp && npm install && cd ..
```

### 테스트 실행

#### 로컬 테스트

```bash
# 다른 터미널에서 Ganache 시작
npx ganache --port 8545 --accounts 10 --defaultBalanceEther 1000

# 전체 테스트 실행
npx truffle test

# 프로덕션 테스트 실행 (실제 ZK 증명 검증)
npx truffle test test/ZkDex.production.test.js
```

#### Docker 테스트

```bash
# 빌드 및 전체 테스트 실행
docker compose run zkdex

# 프론트엔드 통합 테스트만 실행
docker compose --profile test run test-frontend

# 프로덕션 테스트만 실행
docker compose --profile test run test-production

# 정리
docker compose down -v
```

## Docker 환경

### 사용 가능한 서비스

| 서비스 | 설명 | 포트 | 명령어 |
|--------|------|------|--------|
| `ganache` | 로컬 이더리움 블록체인 | 8545 | `docker compose up ganache -d` |
| `vapp-api` | 백엔드 API 서버 (Express) | 3000 | `docker compose up vapp-api -d` |
| `zkdex` | 메인 테스트 러너 | - | `docker compose run zkdex` |
| `vapp` | 프론트엔드 (프로덕션/nginx) | 8080 | `docker compose up vapp -d` |
| `vapp-dev` | 프론트엔드 (개발/핫 리로드) | 8081 | `docker compose --profile dev up vapp-dev -d` |
| `zkdex-dev` | 개발 셸 | - | `docker compose --profile dev run zkdex-dev` |
| `test-frontend` | 프론트엔드 통합 테스트 | - | `docker compose --profile test run test-frontend` |
| `test-production` | 프로덕션 테스트 | - | `docker compose --profile test run test-production` |

### Docker 빠른 시작

```bash
# 전체 스택 시작 (ganache + 백엔드 API + 프론트엔드 프로덕션)
docker compose up ganache vapp-api vapp -d

# 프론트엔드 접속: http://localhost:8080
# 백엔드 API 접속: http://localhost:3000

# 전체 스택 시작 (핫 리로드 개발 모드)
docker compose --profile dev up ganache vapp-api vapp-dev -d

# 프론트엔드 접속: http://localhost:8081

# Docker에서 전체 테스트 실행
docker compose run zkdex

# 인터랙티브 개발 셸
docker compose --profile dev run zkdex-dev
```

### Docker 파일

| 파일 | 설명 |
|------|------|
| `Dockerfile` | 메인 ZK-DEX 빌드 (회로, 컨트랙트, 테스트) |
| `vapp/Dockerfile` | 프론트엔드 멀티스테이지 빌드 (개발/프로덕션) |
| `docker-compose.yml` | 서비스 오케스트레이션 |
| `.dockerignore` | 대용량 파일 제외 (ptau, 중간 zkey) |
| `vapp/.dockerignore` | 프론트엔드 빌드 제외 항목 |

## 회로

6개의 Circom 회로가 모든 ZK-DEX 연산을 처리합니다:

| 회로 | 목적 | 제약 조건 수 |
|------|------|-------------|
| `mint_burn_note` | ETH 또는 DAI 입금/출금 | 131K |
| `transfer_note` | 프라이빗 전송 | 516K |
| `make_order` | 거래 주문 생성 | 131K |
| `take_order` | 주문 수락 | 258K |
| `settle_order` | 거래 체결 | 641K |
| `convert_note` | 스마트 노트 변환 | 385K |

### 회로 빌드

```bash
cd circuits-circom

# 모든 회로 컴파일
npm run compile

# 신뢰 설정 실행 (Powers of Tau 필요)
npm run setup

# Solidity 검증자 생성
npm run generate-verifiers
```

## 사용 예제

```javascript
const noteProofHelper = require('./scripts/lib/noteProofHelper');

// 초기화 (Poseidon, BabyJubJub 로드)
await noteProofHelper.init();

// 키쌍 생성 (BabyJubJub 곡선)
const { sk, pk } = await noteProofHelper.generateKeypair();

// ETH 노트 생성 (내부: sk → pk → Poseidon 주소, viewingKey & salt 자동 생성)
const { note } = await noteProofHelper.createNote(
    sk,
    BigInt('1000000000000000000'), // 1 ETH
    0  // ETH 토큰 타입
);

// 입금 증명 생성 (Groth16)
const proof = await noteProofHelper.generateMintProof(note, sk);

// 컨트랙트 호출
await zkDex.mint(proof.a, proof.b, proof.c, proof.input, encryptedNote, { value: '1000000000000000000' });
```

## 프론트엔드 (vapp)

`vapp` 디렉토리에는 ZK-DEX와 상호작용하는 Vue 3 프론트엔드 애플리케이션이 포함되어 있습니다.

### 기술 스택

| 컴포넌트 | 버전 | 설명 |
|----------|------|------|
| Vue | 3.4.21 | 반응형 UI 프레임워크 |
| Pinia | 2.1.7 | 상태 관리 |
| Oruga UI + Bulma | 0.8.12 | UI 컴포넌트 & CSS |
| Vite | 5.1.5 | 빌드 도구 |
| TypeScript | 5.4.2 | 타입 안전성 |
| ethers.js | 6.11.1 | 이더리움 상호작용 |
| snarkjs | 0.7.6 | 클라이언트 측 Groth16 증명 |
| circomlibjs | 0.1.7 | Poseidon 해시, BabyJubJub |
| d3-hierarchy | 3.1.2 | 노트 트리 SVG 레이아웃 |

### 설치

```bash
cd vapp
npm install
```

### 개발

```bash
# Vite 개발 서버 시작 (http://localhost:8080)
npm run dev

# 타입 체크
npm run type-check
```

### 프로덕션 빌드

```bash
# 프로덕션 빌드
npm run build

# 프로덕션 빌드 미리보기
npm run preview
```

### 백엔드 서버

Express 백엔드는 계정 및 노트 관리를 위한 API를 제공합니다:

```bash
# Express 백엔드 서버 시작
npm run server
```

### 기능

- MetaMask 지갑 연결
- scrypt 기반 키스토어 암호화를 통한 계정 생성
- 계정 가져오기/내보내기/삭제
- 노트 생성(mint) 및 청산(liquidate) (ETH/DAI)
- 클라이언트 측 증명 생성(Web Worker)을 통한 프라이빗 노트 전송
- 노트 합치기 (다수 노트 병합)
- 주문 생성, 수락, 체결
- 주문 이력 추적
- 노트 전송 트리 시각화 (D3.js SVG)
- ZK 프라이버시 마스킹 토글

자세한 마이그레이션 정보는 [migration_vapp.md](migration_vapp.md) 또는 [migration_vapp_ko.md](migration_vapp_ko.md)를 참조하세요.

## 테스트

### 테스트 스위트

| 테스트 파일 | 설명 |
|------------|------|
| `test/integration-test.js` | Node.js 회로 통합 테스트 |
| `test/frontend-integration.test.js` | 프론트엔드 API 테스트 |
| `test/boundary-edge-cases.test.js` | 경계값 및 엣지 케이스 테스트 |
| `test/ZkDex.production.test.js` | 온체인 증명 검증 (Truffle) |
| `test/ZkDex.groth16.test.js` | Groth16 증명 생성 & 검증 |
| `test/proof-generation-test.js` | 증명 생성 정확성 테스트 |
| `test/verify-sk-field-reduction.js` | 비밀키 필드 리덕션 검증 |

### 테스트 결과

- **21/21** Node.js 통합 테스트 통과
- **20/20** 프론트엔드 통합 테스트 통과
- **33/33** 경계값 및 엣지 케이스 테스트 통과
- **19/19** Truffle 테스트 통과 (E2E 거래 플로우 포함)

## 기술 세부사항

### 증명 시스템

- **회로 언어**: Circom 2.1.0
- **증명 시스템**: Groth16
- **곡선**: BN128
- **해시 함수**: Poseidon (노트 해싱, 주소 도출)
- **키 체계**: BabyJubJub (EdDSA 호환)
- **소유권**: 주소 기반 (160비트, Poseidon(pk.x, pk.y)에서 도출)

### Solidity 컨트랙트

- **버전**: 0.8.20
- **EVM**: Paris
- **검증자**: snarkjs 생성 Groth16 검증자

### 클라이언트 측 증명 생성

ZK 증명은 전적으로 브라우저에서 생성됩니다:
1. 매니페스트를 통해 `public/circuits/`에서 회로 wasm/zkey 파일 로드
2. Web Worker에서 `snarkjs.groth16.fullProve()` 실행 (논블로킹)
3. 온체인 검증을 위한 증명 calldata 포맷팅

### 마이그레이션 이력

- **ZoKrates → Circom/snarkjs**: [migration.md](migration.md) 참조
- **SHA256 → Poseidon 해시**: [migration.md](migration.md) 참조
- **공개키 소유권 → 주소 기반 소유권**: BabyJubJub 공개키에서 도출된 160비트 주소

## FAQ

### Viewing Key와 Salt란?

노트 해시는 6개 필드의 Poseidon 해시로 계산됩니다:

```
noteHash = Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)
```

**Viewing Key** (`viewingKey`):
- BabyJubJub 공개키에서 도출: `viewingKey = Poseidon(pk.x, pk.y)` (254비트)
- 소유자 주소는 viewing key의 하위 160비트: `ownerAddress = truncate160(viewingKey)`
- 노트 해시 회로 입력을 위해 두 개의 128비트 반으로 분할 (`vk0`, `vk1`)
- 목적: 공개키를 직접 노출하지 않고 노트 소유권을 공개키에 연결
- 스마트 노트의 경우: `viewingKey = parentNoteHash` (부모 노트의 해시)

**Salt**:
- `crypto.randomBytes(32)`로 생성된 랜덤 값, 254비트로 마스킹 (BN128 필드 호환)
- 목적: 프리이미지 공격 방지. 동일한 소유자/금액/토큰 조합이라도 서로 다른 해시 생성
- salt가 없으면 동일한 금액을 동일한 사용자가 반복 입금할 때 해시 충돌로 드러남

### 노트 데이터는 어떻게 보호되나?

프라이버시는 **회로 레이어**와 **온체인 저장 레이어** 두 계층에서 결정됩니다.

**회로 레이어: 연산별 다른 가시성**

각 회로의 공개 입력(public inputs)에 포함된 정보만 외부에 공개됩니다:

| 회로 | 공개 입력 | 금액 | 소유자 |
|------|----------|------|--------|
| `mint_burn_note` | noteHash, value, tokenType | **공개** (필수: `msg.value` 검증) | 비공개 |
| `transfer_note` | o0Hash, o1Hash, newHash, changeHash | **비공개** | **비공개** |
| `make_order` | noteHash, tokenType | 비공개 | 비공개 |
| `take_order` | hashes, newOwnerAddress, types | 비공개 | 부분 공개 |
| `settle_order` | hashes, ownerAddresses, types, price | 비공개 (가격만) | 부분 공개 |
| `convert_note` | smartHash, originHash, newHash | **비공개** | **비공개** |

- **입출금 경계** (mint/liquidate): 금액은 항상 공개. ETH가 시스템에 들어오거나 나갈 때 컨트랙트가 `msg.value`와 노트 금액의 일치를 검증해야 합니다.
- **내부 전송** (transfer, convert): 해시만 공개되며 금액과 소유자는 비공개. 금액 보존(입력 합 = 출력 합)은 회로 내부에서 검증됩니다.

**온체인 저장 레이어: ECDH 암호화**

노트 데이터는 BabyJubJub 상의 ECDH 키 합의 + AES-256-GCM을 사용하여 온체인 저장 전에 암호화됩니다:

```solidity
// ZkDaiBase.sol
mapping(bytes32 => bytes) public encryptedNotes;  // noteHash → ECDH 암호화된 바이트
```

클라이언트는 컨트랙트에 제출하기 전에 수신자의 BabyJubJub 공개키로 노트 데이터를 암호화합니다:

```
온체인 형식: 0x01 || epk_x(32B) || epk_y(32B) || nonce(12B) || ciphertext || authTag(16B)
```

해당 BabyJubJub 비밀키를 보유한 노트 소유자만 복호화할 수 있습니다. 제3자는 공개 매핑에서 암호화된 바이트를 읽을 수 있지만 평문 `{ownerAddress, value, token, viewingKey, salt}`를 복구할 수 없습니다.

> **참고**: 레거시 노트(ECDH 마이그레이션 이전)는 평문 RLP로 저장되어 공개적으로 읽을 수 있습니다. 새로 생성된 노트만 ECDH 암호화를 사용합니다.

**요약: 현재 프라이버시 보장**

| 레이어 | 보호 수준 | 설명 |
|--------|----------|------|
| 회로 (ZK 증명) | **부분적** | transfer/convert에서 금액/소유자 비공개; mint에서 금액 공개 |
| 온체인 저장 | **보호됨** | ECDH 암호화 — 노트 소유자만 복호화 가능 |
| 온체인 저장 (레거시) | **보호되지 않음** | 마이그레이션 이전 노트는 평문 RLP로 저장 |
| 소유권 (노트 사용) | **보호됨** | 전송 또는 사용에 비밀키 + ZK 증명 필요 |

### 특정 노트를 특정 상대방에게 선택적으로 공개할 수 있나?

현재 ECDH 암호화된 온체인 저장과 함께 세 가지 접근 방식이 가능합니다:

**1. 노트 수준 공개** (추가 회로 불필요):
   - 노트 프리이미지 `{ownerAddress, value, tokenType, viewingKey, salt}`를 직접 공유
   - 수신자가 Poseidon 해시를 재계산하여 온체인 노트 해시와 일치하는지 검증
   - 단점: 노트의 모든 필드가 공개됨

**2. 계정 수준 공개** (Zcash viewing key 방식):
   - 특정 상대방에게 viewing key를 공유 — 해당 계정의 모든 노트를 스캔 가능
   - 단점: 전부 공개 또는 전부 비공개 — 개별 노트를 선택적으로 공개할 수 없음

**3. ZK 증명 기반 선택적 공개** (가장 강력):
   - 전용 회로가 노트를 공개하지 않고 "내 소유 노트가 조건 X를 만족한다"는 것을 증명
   - 예시: "100 ETH 이상의 유효한 노트를 보유하고 있다"
   - 특정 노트 내용(해시, salt, 정확한 금액)은 비공개 유지
   - 단점: 별도의 회로 개발과 신뢰 설정이 필요

### ZK 기반 선택적 공개의 증명 비용은?

회로 비용의 98%는 BabyJubJub 스칼라 곱(`EscalarMulFix`)에서 발생하며, 소유권 증명당 ~128K 제약 조건의 고정 비용입니다.

`mint_burn_note` 회로(131K 제약 조건) 비용 분석:

| 컴포넌트 | 연산 | 제약 조건 수 | 비율 |
|----------|------|-------------|------|
| `EscalarMulFix(254)` | sk × G (BabyJubJub 스칼라 곱) | ~128K | 97.7% |
| `Poseidon(6)` | 노트 해시 | ~1,500 | 1.1% |
| `Poseidon(2)` + 절삭 | pk → 주소 | ~350 | 0.3% |
| `Num2Bits(254)` + 기타 | 비트 분해, 동등성 검사 | ~300 | 0.2% |

선택적 공개 회로 비용은 증명 대상에 따라 다릅니다:

| 시나리오 | 필요 연산 | 제약 조건 수 | 브라우저 증명 시간 |
|----------|----------|-------------|-------------------|
| 프리이미지 검증만 (소유권 증명 없음) | Poseidon(6) + 값 비교 | ~2K | < 1초 |
| 소유권 + 속성 증명 (노트 1개) | EscalarMulFix + Poseidon 해시 + 비교 | ~131K | 3–10초 |
| N개 노트 잔액 합산 증명 | N × (EscalarMulFix + Poseidon) | ~N × 131K | N × 3–10초 |

소유권 증명이 필요한 경우 비용은 **노트 수에 비례**하여 증가합니다. 선택적 공개 로직 자체(해시 검증 + 값 비교 ~2K)는 무시할 수준이며, BabyJubJub 스칼라 곱의 수가 비용을 결정합니다.

## 향후 개선사항

### 1. ZK 증명 기반 선택적 공개

온체인 노트 데이터에 ECDH 암호화가 적용된 현재, 선택적 속성 공개를 위한 전용 Circom 회로를 추가할 수 있습니다:

- **잔액 증명**: "내가 소유한 노트의 총 가치가 X를 초과한다"
- **소유권 증명**: "특정 해시의 노트를 소유하고 있다"
- **토큰 타입 증명**: "내가 보유한 노트는 ETH/DAI이다"

이를 통해 노트 내용(해시, salt, 정확한 금액)을 노출하지 않고 조건을 증명할 수 있으며, 규제 준수(자금 증명)와 프라이버시를 동시에 달성합니다.

### 2. 서버 측 증명 생성

현재 모든 ZK 증명은 브라우저(WASM)에서 생성됩니다. 복잡한 회로(settle_order: 641K 제약 조건)는 브라우저에서 수십 초가 소요될 수 있습니다.

**개선**: 네이티브 환경에서 rapidsnark를 사용한 서버 측 증명 생성을 도입하면 10~100배 속도 향상이 가능합니다. 비공개 입력은 전송 전에 클라이언트에서 암호화하고, 서버는 증명만 생성하여 반환합니다.

### 3. 점진적 증명

다수 노트에 대한 집계 증명(예: 5개 노트의 잔액 합산)은 현재 단일 회로에서 모든 노트를 동시에 증명해야 합니다. 비용은 노트 수에 비례하여 증가합니다 (N × ~131K 제약 조건).

**개선**: 개별 노트에 대한 증명을 사전 생성한 후, 경량 재귀적 증명 합성 회로를 사용하여 최종 증명을 구성합니다. Groth16은 기본적으로 재귀적 합성을 지원하지 않으므로 PLONK 또는 Nova 증명 시스템으로의 전환이 필요합니다.

## 문서

- [아키텍처 (EN)](ARCHITECTURE.md) / [아키텍처 (KO)](ARCHITECTURE_ko.md)
- [회로 마이그레이션 (EN)](migration.md) / [회로 마이그레이션 (KO)](migration_ko.md)
- [프론트엔드 마이그레이션 (EN)](migration_vapp.md) / [프론트엔드 마이그레이션 (KO)](migration_vapp_ko.md)
- [아키텍처 프레젠테이션](https://docs.google.com/presentation/d/1b6yD4iV-vS_KyK27CG9ImMRdTypm9mtIbd5m3a_MNeU/edit?usp=sharing)
- [데모 영상](https://youtu.be/QvKaqMH_5lk)

## 라이선스

MIT
