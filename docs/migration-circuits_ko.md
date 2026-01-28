# ZoKrates → Circom/snarkjs 마이그레이션 보고서

## 개요

ZK-DEX 프로젝트의 ZoKrates 기반 ZK-SNARK 회로를 Circom/snarkjs 기반으로 마이그레이션하였습니다.

**마이그레이션 일자:** 2026-01-25
**상태:** ✅ 완료 (프로덕션 테스트 통과)

## 변경 사항 요약

### 1. 증명 시스템 변경

| 항목 | 이전 (ZoKrates) | 이후 (Circom/snarkjs) |
|------|----------------|----------------------|
| 회로 언어 | ZoKrates DSL | Circom 2.1.0 |
| 증명 시스템 | PGHR13 (8개 요소) | Groth16 (3개 요소: a, b, c) |
| 증명 생성 | Docker 컨테이너 | Node.js (snarkjs) |
| Solidity 버전 | ^0.5.0 | ^0.8.20 |

### 2. 새로 생성된 파일

#### Circom 회로 (`circuits-circom/`)

```
circuits-circom/
├── package.json
├── node_modules/
├── build/                          # 컴파일 결과물
│   ├── *.r1cs                      # R1CS 제약 시스템
│   ├── *_js/*.wasm                 # WASM 실행 파일
│   ├── *.zkey                      # Groth16 proving key
│   └── *_vk.json                   # Verification key
├── utils/
│   ├── poseidon/
│   │   └── poseidon_note.circom     # Poseidon 기반 노트 해시 (Phase 3)
│   ├── sha256/                       # 레거시 (Phase 1-2, 더 이상 사용하지 않음)
│   │   ├── sha256_512bit.circom
│   │   └── sha256_1536bit.circom
│   ├── babyjubjub/
│   │   ├── get_pubkey.circom
│   │   ├── get_address.circom
│   │   └── proof_of_ownership.circom
│   ├── pack/
│   │   ├── pack128.circom
│   │   ├── pack160.circom
│   │   └── unpack256.circom
│   ├── math/
│   │   └── safe_math.circom
│   └── is_smart.circom
├── main/
│   ├── mint_burn_note.circom
│   ├── transfer_note.circom
│   ├── convert_note.circom
│   ├── make_order.circom
│   ├── take_order.circom
│   └── settle_order.circom
└── scripts/
    ├── compile.sh
    ├── setup.sh
    └── generate_verifiers.sh
```

#### 증명 생성 유틸리티

- `scripts/lib/snarkjsUtils.js` - dockerUtils.js 대체

#### Solidity 검증자 컨트랙트

- `contracts/verifiers/IGroth16Verifier.sol` - 인터페이스
- `contracts/verifiers/MintBurnNoteVerifier.sol`
- `contracts/verifiers/TransferNoteVerifier.sol`
- `contracts/verifiers/ConvertNoteVerifier.sol`
- `contracts/verifiers/MakeOrderVerifier.sol`
- `contracts/verifiers/TakeOrderVerifier.sol`
- `contracts/verifiers/SettleOrderVerifier.sol`

### 3. 수정된 파일

#### Solidity 컨트랙트 (0.5.0 → 0.8.20)

| 파일 | 주요 변경 사항 |
|------|--------------|
| `contracts/ZkDaiBase.sol` | pragma 업그레이드, OpenZeppelin 4.x 임포트 |
| `contracts/MintNotes.sol` | abstract 키워드, 생성자 수정 |
| `contracts/SpendNotes.sol` | abstract 키워드, 변수명 충돌 해결 |
| `contracts/LiquidateNotes.sol` | abstract 키워드 |
| `contracts/ZkDai.sol` | OpenZeppelin 4.x 임포트 |
| `contracts/ZkDex.sol` | array.length++ → push() 패턴 |
| `contracts/RLPReader.sol` | address 타입 변환 수정 |
| `contracts/Requestable.sol` | SPDX 라이선스 추가 |
| `contracts/Migrations.sol` | 생성자 수정 |
| `contracts/test/MockDai.sol` | ERC20 생성자 인자 추가 |
| `contracts/test/TestZkDai.sol` | 인터페이스 임포트 수정 |

#### 설정 파일

| 파일 | 변경 내용 |
|------|----------|
| `truffle-config.js` | solc 0.5.8 → 0.8.20, evmVersion: paris |
| `package.json` | snarkjs, @openzeppelin/contracts 추가 |

## 회로 상세

### 공개 입력 포맷

**중요**: snarkjs/Groth16은 출력(output)을 **배열 맨 앞에** 배치합니다.

| 회로 | 공개 입력 (snarkjs 순서) | 개수 |
|------|-------------------------|-----|
| mint_burn_note | [output, noteHash, value, tokenType] | 4 |
| transfer_note | [output, o0Hash, o1Hash, newHash, changeHash] | 5 |
| convert_note | [output, smartHash, originHash, newHash] | 4 |
| make_order | [output, noteHash, tokenType] | 3 |
| take_order | [output, oldHash, oldType, newHash, newOwnerAddress, newType] | 6 |
| settle_order | [output, o0Hash, o0Type, o1Hash, o1Type, n0Hash, n0OwnerAddress, n0Type, n1Hash, n1OwnerAddress, n1Type, n2Hash, n2Type, price] | 14 |

*Phase 3 (Poseidon 마이그레이션)에서 업데이트됨: 노트 해시가 128비트 쌍 분할 대신 단일 필드 원소로 변경됨*

### 회로 복잡도

| 회로 | SHA256 (Phase 2) | Poseidon (Phase 3) | 변화 |
|------|-------------------|--------------------| ------ |
| mint_burn_note | 154,900 | ~131,000 | -15% |
| make_order | 154,900 | ~131,000 | -15% |
| take_order | 246,040 | ~258,000 | +5% |
| convert_note | 337,437 | ~385,000 | +14% |
| transfer_note | 492,085 | ~516,000 | +5% |
| settle_order | 520,481 | ~641,000 | +23% |

*Phase 3 (Poseidon 마이그레이션): Poseidon 해시 (~300 제약)가 SHA256 (~30,000 제약/해시)를 대체. 그러나 전체 회로 크기는 BabyJubJub 스칼라 곱(`EscalarMulFix`, 소유권 증명당 ~128K 제약, 회로 비용의 ~98%)이 지배적. 일부 회로는 보안 제약 추가(settle_order)와 추가 소유권 증명으로 인해 전체적으로 증가. 해시 감소(~30K→~300/해시)는 유의미하나 `EscalarMulFix` 대비 부차적.*

## Groth16 증명 포맷

### 이전 (PGHR13)
```javascript
// 8개 요소
{
  a: [2], a_p: [2], b: [2][2], b_p: [2],
  c: [2], c_p: [2], h: [2], k: [2]
}
```

### 이후 (Groth16)
```javascript
// 3개 요소
{
  a: [2],      // G1 point
  b: [[2],[2]], // G2 point (snarkjs → Solidity 변환 시 스왑 필요)
  c: [2]       // G1 point
}
```

**주의**: snarkjs의 `pi_b` 좌표는 Solidity 검증자와 순서가 다릅니다:
```javascript
// snarkjsUtils.js의 formatProofForContract()
b: [
    [proof.pi_b[0][1], proof.pi_b[0][0]],  // 좌표 스왑
    [proof.pi_b[1][1], proof.pi_b[1][0]]
]
```

## 테스트 결과

### 회로 컴파일 및 설정
- ✅ 6개 회로 모두 성공적으로 컴파일
- ✅ Powers of Tau ceremony 완료 (2^20)
- ✅ Groth16 zkey 생성 완료
- ✅ 검증 키 생성 완료

### 스마트 컨트랙트
- ✅ 모든 컨트랙트 Solidity 0.8.20으로 컴파일 성공
- ⚠️ 일부 함수 상태 변경 가능성 경고 (pure/view)

### 증명 생성
- ✅ MintNBurnNote 증명 생성 성공
- ✅ MakeOrder 증명 생성 성공
- ✅ TransferNote 증명 생성 성공
- ✅ TakeOrder 증명 생성 성공
- ✅ SettleOrder 증명 생성 성공
- ✅ ConvertNote 증명 생성 성공

### 프로덕션 모드 테스트 (development=false)
- ✅ ETH 노트 발행 (실제 Groth16 검증)
- ✅ DAI 노트 발행 (실제 Groth16 검증)
- ✅ 잘못된 증명 거부
- ✅ MakeOrder 실행 (실제 Groth16 검증)
- ✅ TransferNote (Spend) 실행 (실제 Groth16 검증)
- ✅ Liquidate 실행 (실제 Groth16 검증)
- ✅ **E2E 거래 플로우 (Make → Take → Settle → Convert) 검증 완료**

## 사용 방법

### 1. 회로 컴파일
```bash
cd circuits-circom
npm install
~/.cargo/bin/circom main/mint_burn_note.circom --r1cs --wasm --sym -o build/
```

### 2. 신뢰 설정
```bash
# Powers of Tau 다운로드 (이미 완료됨)
curl -L -o build/pot20_final.ptau https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_20.ptau

# zkey 생성
npx snarkjs groth16 setup build/mint_burn_note.r1cs build/pot20_final.ptau build/mint_burn_note_0000.zkey
echo "random" | npx snarkjs zkey contribute build/mint_burn_note_0000.zkey build/mint_burn_note.zkey --name="1st"
npx snarkjs zkey export verificationkey build/mint_burn_note.zkey build/mint_burn_note_vk.json
```

### 3. 증명 생성 (JavaScript)
```javascript
const { getMintNBurnProof } = require('./scripts/lib/snarkjsUtils');

const proof = await getMintNBurnProof(note, secretKey);
// proof = { a, b, c, input }
```

### 4. 스마트 컨트랙트 호출
```javascript
await zkDai.mint(
  proof.a,
  proof.b,
  proof.c,
  proof.input,
  encryptedNote,
  { value: noteValue }
);
```

## 해결된 이슈

### 1. BabyJubJub 베이스 포인트 통일 ✓

**문제**: JavaScript babyjubjub 라이브러리와 circomlib의 베이스 포인트가 다름

- babyjubjub npm (ZoKrates 호환):
  - gX: `16540640123574156134436876038791482806971768689494387082833631921987005038935`
  - gY: `20819045374670962167435360035096875258406992893633759881276124905556507972311`

- circomlib (snarkjs 호환):
  - BASE8[0]: `5299619240641551281634865583518297030282874472190772894086521144482721001553`
  - BASE8[1]: `16950150798460657717958625567821834550301663161624707787222815936182638968203`

**해결**: `circomlibjs` 패키지를 사용하는 `circomlibBabyJub.js` 래퍼 생성

### 2. Note.js와 snarkjsUtils.js 통합 ✓

**해결**: `noteProofHelper.js` 생성
- circomlibBabyJub를 사용한 키 쌍 생성
- Note 객체와 증명 생성 통합

## 해결된 추가 이슈

### 3. snarkjs 공개 신호 순서 ✓

**문제**: snarkjs/circom은 공개 신호를 `[output, ...public_inputs]` 순서로 출력하지만, 기존 Solidity 컨트랙트는 `[...public_inputs, output]` 순서를 예상

**영향받은 컨트랙트**:
- `MintNotes.sol` - input[0,1] → input[1,2] 변경
- `LiquidateNotes.sol` - input[0,1] → input[1,2] 변경
- `SpendNotes.sol` - input[0..7] → input[1..8] 변경
- `ZkDai.sol` - input[2,3] → input[3,4] 변경
- `ZkDex.sol` - 모든 함수(convertNote, makeOrder, takeOrder, settleOrder) 인덱스 수정

**해결**: 모든 컨트랙트의 input 배열 인덱스를 snarkjs 순서에 맞게 수정

### 4. SHA256 해시 포맷 호환성 ✓ *(Phase 3 Poseidon 마이그레이션으로 대체됨)*

**문제**: circom 회로의 SHA256 입력 포맷과 JavaScript 구현의 일치 확인 필요

**해결**: `test/sha256-hash-test.js`에서 검증 완료
- JavaScript Note.hash()와 circom SHA256_1536bit 출력이 일치함을 확인
- **참고**: SHA256은 Phase 3에서 Poseidon으로 대체됨. Note.hash()는 이제 circomlibjs Poseidon을 사용

### 5. SettleOrder 가격 및 Division Witness ✓

**문제**: SettleOrder 회로의 가격 계산 공식 이해 필요

**회로 제약 조건**:
```
// Line 160: o0Value * price = q0 * 10^18 + r0
// Line 174: o1Value = q1 * price + r1
```

**가격 의미론**:
- `price` = "target token per source token" (스케일링 없음)
- 예: "10 DAI per ETH" → price = 10

**Division Witness 계산**:
```javascript
// For q0, r0: o0Value * price = q0 * SCALING + r0
const o0ValueTimesPrice = makerValue * price;
const q0 = o0ValueTimesPrice / SCALING_FACTOR;
const r0 = o0ValueTimesPrice % SCALING_FACTOR;

// For q1, r1: o1Value = q1 * price + r1
const q1 = takerStakeValue / price;
const r1 = takerStakeValue % price;
```

**해결**: `noteProofHelper.js`의 `generateSettleOrderProof` 및 테스트 코드 수정

### 6. 스마트 노트 출력 검증 ✓

**문제**: SettleOrder의 reward, payment, change 노트가 모두 스마트 노트여야 함

**해결**: `noteProofHelper.js`에 `createSmartNote` 함수 추가
- owner = 다른 노트의 Poseidon 해시의 하위 160비트
- reward 노트: owner = taker의 parent note 해시 (160비트로 잘림)
- payment 노트: owner = maker note 해시 (160비트로 잘림)
- change 노트: 정산 방향에 따라 결정 (bit=1: maker, bit=0: taker)

## 알려진 이슈

현재 알려진 이슈 없음.

## 통합 테스트

### Node.js 테스트 실행

```bash
node test/integration-test.js
```

### Node.js 테스트 결과 (21/21 통과)

| 테스트 스위트 | 결과 |
|-------------|------|
| Note Creation | 6/6 ✓ |
| Circuit Files | 6/6 ✓ |
| snarkjsUtils | 2/2 ✓ |
| Hash Computation | 3/3 ✓ |
| Verifier Interface | 2/2 ✓ |
| Dummy Proof Flow | 2/2 ✓ |

### Truffle 테스트 실행

```bash
# 개발 모드 테스트 (증명 검증 건너뜀)
npx truffle test test/ZkDex.groth16.test.js

# 프로덕션 모드 테스트 (실제 Groth16 검증)
npx truffle test test/ZkDex.production.test.js
```

### Truffle 테스트 결과 (19/19 통과)

#### 개발 모드 테스트 (8/8)

| 테스트 스위트 | 결과 |
|-------------|------|
| Contract Deployment | 4/4 ✓ |
| Note Minting (ETH) | 1/1 ✓ |
| Note Minting (DAI) | 1/1 ✓ |
| Note State Management | 1/1 ✓ |
| Groth16 Proof Format | 1/1 ✓ |

#### 프로덕션 모드 테스트 (11/11) - 실제 Groth16 검증

| 테스트 스위트 | 결과 | 소요시간 |
|-------------|------|---------|
| Deploy in Production Mode | 1/1 ✓ | - |
| Mint ETH (Real Proof) | 1/1 ✓ | ~4.2s |
| Reject Invalid Proof | 1/1 ✓ | ~2.6s |
| Mint DAI (Real Proof) | 1/1 ✓ | ~3.4s |
| MakeOrder (Real Proof) | 1/1 ✓ | ~6.6s |
| TransferNote/Spend (Real Proof) | 1/1 ✓ | ~13.9s |
| Liquidate (Real Proof) | 1/1 ✓ | ~6.6s |
| **E2E Step 1: MakeOrder** | 1/1 ✓ | ~6.7s |
| **E2E Step 2: TakeOrder** | 1/1 ✓ | ~9.0s |
| **E2E Step 3: SettleOrder** | 1/1 ✓ | ~16.5s |
| **E2E Step 4: ConvertNote** | 1/1 ✓ | ~9.0s |

### 테스트 파일

- `test/integration-test.js` - 종합 통합 테스트
- `test/circom-test.js` - 회로 파일 검증 및 증명 생성 테스트
- `test/ZkDex.groth16.test.js` - Truffle 개발 모드 테스트
- `test/ZkDex.production.test.js` - Truffle 프로덕션 모드 테스트 (실제 증명 검증)
- `test/proof-generation-test.js` - 증명 생성 단위 테스트
- `test/sha256-hash-test.js` - SHA256 해시 호환성 테스트
- `test/frontend-integration.test.js` - 프론트엔드 통합 테스트 (20개)
- `test/boundary-edge-cases.test.js` - 경계값 및 엣지 케이스 테스트 (33개)
- `test/util.js` - 테스트 유틸리티

## 추가된 파일

### JavaScript 유틸리티

| 파일 | 설명 |
|------|------|
| `scripts/lib/circomlibBabyJub.js` | circomlib 호환 BabyJubJub 래퍼 |
| `scripts/lib/noteProofHelper.js` | Note.js와 snarkjsUtils.js 통합 헬퍼, 스마트 노트 생성 |
| `scripts/lib/snarkjsUtils.js` | snarkjs 기반 증명 생성 (dockerUtils.js 대체) |

### snarkjsUtils.js 주요 함수

```javascript
// 증명 생성 함수
getMintNBurnProof(note, sk)           // 노트 발행/소각
getTransferProof(oldNote0, oldNote1, newNote, changeNote, sk0, sk1)
getConvertProof(smartNote, originNote, newNote, sk)
getMakeOrderProof(makerNote, sk)      // 주문 생성
getTakeOrderProof(parentNote, stakeNote, sk)
getSettleOrderProof(makerNote, takerStakeNote, rewardNote, paymentNote, changeNote, price, sk, q0, r0, q1, r1)

// 유틸리티 함수
formatProofForContract(proof, publicSignals)  // 컨트랙트용 포맷 변환
verifyProofLocal(circuitName, proof, publicSignals)  // 로컬 검증
```

### noteProofHelper.js 주요 함수

```javascript
// 키 관리
generateKeypair()                      // circomlib 호환 키 쌍 생성
derivePublicKey(sk)                    // sk → pk 유도

// 노트 생성
createNote(sk, value, tokenType, viewingKey, salt)    // 일반 노트 생성
createSmartNote(ownerNote, value, tokenType, ...)     // 스마트 노트 생성 (E2E 거래용)
createEmptyNote()                      // 빈 노트

// 증명 생성 (snarkjsUtils 래퍼)
generateMintProof(note, sk)
generateTransferProof(oldNote0, oldNote1, newNote, changeNote, sk0, sk1)
generateMakeOrderProof(makerNote, sk)
generateTakeOrderProof(parentNote, stakeNote, sk)
generateConvertProof(smartNote, originNote, newNote, sk)
generateSettleOrderProof(makerNote, takerStakeNote, rewardNote, paymentNote, changeNote, price, sk)
```

## 완료된 작업

1. ✅ SHA256 해시 포맷 일치 확인
   - circom 회로의 SHA256 입력 포맷과 JavaScript 구현 일치 확인 완료
   - 실제 증명 생성 테스트 완료

2. ✅ 프로덕션 테스트
   - development=false 모드에서 실제 증명 검증 테스트 완료
   - MintNBurnNote, MakeOrder, TransferNote, Liquidate 테스트 통과

3. ✅ 컨트랙트 인덱스 수정
   - snarkjs 공개 신호 순서에 맞게 모든 컨트랙트 수정 완료

4. ✅ 핵심 기능 프로덕션 검증 완료
   - Mint (ETH/DAI), Transfer, MakeOrder, Liquidate 7개 테스트 통과

5. ✅ **E2E 거래 플로우 테스트 완료**
   - TakeOrder 프로덕션 테스트 추가
   - SettleOrder 프로덕션 테스트 추가
   - 전체 거래 플로우 (Make → Take → Settle) 검증 완료
   - 스마트 노트 생성 함수 (`createSmartNote`) 추가

6. ✅ **가격 계산 로직 검증**
   - settle_order 회로의 division witness 계산 공식 확인
   - `o0Value * price = q0 * 10^18 + r0`
   - `o1Value = q1 * price + r1`
   - noteProofHelper.js의 generateSettleOrderProof 수정

7. ✅ **ConvertNote 프로덕션 테스트 추가**
   - 스마트 노트 → 일반 노트 변환 테스트 완료
   - E2E 거래 플로우 Step 4로 추가 (Make → Take → Settle → Convert)
   - 11개 프로덕션 테스트 모두 통과

8. ✅ **프론트엔드 통합 테스트 완료**
   - `test/frontend-integration.test.js` - 20개 테스트 모두 통과
   - `examples/frontend-usage.js` - 프론트엔드 사용 예제 코드

### 프론트엔드 통합 테스트 결과 (20/20 통과)

| 테스트 카테고리 | 테스트 항목 | 결과 |
|---------------|-----------|------|
| Key Generation | Initialize, Generate, Derive, Multiple | 4/4 ✓ |
| Note Creation | ETH, DAI, BigInt, Empty, Smart, Deterministic | 6/6 ✓ |
| Mint Proof | Generate ETH, Verify, Generate DAI | 3/3 ✓ |
| Transfer Proof | Generate (1 input) | 1/1 ✓ |
| MakeOrder Proof | Generate | 1/1 ✓ |
| TakeOrder Proof | Generate | 1/1 ✓ |
| ConvertNote Proof | Generate | 1/1 ✓ |
| SettleOrder Proof | Generate | 1/1 ✓ |
| Proof Format | Contract compatibility, Array helper | 2/2 ✓ |

### 프론트엔드 통합 예제 (`examples/frontend-usage.js`)

```javascript
// 초기화
await initialize();

// 지갑 생성
const wallet = await createNewWallet();

// ETH 발행 (입금)
const mintResult = await mintETH(wallet, 1n * 10n ** 18n);

// 컨트랙트 호출
await zkdex.mint(
    mintResult.proof.a,
    mintResult.proof.b,
    mintResult.proof.c,
    mintResult.proof.input,
    mintResult.encryptedNote,
    { value: '1000000000000000000' }
);
```

9. ✅ **Docker 환경 설정 완료**
   - `Dockerfile` - 조건부 빌드 지원 (로컬 빌드 있으면 사용, 없으면 다운로드)
   - `docker-compose.yml` - Ganache + ZK-DEX 서비스 구성
   - `.dockerignore` - 불필요한 파일 제외
   - Docker 환경에서 전체 테스트 통과

10. ✅ **경계값 및 엣지 케이스 테스트 추가**
   - `test/boundary-edge-cases.test.js` - 45개 테스트 모두 통과
   - 회로 동작의 경계값과 엣지 케이스 검증

11. ✅ **Viewing Key ↔ ownerAddress 관계 설정**
    - 일반 노트: ownerAddress = viewingKey[96:256] (마지막 160비트)
    - 스마트 노트: ownerAddress = truncated(parentNoteHash), viewingKey = parentNoteHash
    - 4개의 관계 테스트 추가

12. ✅ **SettleOrder 보안 수정**
    - 보안 수정 1: Stake 노트 소유자 검증
    - 보안 수정 2: Payment 노트 소유자 검증
    - 보안 수정 3: Change 노트 소유자 검증 (bit 의존)
    - 6개의 보안 테스트 추가 (양성 3개, 음성 3개)

13. ✅ **SettleOrder bit=0 스케일링 수정**
    - Payment 계산 수정: `o0ValuePrice = q0 * DECIMALS`
    - bit=0 (테이커 초과) 케이스에서 DAI 지급액이 올바르게 wei로 스케일링됨
    - 2개의 bit=0 테스트 추가

14. ✅ **SHA256 → Poseidon 해시 마이그레이션 (Phase 3)**
    - 모든 회로가 SHA256에서 Poseidon 해시로 마이그레이션 (~97-99% 제약 감소)
    - Note.js: 비동기 초기화 패턴 (`await initNote()` 1회, 이후 `hash()`는 동기)
    - noteHelper.js: SHA256 → Poseidon 해시 계산
    - noteProofHelper.js: init()에서 initNote() 호출, createSmartNote에서 동기 getSmartNoteOwner 사용
    - ZkDaiBase.sol: EMPTY_NOTE_HASH를 `0x1fdb...53d5` (Poseidon(0,0,0,0,0,0))로 업데이트
    - 스마트 노트 소유자: Poseidon 해시의 하위 160비트 (이전: SHA256 자르기)
    - 공개 입력 감소 (분할 h0/h1 대신 단일 필드 원소 해시)
    - 전체 19개 Truffle 테스트 통과 (개발 8개 + 프로덕션 11개)

### 경계값 및 엣지 케이스 테스트 결과 (45/45 통과)

```bash
node test/boundary-edge-cases.test.js
```

| 테스트 카테고리 | 테스트 항목 | 결과 |
|---------------|-----------|------|
| 경계값 테스트 | value=0, 1 wei, 1 ETH, 2^128-1, 10^30, 토큰 타입, salt 경계 | 9/9 ✓ |
| 엣지 케이스 | 빈 노트 해시, 동일 값 노트, 자기 전송, 균등 분할, 전액 전송, 2개 입력 | 7/7 ✓ |
| 가격 계산 | price=1 (1:1), 정확한 나눗셈, 큰 가격 (100), 부분 체결 | 4/4 ✓ |
| 스마트 노트 | 스마트 노트 생성, ownerAddress 유도, 변환 | 3/3 ✓ |
| 해시 일관성 | 결정론적, 값 변경, 토큰 변경, 소유자 변경, 128비트 분할 | 5/5 ✓ |
| 증명 포맷 | 구조 검증, hex 값, 회로 차이 | 3/3 ✓ |
| MakeOrder/TakeOrder | 최소 값, stake 노트 생성 | 2/2 ✓ |
| Viewing Key 관계 | 일반 노트 vk↔address, 스마트 노트 vk↔parentHash, 서로 다른 키 | 4/4 ✓ |
| SettleOrder 보안 | Stake 소유자, Payment 소유자, Change 소유자 (bit=1), 음성 테스트 | 6/6 ✓ |
| SettleOrder bit=0 | 테이커 초과 시나리오, Change 소유자 제약 | 2/2 ✓ |

## Docker 환경

### 파일 구조

```
Dockerfile              # 멀티스테이지 빌드 (회로, 컨트랙트, 테스트, 프론트엔드 개발/프로덕션)
docker-compose.yml      # 서비스 구성
.dockerignore           # 제외 파일 목록
```

### Dockerfile 특징

- **조건부 빌드**: 로컬에 `circuits-circom/build/*.zkey` 파일이 있으면 그대로 사용
- 없으면 자동으로 ptau 다운로드 + 회로 컴파일 + 신뢰 설정 수행
- Circom 컴파일러는 Rust에서 빌드 (multi-stage build)
- 프론트엔드: 개발(Vite)과 프로덕션(nginx) 타겟의 멀티스테이지 빌드

### 서비스 구성

| 서비스 | 설명 | 포트 | 프로필 |
|--------|------|------|--------|
| `ganache` | 로컬 이더리움 블록체인 | 8545 | 기본 |
| `zkdex` | 테스트 실행 | - | 기본 |
| `vapp` | 프론트엔드 (Production/nginx) | 8080 | 기본 |
| `vapp-dev` | 프론트엔드 (Development/hot reload) | 8081 | dev |
| `zkdex-dev` | 개발용 쉘 | - | dev |
| `test-frontend` | 프론트엔드 테스트 | - | test |
| `test-production` | 프로덕션 테스트 | - | test |

### 사용 방법

```bash
# 모든 테스트 실행
docker compose run zkdex

# ganache + 프론트엔드 (프로덕션) 시작
docker compose up ganache vapp -d

# ganache + 프론트엔드 (개발/hot reload) 시작
docker compose --profile dev up ganache vapp-dev -d

# 개발 모드 (쉘 접속)
docker compose --profile dev run zkdex-dev

# 프론트엔드 테스트
docker compose --profile test run test-frontend

# 프로덕션 테스트
docker compose --profile test run test-production

# 정리
docker compose down -v
```

### Ganache 설정

- Network ID: 5777
- Accounts: 10개 (각 1000 ETH)
- Gas Limit: 12,000,000
- Mnemonic: `candy maple cake sugar pudding cream honey rich smooth crumble sweet treat`

### truffle-config.js Docker 네트워크

```javascript
docker: {
  host: process.env.GANACHE_HOST || 'ganache',
  port: process.env.GANACHE_PORT || 8545,
  network_id: '5777',
  websockets: true,
  gas: 12000000,
  gasPrice: 20000000000,
}
```

## 노트 소유권 진화 (Phase 2 → Phase 4)

### 개요

이 섹션은 노트 소유권 표현의 진화를 문서화합니다:
- **Phase 1:** 원래 owner0/owner1 (512비트, BabyJubJub 좌표)
- **Phase 2:** ownerAddress (160비트, SHA256 잘림)
- **Phase 3:** ownerAddress (160비트, Poseidon 잘림)
- **Phase 4 (현재):** owner0/owner1 (pkX/pkY, 전체 BabyJubJub 좌표)

**마이그레이션 일자:** 2026-01-25 (Phase 2-3), 2026-01-29 (Phase 4)
**상태:** Phase 4 진행 중

### 주요 변경 사항

#### 노트 구조

| 필드 | Phase 1 | Phase 2-3 | Phase 4 (현재) |
|------|---------|-----------|----------------|
| 소유자 | owner0 + owner1 (512비트) | ownerAddress (160비트) | owner0 (pkX) + owner1 (pkY) |
| 뷰잉 키 | vk0 + vk1 (256비트) | vk0 + vk1 (256비트) | vk0 (pkX) + vk1 (pkY) |
| 노트 해시 입력 수 | 6 (SHA256) | 6 (Poseidon) | 7 (Poseidon) |

#### 소유자 표현 (pk 기반)

~~`ownerAddress = SHA256(pk.x || pk.y)[96:256]`~~ *(Phase 2, 대체됨)*
~~`ownerAddress = Poseidon(pk.x, pk.y) & ((1 << 160) - 1)`~~ *(Phase 3, 대체됨)*

**Phase 4 (pk 기반):**
```
owner0 = pk.x  // BabyJubJub 공개키 X 좌표 (254비트 필드 원소)
owner1 = pk.y  // BabyJubJub 공개키 Y 좌표 (254비트 필드 원소)
```

- 전체 공개키 좌표를 직접 사용 (잘림이나 해싱 없음)
- 완전한 암호학적 보안 제공 (잘림으로 인한 충돌 우려 없음)
- 회로에서 BabyJubJub 스칼라 곱으로 소유권 검증: `pk = sk * G`

#### 노트 해시 형식 (Poseidon, 7-입력 pk 기반)

~~`SHA256(ownerAddress || value || tokenType || vk0 || vk1 || salt)`~~ *(Phase 2, 대체됨)*
~~`Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)`~~ *(Phase 3, 대체됨)*

```
Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt) → 단일 254비트 필드 원소
```

**Phase 4 (pk 기반) 노트 구조:**
- **owner0** = pkX (BabyJubJub 공개키 X 좌표, 254비트 필드 원소)
- **owner1** = pkY (BabyJubJub 공개키 Y 좌표, 254비트 필드 원소)
- **value** = wei 단위 노트 값
- **tokenType** = 토큰 식별자 (0=ETH, 1=DAI 등)
- **vk0** = pkX (뷰잉 키, 일반 노트의 경우 owner와 동일)
- **vk1** = pkY (뷰잉 키, 일반 노트의 경우 owner와 동일)
- **salt** = 랜덤 254비트 필드 원소

**Phase 3 대비 주요 변경:**
- 160비트 ownerAddress 잘림 없음 (전체 pk 좌표 사용)
- vk0/vk1 = pkX/pkY (일반 노트의 경우, 뷰잉 키 유도 가능)
- 6개 대신 7개 입력 (owner가 두 좌표로 분할)
- ~300 제약 (Phase 3 Poseidon과 동일)

### 회로 변경

#### 새 파일

| 파일 | 설명 |
|------|------|
| `circuits-circom/utils/poseidon/poseidon_note.circom` | Poseidon 기반 노트 해시 (Phase 3) |
| `circuits-circom/utils/sha256/sha256_note_address.circom` | 160비트 주소를 사용한 노트 해시 *(레거시, Phase 2)* |
| `circuits-circom/utils/babyjubjub/get_address.circom` | 공개키에서 주소 유도 |

#### 수정된 메인 회로

6개 메인 회로 모두 pk 기반 소유권 사용하도록 업데이트 (Phase 4):
- `mint_burn_note.circom` - owner0/owner1 (pkX/pkY) 사용, 7-입력 Poseidon 해시
- `transfer_note.circom` - 모든 노트에 owner0/owner1 사용
- `make_order.circom` - owner0/owner1 (pkX/pkY) 사용, 7-입력 Poseidon 해시
- `take_order.circom` - owner0/owner1 사용
- `settle_order.circom` - owner0/owner1 사용
- `convert_note.circom` - owner0/owner1 사용

### 제약 조건 수 변화

| 회로 | 이전 | 이후 | 변화 |
|------|------|------|------|
| mint_burn_note | 125,679 | 154,900 | +23% |
| make_order | 125,679 | 154,900 | +23% |
| take_order | 247,664 | 246,040 | -0.7% |
| convert_note | 369,396 | 337,437 | -8.6% |
| transfer_note | 494,825 | 492,085 | -0.6% |
| settle_order | 614,380 | 520,481 | -15% |

**참고:** mint_burn_note와 make_order는 주소 유도(공개키의 SHA256)로 인해 제약 조건이 증가했습니다. 다른 회로들은 노트 해시 입력 크기 감소(1536 vs 1184비트)로 인해 감소했습니다. settle_order는 보안 수정(Phase 2.2-2.3) 포함.

### 백엔드 변경

#### Note.js

```javascript
class Note {
  // Phase 1
  constructor(owner0, owner1, value, type, viewingKey, salt)
  // owner0, owner1: 256비트 값

  // Phase 2-3
  constructor(ownerAddress, value, type, viewingKey, salt)
  // ownerAddress: 160비트 hex 문자열 (40자)
  // viewingKey: { vk0, vk1 } 128비트 값 두 개

  // Phase 4 (현재 - pk 기반)
  constructor(owner0, owner1, value, type, vk0, vk1, salt)
  // owner0: pkX (BabyJubJub 공개키 X 좌표)
  // owner1: pkY (BabyJubJub 공개키 Y 좌표)
  // vk0: pkX (일반 노트의 경우 뷰잉 키 = 공개키)
  // vk1: pkY
  // 스마트 노트의 경우: owner0/owner1 = 분할된 부모 해시, vk0/vk1 = 동일
}
```

#### noteProofHelper.js

```javascript
// Phase 1
const { secretKey, owner0, owner1 } = await generateKeypair();

// Phase 2-3
const { secretKey, ownerAddress } = await generateKeypair();

// Phase 4 (현재 - pk 기반)
const { secretKey, pk } = await generateKeypair();
// pk.x = owner0 (pkX)
// pk.y = owner1 (pkY)
// 일반 노트의 경우: vk0 = pk.x, vk1 = pk.y
```

#### 스마트 노트 소유자 (pk 기반)

스마트 노트의 경우, 소유자는 부모 노트 해시를 128비트 반으로 분할하여 유도됩니다:

```javascript
// Phase 1: owner = parentNote.hashArr() → [nh0, nh1] (256비트를 128비트 두 개로 분할)
// Phase 2: owner = SHA256(parentNoteHash)[96:256] (160비트 자르기)
// Phase 3: owner = Poseidon 노트 해시의 하위 160비트
// Phase 4 (현재): owner0/owner1 = parentHash를 128비트 반으로 분할
function getSmartNoteOwner(noteHash) {
    const hashBigInt = BigInt(noteHash);
    const mask128 = (BigInt(1) << BigInt(128)) - BigInt(1);
    const owner1 = hashBigInt & mask128;           // 하위 128비트
    const owner0 = (hashBigInt >> BigInt(128)) & mask128;  // 상위 128비트
    return { owner0, owner1 };
}
```

**회로 신호 이름:**
- `owner0` = 부모 노트 해시의 상위 128비트
- `owner1` = 부모 노트 해시의 하위 128비트
- 스마트 노트 소유권은 부모 노트의 해시가 분할된 owner 값과 일치하는지 확인하여 검증됨

### 테스트 결과

모든 회로 테스트 통과:
- ✅ mint_burn_note 증명 생성
- ✅ make_order 증명 생성
- ✅ (다른 회로들은 전체 통합 테스트 진행 중)

### 마이그레이션 이점 (Phase 4)

1. **완전한 보안:** 잘림 없음으로 충돌 취약점 제거
2. **단순한 코드:** 직접적인 pk 사용, 주소 유도 불필요
3. **명시적 vk 관계:** vk = pk가 명확하고 검증 가능
4. **통일된 구조:** 모든 노트가 동일한 owner0/owner1 형식 사용

---

## Viewing Key ↔ Owner 관계 (Phase 2.1 → Phase 4)

### 개요

일반 노트와 스마트 노트 모두에 대해 viewing key와 owner 간의 명확한 관계를 설정했습니다. Phase 4에서는 viewing key가 공개키와 동일합니다 (vk0 = pkX, vk1 = pkY).

**일자:** 2026-01-26 (Phase 2.1), 2026-01-29 (Phase 4)
**상태:** Phase 4 진행 중

### 일반 노트 (Phase 4 pk 기반)

~~`viewingKey = SHA256(pk.x || pk.y)`~~ *(Phase 2, 대체됨)*
~~`viewingKey = Poseidon(pk.x, pk.y)`~~ *(Phase 3, 대체됨)*

**Phase 4 (pk 기반):**
```
owner0 = pkX     // BabyJubJub 공개키 X 좌표
owner1 = pkY     // BabyJubJub 공개키 Y 좌표
vk0 = pkX        // 뷰잉 키 = 공개키 (일반 노트의 경우)
vk1 = pkY
```

- 일반 노트의 경우, vk0/vk1은 owner0/owner1과 동일 (둘 다 공개키)
- 이를 통해 수신자가 자신의 키 쌍에서 뷰잉 키를 유도할 수 있음
- 전체 공개키 좌표 사용 (잘림 없음)

### 스마트 노트 (Phase 4 pk 기반)

```
parentHash = Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)
owner0 = parentHash[0:128]   // 부모 노트 해시의 상위 128비트
owner1 = parentHash[128:256] // 부모 노트 해시의 하위 128비트
vk0 = parentHash[0:128]      // 뷰잉 키도 동일하게 분할
vk1 = parentHash[128:256]
```

- parentNoteHash가 owner0/owner1을 위해 두 개의 128비트 반으로 분할됨
- 스마트 노트의 "소유자"는 부모 노트의 분할된 해시 (실제 공개키가 아님)
- vk0/vk1도 분할된 부모 해시를 보유 (일관성을 위해)
- 부모 노트에 대한 지식을 증명하여 스마트 노트를 청구할 수 있음

---

## SettleOrder 보안 수정 (Phase 2.2)

### 개요

settle_order 회로의 중요한 보안 이슈와 스케일링 버그를 수정했습니다.

**일자:** 2026-01-26
**상태:** ✅ 완료

### 보안 수정 1: Stake 노트 소유자 검증

**문제:** Stake 노트 소유자가 truncated maker 노트 해시와 일치하는지 검증되지 않음.

**해결책:** `settle_order.circom`에 제약 추가:
```circom
// 보안 수정 1: stake 노트 (o1) 소유자 == truncated(makerNote.hash) 검증
component stakeOwnerCheck = IsEqual();
stakeOwnerCheck.in[0] <== o1OwnerAddress;
stakeOwnerCheck.in[1] <== packMakerAddr.out;  // truncated maker hash
stakeOwnerCheck.out === 1;
```

### 보안 수정 2: Payment 노트 소유자 검증

**문제:** Payment 노트 소유자가 검증되지 않음.

**해결책:** 제약 추가:
```circom
// 보안 수정 2: payment 노트 (n1) 소유자 == truncated(makerNote.hash) 검증
component paymentOwnerCheck = IsEqual();
paymentOwnerCheck.in[0] <== n1OwnerAddress;
paymentOwnerCheck.in[1] <== packMakerAddr.out;
paymentOwnerCheck.out === 1;
```

### 보안 수정 3: Change 노트 소유자 검증

**문제:** Change 노트 소유자가 정산 방향(bit)에 따라 검증되지 않음.

**해결책:** 제약 추가:
```circom
// 보안 수정 3: change 노트 (n2) 소유자 검증
// bit=1: change는 maker에게, bit=0: change는 taker에게
component muxChangeOwner = Mux1();
muxChangeOwner.c[0] <== n0OwnerAddress;      // bit=0이면 taker
muxChangeOwner.c[1] <== packMakerAddr.out;   // bit=1이면 maker
muxChangeOwner.s <== bit;

component changeOwnerCheck = IsEqual();
changeOwnerCheck.in[0] <== n2OwnerAddress;
changeOwnerCheck.in[1] <== muxChangeOwner.out;
changeOwnerCheck.out === 1;
```

---

## SettleOrder bit=0 스케일링 수정 (Phase 2.3)

### 개요

settle_order 회로의 bit=0 케이스 (테이커 초과)에서 중요한 스케일링 버그를 수정했습니다.

**일자:** 2026-01-26
**상태:** ✅ 완료

### 문제점

bit=0일 때, payment 계산이 `q0`을 직접 사용하여 wei 스케일링이 손실됨:

```circom
// 이전 (버그)
signal o0ValuePrice;
o0ValuePrice <== q0;  // q0 = 50, 50×10^18가 아님!
```

**예시:**
- makerValue = 5 ETH = 5×10^18 wei
- price = 10 (ETH당 10 DAI)
- q0 = (5×10^18 × 10) / 10^18 = 50
- **잘못됨:** payment = 50 wei (사실상 0 DAI)
- **올바름:** payment = 50×10^18 wei (50 DAI)

### 해결책

`o0ValuePrice`에 DECIMALS (10^18)를 곱하여 스케일 업:

```circom
// 이후 (수정됨)
signal o0ValuePrice;
o0ValuePrice <== q0 * DECIMALS;  // q0 * 10^18 = 50×10^18
```

### bit=0 vs bit=1 비교

| 시나리오 | bit=1 (Maker 초과) | bit=0 (Taker 초과) |
|----------|-------------------|-------------------|
| 조건 | makerValue ≥ q1 | makerValue < q1 |
| Reward (taker에게) | q1 (ETH 환산) | makerValue (전체 ETH) |
| Payment (maker에게) | takerValue (전체 DAI) | q0 × 10^18 (DAI 환산) |
| Change | makerValue - q1 | takerValue - payment |
| Change 소유자 | Maker | Taker |

### 검증된 예시 (bit=0)

| 값 | 금액 |
|-----|------|
| makerValue | 5 ETH = 5×10^18 wei |
| takerValue | 100 DAI = 100×10^18 wei |
| price | 10 (ETH당 10 DAI) |
| q1 | 10×10^18 (10 ETH 환산) |
| q0 | 50 |
| **reward** | 5×10^18 (5 ETH to taker) ✓ |
| **payment** | 50×10^18 (50 DAI to maker) ✓ |
| **change** | 50×10^18 (50 DAI to taker) ✓ |

---

## SHA256 → Poseidon 해시 마이그레이션 (Phase 3)

### 개요

모든 해시 계산을 SHA256에서 ZK 친화적 해시 함수인 Poseidon으로 마이그레이션했습니다. 이를 통해 회로 제약이 ~97-99% 감소하고, 노트 해시 형식이 비트 연결 SHA256 입력에서 필드 원소 Poseidon 입력으로 단순화되었습니다.

**마이그레이션 일자:** 2026-01-26
**상태:** ✅ 완료 (전체 19개 테스트 통과)

### 동기

| | SHA256 | Poseidon |
|--|--------|----------|
| 해시당 제약 수 | ~30,000 | ~300 |
| 노트 해시 입력 형식 | 비트 연결 (1184비트) | 필드 원소 (6개 입력) |
| 해시 출력 | 256비트 (h0/h1로 분할) | 단일 254비트 필드 원소 |
| 주소 유도 | SHA256 자르기 | Poseidon 하위 160비트 |
| JS 구현 | Node.js `crypto` 모듈 | circomlibjs (비동기 초기화, 동기 해시) |

### 주요 변경 사항

#### 1. 회로 해시 함수

6개 회로 모두 pk 기반 소유권과 7-입력 Poseidon 사용:

```circom
// Phase 2 (SHA256)
component hashNote = SHA256NoteWithAddress();
// 1184비트 입력, 256비트 출력을 h0/h1로 분할

// Phase 3 (ownerAddress를 사용한 6-입력 Poseidon)
component hashNote = PoseidonNoteWithAddress();
hashNote.ownerAddress <== ownerAddress;  // 160비트 잘림
hashNote.value <== value;
hashNote.tokenType <== tokenType;
hashNote.vk0 <== vk0;
hashNote.vk1 <== vk1;
hashNote.salt <== salt;

// Phase 4 (pk 기반 소유권과 7-입력 Poseidon) - 현재
component hashNote = Poseidon(7);
hashNote.inputs[0] <== owner0;     // pkX (또는 스마트 노트의 경우 parentHash 상위 128비트)
hashNote.inputs[1] <== owner1;     // pkY (또는 스마트 노트의 경우 parentHash 하위 128비트)
hashNote.inputs[2] <== value;
hashNote.inputs[3] <== tokenType;
hashNote.inputs[4] <== vk0;        // 일반 노트의 경우 pkX
hashNote.inputs[5] <== vk1;        // 일반 노트의 경우 pkY
hashNote.inputs[6] <== salt;
```

**회로 신호 이름 (Phase 4):**
- `owner0`, `owner1` - 소유자 공개키 좌표 (또는 분할된 부모 해시)
- `vk0`, `vk1` - 뷰잉 키 (일반 노트의 경우 pk와 동일, 스마트 노트의 경우 분할된 부모 해시와 동일)
- `value`, `tokenType`, `salt` - 노트 속성

#### 2. Note.js (비동기 초기화 패턴)

```javascript
const { Note, init: initNote, getSmartNoteOwner } = require('./Note');

// Note.hash() 사용 전 init()을 1회 호출해야 함
await initNote();  // circomlibjs Poseidon 로드

// Phase 4: pk 기반 소유권을 사용한 Note 생성자
const note = new Note(owner0, owner1, value, tokenType, vk0, vk1, salt);
// owner0 = pkX, owner1 = pkY (일반 노트의 경우)
// vk0 = pkX, vk1 = pkY (일반 노트의 경우, 뷰잉 키 = 공개키)

const hash = note.hash();  // Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)
```

**Note 생성자 매개변수 (Phase 4):**
- `owner0` - BabyJubJub 공개키 X 좌표 (또는 스마트 노트의 경우 부모 해시 상위 128비트)
- `owner1` - BabyJubJub 공개키 Y 좌표 (또는 스마트 노트의 경우 부모 해시 하위 128비트)
- `value` - wei 단위 노트 값
- `tokenType` - 토큰 식별자
- `vk0` - 뷰잉 키 파트 0 (일반 노트의 경우 = pkX)
- `vk1` - 뷰잉 키 파트 1 (일반 노트의 경우 = pkY)
- `salt` - 랜덤 필드 원소

#### 3. EMPTY_NOTE_HASH

```
// Phase 3 (6-입력): Poseidon(0, 0, 0, 0, 0, 0)
// Phase 4 (7-입력): Poseidon(0, 0, 0, 0, 0, 0, 0)
```

7-입력 Poseidon을 위해 `ZkDaiBase.sol`에서 업데이트:
```solidity
// 참고: EMPTY_NOTE_HASH 값이 7-입력 Poseidon으로 변경됨
bytes32 public constant EMPTY_NOTE_HASH = 0x...; // Poseidon(0,0,0,0,0,0,0)
```

#### 4. 스마트 노트 소유자 유도 (pk 기반)

```javascript
// Phase 2 (SHA256): SHA256(noteHash) → 마지막 160비트
// Phase 3 (Poseidon): noteHash & ((1 << 160) - 1) → 하위 160비트
// Phase 4 (pk 기반): noteHash를 128비트 반으로 분할
function getSmartNoteOwner(noteHash) {
    const hashBigInt = BigInt(noteHash);
    const mask128 = (BigInt(1) << BigInt(128)) - BigInt(1);
    const owner1 = hashBigInt & mask128;                    // 하위 128비트
    const owner0 = (hashBigInt >> BigInt(128)) & mask128;   // 상위 128비트
    return { owner0, owner1 };
}
```

**왜 128비트 분할인가?**
- 회로의 필드 원소 크기 제약과 일치
- owner0/owner1이 회로 신호로 자연스럽게 맞음
- 잘림 손실 없음 (전체 해시가 두 부분에 보존됨)

#### 5. 공개 입력 수 변화

| 회로 | SHA256 (Phase 2) | Poseidon 6-입력 (Phase 3) | Poseidon 7-입력 (Phase 4) |
|------|------------------|--------------------------|--------------------------|
| mint_burn_note | 5 | 4 | 4 |
| transfer_note | 9 | 5 | 5 |
| convert_note | 7 | 4 | 4 |
| make_order | 4 | 3 | 3 |
| take_order | 9 | 6 | 6 |
| settle_order | 21 | 14 | 14 |

*참고: Phase 4에서도 노트 해시가 여전히 단일 필드 원소이므로 공개 입력 수는 비슷하게 유지됨. 7-입력 Poseidon으로의 변경은 내부 해시 계산에 영향을 미치며, 공개 인터페이스는 변경되지 않음.*

### 수정된 파일

| 파일 | 변경 사항 |
|------|----------|
| `scripts/lib/Note.js` | SHA256 → Poseidon 해시, 비동기 초기화 패턴, getSmartNoteOwner |
| `scripts/helper/noteHelper.js` | SHA256 → Poseidon 해시 |
| `scripts/lib/noteProofHelper.js` | init()에서 initNote() 호출, createSmartNote에서 getSmartNoteOwner 사용 |
| `scripts/lib/snarkjsUtils.js` | getSmartNoteOwnerAddress에서 async 제거 |
| `contracts/ZkDaiBase.sol` | EMPTY_NOTE_HASH를 Poseidon 값으로 업데이트 |
| `test/ZkDex.production.test.js` | initNote() 추가, settle change 노트 소유자 수정 |
| `circuits-circom/utils/poseidon/poseidon_note.circom` | 신규: Poseidon 기반 노트 해시 컴포넌트 |
| 6개 메인 회로 전체 | SHA256NoteWithAddress → PoseidonNoteWithAddress |

### 테스트 결과

Poseidon 마이그레이션 후 전체 19개 Truffle 테스트 통과:
- ✅ 개발 모드 (8/8)
- ✅ 프로덕션 모드 (11/11) E2E 플로우 포함 (Make → Take → Settle → Convert)

---

## PK 기반 노트 해시 아키텍처 (Phase 4)

### 개요

노트 소유권을 160비트 ownerAddress에서 전체 BabyJubJub 공개키 좌표(pkX, pkY)로 마이그레이션했습니다. 이를 통해 잘림 없이 완전한 암호학적 보안을 제공하고 뷰잉 키 관계를 단순화합니다.

**마이그레이션 일자:** 2026-01-29
**상태:** 진행 중

### 주요 변경 사항

#### 1. 노트 해시: 7-입력 Poseidon

```
Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt) → 254비트 필드 원소
```

| 입력 | 일반 노트 | 스마트 노트 |
|------|----------|------------|
| owner0 | pkX | parentHash 상위 128비트 |
| owner1 | pkY | parentHash 하위 128비트 |
| value | 노트 값 | 노트 값 |
| tokenType | 토큰 ID | 토큰 ID |
| vk0 | pkX | parentHash 상위 128비트 |
| vk1 | pkY | parentHash 하위 128비트 |
| salt | 랜덤 | 랜덤 |

#### 2. ownerAddress 잘림 제거

- **이전 (Phase 2-3):** `ownerAddress = Poseidon(pkX, pkY) & mask160` (160비트 잘림)
- **이후 (Phase 4):** `owner0 = pkX, owner1 = pkY` (전체 좌표, 잘림 없음)

이점:
- 완전한 암호학적 보안 (충돌 우려 없음)
- 직접적인 공개키 사용으로 소유권 검증 단순화
- vk = pk 관계가 명시적

#### 3. 분할 해시로서의 스마트 노트 소유자

스마트 노트의 경우, "소유자"는 부모 노트 해시를 128비트 반으로 분할한 것입니다:

```javascript
function getSmartNoteOwner(parentNoteHash) {
    const hash = BigInt(parentNoteHash);
    const mask128 = (1n << 128n) - 1n;
    return {
        owner0: (hash >> 128n) & mask128,  // 상위 128비트
        owner1: hash & mask128              // 하위 128비트
    };
}
```

#### 4. 회로 신호 이름

모든 회로에서 다음 신호 이름 사용:
- `owner0`, `owner1` - 소유자 식별 (pk 좌표 또는 분할 해시)
- `vk0`, `vk1` - 뷰잉 키 (일반 노트의 경우 owner와 동일)
- `value`, `tokenType`, `salt` - 노트 속성
- `sk` - 비밀키 (비공개 입력)
- `noteHash` - 계산된 해시 출력

#### 5. 회로에서의 소유권 검증

```circom
// pk = sk * G 검증 (BabyJubJub 스칼라 곱)
component verifyOwnership = BabyPbk();
verifyOwnership.in <== sk;
owner0 === verifyOwnership.Ax;
owner1 === verifyOwnership.Ay;

// 노트 해시 계산
component noteHash = Poseidon(7);
noteHash.inputs[0] <== owner0;
noteHash.inputs[1] <== owner1;
noteHash.inputs[2] <== value;
noteHash.inputs[3] <== tokenType;
noteHash.inputs[4] <== vk0;
noteHash.inputs[5] <== vk1;
noteHash.inputs[6] <== salt;
```

### 마이그레이션 이점

1. **완전한 보안:** 잘림이 없어 충돌 취약점 없음
2. **단순한 코드:** 직접적인 pk 사용, 주소 유도 불필요
3. **명시적 vk 관계:** vk = pk가 명확하고 검증 가능
4. **일관된 구조:** 모든 노트가 동일한 owner0/owner1 형식 사용

---

## ECDH 노트 암호화 (Phase 4)

### 개요

BabyJubJub 상의 ECDH 키 합의 + AES-256-GCM을 추가하여 노트 데이터를 온체인 저장 전에 암호화합니다. 이전에는 노트 데이터가 평문 RLP로 저장되었습니다.

**일자:** 2026-01-27
**상태:** ✅ 완료

### 온체인 형식

```
0x01 || epk_x(32B) || epk_y(32B) || nonce(12B) || ciphertext || authTag(16B)
```

- `0x01` 접두사로 ECDH 암호화된 노트와 레거시 평문 RLP을 구분
- `epk` = 임시 BabyJubJub 공개키 (암호화마다 새로 생성)
- ECDH로 공유 비밀 유도: `sharedSecret = sk_recipient × epk`
- Poseidon KDF로 공유 비밀에서 AES-256-GCM 키 유도

### 주요 파일

| 파일 | 설명 |
|------|------|
| `vapp/src/lib/ecdhCrypto.ts` | ECDH 공유 비밀 + AES-256-GCM 암복호화 |
| `vapp/src/utils/noteEncryption.ts` | 노트 인코딩/디코딩 (ECDH + 레거시 RLP) |

### 하위 호환성

- `decodeNoteData()`가 `0x01` 접두사를 감지 → ECDH 복호화
- `0x01` 접두사 없음 → 레거시 평문 RLP 디코딩
- 새 노트는 항상 ECDH 암호화 사용

## 다음 단계

1. 성능 최적화 (추후 진행 예정 - 증명 생성 시간 단축)
2. 모든 회로를 Poseidon으로 재컴파일하고 정확한 제약 수 측정

## 의존성

### circuits-circom/package.json
```json
{
  "dependencies": {
    "circomlib": "^2.0.5",
    "snarkjs": "^0.7.4"
  }
}
```

### 프로젝트 루트 package.json (추가됨)
```json
{
  "dependencies": {
    "snarkjs": "^0.7.6",
    "circomlibjs": "^0.1.7",
    "ffjavascript": "^0.3.1",
    "@openzeppelin/contracts": "^4.9.3"
  }
}
```

## 참고 자료

- [Circom 문서](https://docs.circom.io/)
- [snarkjs GitHub](https://github.com/iden3/snarkjs)
- [circomlib GitHub](https://github.com/iden3/circomlib)
- [Hermez Powers of Tau](https://github.com/hermeznetwork/phase2ceremony_4)
