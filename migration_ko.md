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
│   ├── sha256/
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
| mint_burn_note | [output, nh0, nh1, value, tokenType] | 5 |
| transfer_note | [output, o0h0, o0h1, o1h0, o1h1, nh0, nh1, changeH0, changeH1] | 9 |
| convert_note | [output, smartH0, smartH1, originH0, originH1, nh0, nh1] | 7 |
| make_order | [output, nh0, nh1, tokenType] | 4 |
| take_order | [output, oh0, oh1, oType, nh0, nh1, nOwner0, nOwner1, nType] | 9 |
| settle_order | [output, o0h*, o1h*, n0h*, n1h*, n2h*, price] | 21 |

### 회로 복잡도

| 회로 | 비선형 제약 | 선형 제약 | wires |
|------|-----------|----------|-------|
| mint_burn_note | 125,679 | 5,294 | 129,725 |
| make_order | 125,679 | 5,294 | 129,725 |
| take_order | 247,664 | 10,537 | 255,702 |
| convert_note | 369,396 | 15,657 | 381,303 |
| transfer_note | 494,825 | 20,818 | 510,646 |
| settle_order | 614,380 | 26,275 | 634,399 |

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

### 4. SHA256 해시 포맷 호환성 ✓

**문제**: circom 회로의 SHA256 입력 포맷과 JavaScript 구현의 일치 확인 필요

**해결**: `test/sha256-hash-test.js`에서 검증 완료
- JavaScript Note.hash()와 circom SHA256_1536bit 출력이 일치함을 확인

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
- owner = 다른 노트의 해시 (128비트씩 분할)
- reward 노트: owner = taker의 parent note
- payment 노트: owner = maker note
- change 노트: owner = taker의 parent note

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
   - `test/boundary-edge-cases.test.js` - 33개 테스트 모두 통과
   - 회로 동작의 경계값과 엣지 케이스 검증

### 경계값 및 엣지 케이스 테스트 결과 (33/33 통과)

```bash
node test/boundary-edge-cases.test.js
```

| 테스트 카테고리 | 테스트 항목 | 결과 |
|---------------|-----------|------|
| 경계값 테스트 | value=0, 1 wei, 1 ETH, 2^128-1, 10^30, 토큰 타입, salt 경계 | 9/9 ✓ |
| 엣지 케이스 | 빈 노트 해시, 동일 값 노트, 자기 전송, 균등 분할, 전액 전송, 2개 입력 | 7/7 ✓ |
| 가격 계산 | price=1 (1:1), 정확한 나눗셈, 큰 가격 (100), 부분 체결 | 4/4 ✓ |
| 스마트 노트 | 스마트 노트 생성, 식별, 변환 | 3/3 ✓ |
| 해시 일관성 | 결정론적, 값 변경, 토큰 변경, 소유자 변경, 128비트 분할 | 5/5 ✓ |
| 증명 포맷 | 구조 검증, hex 값, 회로 차이 | 3/3 ✓ |
| MakeOrder/TakeOrder | 최소 값, stake 노트 생성 | 2/2 ✓ |

## Docker 환경

### 파일 구조

```
Dockerfile              # 조건부 빌드 (로컬 artifacts 있으면 사용)
docker-compose.yml      # 서비스 구성
.dockerignore           # 제외 파일 목록
```

### Dockerfile 특징

- **조건부 빌드**: 로컬에 `circuits-circom/build/*.zkey` 파일이 있으면 그대로 사용
- 없으면 자동으로 ptau 다운로드 + 회로 컴파일 + 신뢰 설정 수행
- Circom 컴파일러는 Rust에서 빌드 (multi-stage build)

### 서비스 구성

| 서비스 | 설명 | 프로필 |
|--------|------|--------|
| `ganache` | 로컬 이더리움 블록체인 | 기본 |
| `zkdex` | 테스트 실행 | 기본 |
| `zkdex-dev` | 개발용 쉘 | dev |
| `test-frontend` | 프론트엔드 테스트 | test |
| `test-production` | 프로덕션 테스트 | test |

### 사용 방법

```bash
# 빌드 (로컬 빌드 결과물 사용시 빠름)
docker compose build zkdex

# 테스트 실행
docker compose up zkdex

# 개발 모드 (쉘 접속)
docker compose --profile dev up zkdex-dev

# 프론트엔드 테스트
docker compose --profile test up test-frontend

# 프로덕션 테스트
docker compose --profile test up test-production

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

## 다음 단계

1. 성능 최적화 (추후 진행 예정 - 증명 생성 시간 단축)

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
