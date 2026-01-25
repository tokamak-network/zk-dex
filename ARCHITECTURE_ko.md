# ZK-DEX 아키텍처 문서

Circom/snarkjs를 사용한 영지식 증명(ZK-SNARKs) 기반 프라이버시 보호 탈중앙화 거래소(DEX)입니다.

## 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [디렉토리 구조](#디렉토리-구조)
3. [기술 스택](#기술-스택)
4. [스마트 컨트랙트](#스마트-컨트랙트)
5. [ZK 회로](#zk-회로)
6. [스크립트 및 라이브러리](#스크립트-및-라이브러리)
7. [데이터 흐름 및 아키텍처](#데이터-흐름-및-아키텍처)
8. [핵심 개념](#핵심-개념)
9. [테스트](#테스트)
10. [Docker 환경](#docker-환경)

---

## 프로젝트 개요

ZK-DEX는 사용자가 다음을 수행할 수 있게 합니다:
- **Mint (발행)** - 토큰 잔액을 나타내는 비공개 노트 생성 (ETH/DAI)
- **Spend (소비)** - 금액을 노출하지 않고 가치 전송
- **Trade (거래)** - 프라이버시가 보호되는 주문을 통한 토큰 거래
- **Settle (정산)** - 영지식 증명을 통한 원자적 주문 정산

모든 작업은 Groth16 증명을 사용하여 온체인에서 검증되며, 개인 데이터를 노출하지 않고 거래의 유효성을 보장합니다.

---

## 디렉토리 구조

```
zk-dex/
├── circuits-circom/          # Circom 2.1 회로 정의
│   ├── main/                 # 메인 회로 파일
│   │   ├── mint_burn_note.circom
│   │   ├── transfer_note.circom
│   │   ├── convert_note.circom
│   │   ├── make_order.circom
│   │   ├── take_order.circom
│   │   └── settle_order.circom
│   ├── utils/                # 유틸리티 회로
│   │   ├── sha256/          # SHA256 구현
│   │   ├── babyjubjub/      # ECC 연산
│   │   ├── pack/            # 비트 패킹
│   │   └── math/            # 수학 연산
│   ├── build/               # 컴파일 결과물 (.wasm, .zkey, .r1cs)
│   └── scripts/             # 빌드 스크립트
│
├── contracts/                # Solidity 스마트 컨트랙트 (0.8.20)
│   ├── ZkDex.sol            # 메인 DEX 컨트랙트
│   ├── ZkDai.sol            # 노트 관리
│   ├── ZkDaiBase.sol        # 기본 컨트랙트
│   ├── MintNotes.sol        # 발행 로직
│   ├── SpendNotes.sol       # 소비 로직
│   ├── LiquidateNotes.sol   # 청산 로직
│   └── verifiers/           # Groth16 검증자 컨트랙트
│
├── scripts/lib/              # JavaScript 유틸리티
│   ├── noteProofHelper.js   # 통합 증명 생성 API
│   ├── snarkjsUtils.js      # snarkjs 래퍼 함수
│   ├── circomlibBabyJub.js  # BabyJubJub 연산
│   └── Note.js              # Note 클래스
│
├── test/                     # 테스트 스위트
├── examples/                 # 사용 예제
├── Dockerfile               # Docker 빌드 (조건부)
├── docker-compose.yml       # 컨테이너 오케스트레이션
└── truffle-config.js        # Truffle 설정
```

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| **블록체인** | Ethereum (Solidity 0.8.20) |
| **프레임워크** | Truffle 5.11, Ganache |
| **ZK 증명** | Circom 2.1.0, snarkjs 0.7.x |
| **증명 시스템** | Groth16 (BN128 곡선) |
| **암호화** | BabyJubJub (circomlibjs), SHA-256 |
| **테스트** | Mocha, Chai |

---

## 스마트 컨트랙트

### 컨트랙트 계층 구조

```
ZkDex (메인 컨트랙트)
├── ZkDai
│   ├── MintNotes
│   ├── SpendNotes
│   └── LiquidateNotes
└── ZkDaiBase
    └── Verifier Contracts (Groth16)
```

### 핵심 컨트랙트

#### ZkDex.sol (메인 DEX 컨트랙트)

프라이버시 보호 거래 작업을 관리하는 핵심 컨트랙트입니다.

**주요 함수:**
| 함수 | 설명 |
|------|------|
| `makeOrder()` | 메이커가 ZK 증명과 함께 거래 주문 생성 |
| `takeOrder()` | 테이커가 스테이크 노트로 주문 수락 |
| `settleOrder()` | 가격 계산이 포함된 원자적 정산 |
| `convertNote()` | 스마트 노트를 일반 노트로 변환 |

**주문 상태:**
```
Created (생성됨) → Taken (수락됨) → Settled (정산됨)
```

#### ZkDai.sol (노트 관리)

ETH와 DAI 토큰 모두에 대한 핵심 노트 작업을 처리합니다.

**주요 함수:**
| 함수 | 설명 |
|------|------|
| `mint(a, b, c, input, encryptedNote)` | Groth16 증명과 함께 새 노트 생성 |
| `spend(a, b, c, input, note1, note2)` | 노트 소비, 두 개의 새 노트 생성 |
| `liquidate(to, a, b, c, input)` | 노트를 토큰으로 다시 변환 |

### 검증자 컨트랙트

snarkjs를 사용하여 Circom 회로에서 자동 생성됩니다 (`contracts/verifiers/` 위치):

| 검증자 | 용도 | 공개 입력 수 |
|--------|------|-------------|
| `MintBurnNoteVerifier.sol` | 노트 생성/소각 | 5 |
| `TransferNoteVerifier.sol` | 노트 전송 | 9 |
| `ConvertNoteVerifier.sol` | 노트 변환 | 7 |
| `MakeOrderVerifier.sol` | 주문 생성 | 4 |
| `TakeOrderVerifier.sol` | 주문 수락 | 9 |
| `SettleOrderVerifier.sol` | 주문 정산 | 21 |

**Groth16 증명 형식:**
```solidity
function verifyProof(
    uint256[2] memory a,      // G1 포인트
    uint256[2][2] memory b,   // G2 포인트
    uint256[2] memory c,      // G1 포인트
    uint256[N] memory input   // 공개 입력
) public view returns (bool);
```

---

## ZK 회로

회로는 Circom 2.1로 작성되고 Groth16 증명 시스템으로 컴파일됩니다.

### 노트 구조

```
Note = {
  ownerAddress,  // SHA256(pk.x || pk.y)[96:256]에서 파생된 160비트 주소
  value,         // 토큰 금액 (256비트)
  type,          // 0=ETH, 1=DAI (256비트)
  viewingKey,    // vk0(128비트) + vk1(128비트) 노트 복호화용
  salt           // 랜덤 값 (256비트)
}
```

### 주소 유도

소유자 주소는 BabyJubJub 공개키에서 SHA256을 사용하여 유도됩니다:

```
address = SHA256(pk.x || pk.y)[96:256]  // 마지막 160비트
```

이를 통해:
- 컴팩트한 표현 (512비트 공개키 대신 160비트)
- 충돌 저항성 (~2^80 보안 수준)
- 이더리움 주소 형식과 호환

### 회로 설명

#### 1. mint_burn_note (노트 생성)

**목적:** 새 노트에 대한 소유권과 올바른 해시 계산을 증명합니다.

**제약 조건:** ~154,900개

**공개 신호 (snarkjs 순서):**
```
[output, nh0, nh1, value, tokenType]
```

**작업:**
1. 주소 유도를 통한 소유권 검증 (sk → pk → SHA256 → address)
2. 노트의 SHA256 해시 계산 및 검증 (1184비트 입력)

#### 2. transfer_note (소비 및 분할)

**목적:** 1-2개의 노트를 소비하고 가치 보존과 함께 2개의 새 노트를 생성합니다.

**제약 조건:** ~492,085개

**검증:**
- 입력 노트의 소유권
- 가치 보존: `sum(입력) == sum(출력)`
- 모든 노트의 올바른 해시 계산

#### 3. convert_note (스마트 노트 변환)

**목적:** 스마트 노트(거래에서 생성된)를 일반 노트로 변환합니다.

**제약 조건:** ~337,437개

**검증:**
- 스마트 노트 소유자가 원본 노트 해시와 일치
- 새 노트가 올바른 소유권을 가짐

#### 4. make_order (주문 생성)

**목적:** 금액을 노출하지 않고 거래 주문을 생성합니다.

**제약 조건:** ~154,900개

**출력:** 소유권 증명과 함께 주문 매개변수에 대한 커밋먼트.

#### 5. take_order (주문 수락)

**목적:** 메이커를 위한 스테이크 노트를 생성하여 주문을 수락합니다.

**제약 조건:** ~246,040개

**검증:**
- 테이커가 부모 노트 소유
- 스테이크 노트 값이 부모 노트 값과 동일
- 스테이크 노트 소유자가 메이커 노트 해시 (스마트 노트)

#### 6. settle_order (주문 정산)

**목적:** 가격 계산이 포함된 원자적 스왑 (가장 복잡한 회로).

**제약 조건:** ~520,221개

**수학 연산:**
```
makerValue * price == q0 * 10^18 + r0
takerValue == q1 * price + r1
```

**출력 노트 (모두 스마트 노트):**
1. **보상 노트** - 메이커의 소스 토큰을 테이커에게 (소유자 = 테이커 부모 해시)
2. **지불 노트** - 테이커의 타겟 토큰을 메이커에게 (소유자 = 메이커 노트 해시)
3. **잔돈 노트** - 나머지를 테이커에게 (소유자 = 테이커 부모 해시)

### 회로 복잡도 요약

| 회로 | 비선형 제약 조건 |
|------|------------------|
| mint_burn_note | 154,900 |
| make_order | 154,900 |
| take_order | 246,040 |
| convert_note | 337,437 |
| transfer_note | 492,085 |
| settle_order | 520,221 |

**참고:** 소유권 검증(SHA256 기반 주소 유도)으로 인해 일부 제약 조건이 증가했지만, 노트 해시 입력 크기 감소(1536비트 → 1184비트)로 전체적으로 감소했습니다.

---

## 스크립트 및 라이브러리

### 핵심 라이브러리 (`scripts/lib/`)

#### noteProofHelper.js (통합 API)

증명 생성을 위한 메인 진입점입니다.

```javascript
// 초기화 (한 번 필요)
await noteProofHelper.init();

// 키 생성 - 160비트 ownerAddress 반환
const { secretKey, ownerAddress } = await noteProofHelper.generateKeypair();

// ownerAddress로 노트 생성
const { note, sk } = await noteProofHelper.createNote(secretKey, value, tokenType, viewingKey, salt);

// 스마트 노트 생성 (거래용)
// owner = SHA256(parentNoteHash)[96:256] (160비트 자르기)
const smartNote = await noteProofHelper.createSmartNote(ownerNote, value, tokenType, viewingKey, salt);

// 증명 생성
const proof = await noteProofHelper.generateMintProof(note, sk);
const proof = await noteProofHelper.generateTransferProof(old0, old1, new0, new1, sk0, sk1);
const proof = await noteProofHelper.generateMakeOrderProof(makerNote, sk);
const proof = await noteProofHelper.generateTakeOrderProof(parentNote, stakeNote, sk);
const proof = await noteProofHelper.generateSettleOrderProof(maker, stake, reward, payment, change, price, sk);
const proof = await noteProofHelper.generateConvertProof(smartNote, originNote, newNote, sk);
```

#### snarkjsUtils.js (저수준)

직접적인 snarkjs 래퍼 함수입니다.

```javascript
// 증명 생성
getMintNBurnProof(note, sk)
getTransferProof(old0, old1, new0, new1, sk0, sk1)
getMakeOrderProof(makerNote, sk)
getTakeOrderProof(parentNote, stakeNote, sk)
getSettleOrderProof(maker, stake, reward, payment, change, price, sk, q0, r0, q1, r1)
getConvertProof(smartNote, originNote, newNote, sk)

// 유틸리티
formatProofForContract(proof, publicSignals)  // Solidity 형식으로 변환
verifyProofLocal(circuitName, proof, signals) // 로컬 검증
```

#### Note.js

프라이버시 노트를 관리하는 핵심 Note 클래스입니다.

```javascript
class Note {
  constructor(ownerAddress, value, type, viewingKey, salt)
  // ownerAddress: 160비트 주소 (hex 문자열)
  // viewingKey: { vk0, vk1 } - 128비트 값 두 개

  hash()              // 노트의 SHA256 해시 (1184비트 입력)
  hashArr()           // [nh0, nh1] 128비트 분할
  toCircuitInput()    // 회로용 형식
}

// 노트 해시 계산 (총 1184비트):
// SHA256(ownerAddress(160) || value(256) || type(256) || vk0(128) || vk1(128) || salt(256))

// 상수
EMPTY_NOTE_HASH = '0x...'  // 0 ownerAddress로 계산
ETH_TOKEN_TYPE = 0
DAI_TOKEN_TYPE = 1
```

---

## 데이터 흐름 및 아키텍처

### 상위 레벨 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    프론트엔드 애플리케이션                      │
│              (noteProofHelper.js API)                        │
└────────────────────────┬────────────────────────────────────┘
                         │ JavaScript
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    snarkjs (WASM)                            │
│         위트니스 계산 + Groth16 증명 생성                       │
└────────────────────────┬────────────────────────────────────┘
                         │ Web3.js
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              스마트 컨트랙트 (ZkDex.sol)                       │
│    ZkDai: mint(), spend(), liquidate()                       │
│    ZkDex: makeOrder(), takeOrder(), settleOrder()            │
└────────────────────────┬────────────────────────────────────┘
                         │ 증명 검증
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Groth16 검증자 컨트랙트                           │
│         verifyProof() - BN128 페어링 체크                     │
└─────────────────────────────────────────────────────────────┘
```

### 증명 생성 흐름

```
1. 사용자가 트랜잭션 시작 (Mint/Spend/Order)
           ↓
2. noteProofHelper가 회로 입력 준비
           ↓
3. snarkjs 실행:
   ├── WASM 위트니스 계산기 로드
   ├── 위트니스 계산 (비공개 입력)
   ├── zkey (증명 키) 로드
   └── Groth16 증명 생성
           ↓
4. Solidity용 증명 포맷:
   ├── a: [2] G1 포인트
   ├── b: [[2],[2]] G2 포인트 (좌표 스왑)
   └── c: [2] G1 포인트
           ↓
5. 스마트 컨트랙트에 제출
           ↓
6. 스마트 컨트랙트가 검증자 컨트랙트를 통해 검증
           ↓
7. 유효한 경우: 상태 업데이트 → 이벤트 발생
   무효한 경우: 트랜잭션 되돌림
```

### 거래 흐름

```
┌─────────────┐    makeOrder()    ┌─────────────┐
│   메이커     │ ───────────────→  │    주문      │
│    노트      │                   │  (Created)  │
│  "Trading"  │                   └──────┬──────┘
└─────────────┘                          │
                                         │ takeOrder()
┌─────────────┐                          ↓
│   테이커     │ ───────────────→  ┌─────────────┐
│  부모 노트   │                   │    주문      │
│  "Trading"  │                   │   (Taken)   │
└─────────────┘                   └──────┬──────┘
       ↓                                 │
┌─────────────┐                          │ settleOrder()
│  스테이크    │                          ↓
│    노트      │                   ┌─────────────┐
│ (스마트 노트) │                   │    주문      │
└─────────────┘                   │  (Settled)  │
                                  └──────┬──────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ↓                          ↓                          ↓
       ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
       │    보상      │           │    지불      │           │    잔돈      │
       │ (스마트 노트) │           │ (스마트 노트) │           │ (스마트 노트) │
       │  테이커에게   │           │  메이커에게   │           │   나머지     │
       └─────────────┘           └─────────────┘           └─────────────┘
              │                          │                          │
              └──────────────────────────┴──────────────────────────┘
                                         │
                                         ↓ convertNote()
                                  ┌─────────────┐
                                  │    일반      │
                                  │    노트      │
                                  └─────────────┘
```

---

## 핵심 개념

### 프라이버시 모델

- **노트 기반 UTXO:** Zcash와 유사하게 잔액이 노트로 표현됨
- **암호화된 저장소:** 노트 데이터가 뷰잉키로 암호화됨
- **ZK 증명:** 데이터 노출 없이 소유권과 유효성 증명
- **주소 기반 소유권:** 소유자 = SHA256(pk)에서 유도된 160비트 주소
- **스마트 노트:** 소유자 = SHA256(부모노트해시)[96:256] (160비트 자르기, 원자적 스왑 가능)

### 암호화 기본 요소

| 기본 요소 | 용도 |
|----------|------|
| **BabyJubJub** | 소유권 키 (SNARKs에서 효율적) |
| **SHA-256** | 주소 유도 (512비트 → 160비트) 및 노트 해시 (1184비트) |
| **Groth16** | SNARK 증명 시스템 |
| **BN128** | 페어링을 위한 타원 곡선 |

### 해시 분할

ZK 회로는 필드 요소 제한이 있습니다 (~254비트). SHA-256 해시(256비트)는 분할됩니다:

```javascript
// 256비트 해시를 두 개의 128비트 값으로 분할
note.hashArr() → [nh0, nh1]

// 회로에서: nh0과 nh1을 별도로 검증
// 컨트랙트에서: 전체 해시 재구성
calcHash(nh0, nh1) → 원본 해시
```

### 공개 신호 순서 (snarkjs)

**중요:** snarkjs는 회로 출력을 공개 신호의 **맨 앞에** 배치합니다:

```
회로: signal output out; signal input public nh0;
snarkjs: [out, nh0, ...]  // output이 먼저!
```

모든 컨트랙트가 이 순서를 사용하도록 업데이트되었습니다.

---

## 테스트

### 테스트 스위트

| 파일 | 설명 | 테스트 수 |
|------|------|----------|
| `integration-test.js` | Node.js 회로 테스트 | 21 |
| `frontend-integration.test.js` | 프론트엔드 API 테스트 | 20 |
| `ZkDex.production.test.js` | 온체인 증명 검증 | 19 |

### 테스트 실행

```bash
# 로컬 테스트
npx ganache --port 8545 --accounts 10 --defaultBalanceEther 1000
npx truffle test

# 프로덕션 테스트 (실제 증명)
npx truffle test test/ZkDex.production.test.js

# 프론트엔드 통합
node test/frontend-integration.test.js

# 경계값 및 엣지 케이스 테스트
node test/boundary-edge-cases.test.js
```

### 테스트 결과

- **93/93** 총 테스트 통과
  - Node.js 통합: 21/21
  - 프론트엔드 통합: 20/20
  - 경계값/엣지 케이스: 33/33
  - Truffle (온체인): 19/19
- E2E 거래 흐름 검증: Make → Take → Settle → Convert

---

## Docker 환경

### 서비스

| 서비스 | 설명 | 프로필 |
|--------|------|--------|
| `ganache` | 로컬 이더리움 블록체인 | 기본 |
| `zkdex` | 테스트 실행 | 기본 |
| `zkdex-dev` | 개발용 쉘 | dev |
| `test-production` | 프로덕션 테스트 | test |

### 사용법

```bash
# 빌드 (로컬 회로 아티팩트 있으면 사용)
docker compose build zkdex

# 테스트 실행
docker compose up zkdex

# 개발 모드
docker compose --profile dev up zkdex-dev

# 정리
docker compose down -v
```

### Dockerfile 특징

- **조건부 빌드:** 사전 빌드된 `.zkey` 파일이 있으면 사용
- **폴백:** 아티팩트가 없으면 Powers of Tau 다운로드 및 컴파일
- **멀티 스테이지:** Rust에서 Circom 컴파일러 빌드

---

## 설정

### Truffle 설정

```javascript
{
  networks: {
    development: { host: "127.0.0.1", port: 8545 },
    docker: { host: "ganache", port: 8545, network_id: "5777" }
  },
  compilers: {
    solc: {
      version: "0.8.20",
      settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris" }
    }
  }
}
```

### 주요 의존성

```json
{
  "snarkjs": "^0.7.6",
  "circomlibjs": "^0.1.7",
  "ffjavascript": "^0.3.1",
  "@openzeppelin/contracts": "^4.9.3"
}
```

---

## 라이선스

MIT
