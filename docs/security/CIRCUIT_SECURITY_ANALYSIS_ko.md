# Circuit 보안 분석 및 계획된 아키텍처 변경 사항

**날짜**: 2026-01-29
**분석**: 보안 보고서 이슈 2.4, 2.5, 2.6 vs. 계획된 아키텍처 변경 사항

---

## 🔴 Circuit의 현재 보안 이슈

### 이슈 2.5: Smart Note 검증 불완전 (높은 심각도)

**영향받는 파일**: `convert_note.circom`, `settle_order.circom`

#### 문제 1: Parent Hash 재구성 시 필드 오버플로우

**convert_note.circom:70-72**:
```circom
signal smartParentReconstructed;
smartParentReconstructed <== smartOwner0 * (2**128) + smartOwner1;  // ⚠️ 오버플로우 위험!
smartParentReconstructed === originHash;
```

**settle_order.circom:141-143**:
```circom
signal o1ParentReconstructed;
o1ParentReconstructed <== o1Owner0 * (2**128) + o1Owner1;  // ⚠️ 오버플로우 위험!
o1ParentReconstructed === o0Hash;
```

**취약점**:
```
If owner0 >= 2^126:
  owner0 * 2^128 >= 2^254 > BN128_FIELD_PRIME
  → 필드 모듈러 리덕션 발생
  → 잘못된 parentHash 재구성
  → 공격자가 smart note 소유권 위조 가능
```

#### 문제 2: owner1에 대한 128비트 제약 조건 누락

**현재 검증**:
```circom
// convert_note.circom:65-66
component smartCheck = IsSmartStrict();
smartCheck.owner0 <== smartOwner0;  // ✅ owner0 < 2^128 검증
// ❌ smartOwner1에 대한 검증 없음!
```

**보안 보고서 권장 사항**:
```circom
// smartOwner1이 128비트 이내인지 검증
component owner1Bits = Num2Bits(254);
owner1Bits.in <== smartOwner1;
for (var i = 128; i < 254; i++) {
    owner1Bits.out[i] === 0;  // 상위 126비트는 0이어야 함
}
```

---

### 이슈 2.6: 나눗셈 Witness 검증 (중간 심각도)

**영향받는 파일**: `settle_order.circom`

**문제**: 나머지 범위가 강제되지 않음

```circom
// settle_order.circom:148-149
// 나눗셈 증명: o0Value * price = q0 * 10^18 + r0
o0Value * price === q0 * (10**18) + r0;

// ⚠️ 누락된 제약 조건: r0 < 10^18
// 공격자가 r0 >= 10^18을 설정하여 몫을 조작할 수 있음
```

**권장 수정 사항**:
```circom
// r0 < 10^18 강제
component r0LessThan = LessThan(252);
r0LessThan.in[0] <== r0;
r0LessThan.in[1] <== 10**18;
r0LessThan.out === 1;
```

---

### 이슈 2.4: Underconstrained 취약점 가능성 (높은 심각도)

**영향받는 파일**: 모든 circuit

**문제**: 일부 signal이 충분히 제약되지 않아 공격자가 조건부 로직에 임의의 값을 주입할 수 있음.

**필요한 검증 도구**:
```bash
# Circomspect (정적 분석)
circomspect circuits-circom/main/*.circom

# R1CS 제약 조건 분석
snarkjs r1cs info transfer_note.r1cs

# 모든 private input이 제약되었는지 검증
```

---

## ✅ 계획된 아키텍처 변경 사항 (이슈 2.5 해결 및 부분적으로 2.6 해결)

**참조**: 계획 파일 `quirky-sniffing-lovelace.md`

### 핵심 변경: Smart Note Hash 재설계

**현재 아키텍처** (6-input Poseidon):
```
noteHash = Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)
           where ownerAddress = truncate(Poseidon(pk.x, pk.y)) to 160 bits

smartNote:
  - owner0 = parentHash_hi (상위 128비트)
  - owner1 = parentHash_lo (하위 128비트)
  - 재구성 필요: parentHash = owner0 * 2^128 + owner1  ← 오버플로우 위험!
```

**새로운 아키텍처** (5-input 일반, 4-input smart):
```
Regular note:
  noteHash = Poseidon(pkX, pkY, value, tokenType, salt)  // 5 inputs

Smart note:
  smartNoteHash = Poseidon(parentHash, value, tokenType, salt)  // 4 inputs
  - parentHash가 전체 254비트 필드 요소로 저장됨
  - 160비트로의 truncation 없음
  - owner0/owner1로부터의 재구성 없음
```

### 이 변경이 이슈 2.5를 해결하는 방법

**변경 전** (현재):
```circom
// Smart note가 truncated address 사용 (owner0, owner1)
signal smartParentReconstructed;
smartParentReconstructed <== smartOwner0 * (2**128) + smartOwner1;  // 오버플로우!
smartParentReconstructed === originHash;
```

**변경 후** (새 아키텍처):
```circom
// Smart note가 전체 parentHash를 직접 사용
component smartHashComp = PoseidonSmartNote();  // 4 inputs
smartHashComp.parentHash <== parentHash;  // 전체 254비트 필드 요소
smartHashComp.value <== smartValue;
smartHashComp.tokenType <== smartType;
smartHashComp.salt <== smartSalt;
smartHashComp.out === smartHash;

// 직접 비교 - 재구성 필요 없음!
parentHash === originHash;  // ✅ 오버플로우 불가능
```

### 추가 이점

1. **Truncation 제거**:
   - `TruncateHashToAddress` 템플릿 불필요
   - 160비트 truncation 로직 없음
   - 전체 254비트 보안

2. **viewingKey 제거**:
   - `vk0`와 `vk1`은 circuit에서 사용되지 않음 (해시 입력에만 사용)
   - circuit 복잡도 감소
   - 증명 크기 감소

3. **ECDH 암호화 가능**:
   - note hash에 전체 pk가 포함되어 수신자가 복호화 가능
   - 현재 ownerAddress는 단방향 → pk 도출 불가 → ECDH 불가능

---

## 📋 Circuit 수정 체크리스트

### 수정할 Circuit (6개 메인 Circuit 전체)

#### 1. **mint_burn_note.circom**
- [ ] `PoseidonNoteWithAddress` → `PoseidonNoteWithPk` (5 inputs)로 교체
- [ ] private input 변경: `ownerAddress, vk0, vk1` → `pkX, pkY`
- [ ] 소유권 검증 업데이트: `VerifyOwnershipByAddressStrict` → `ProofOfOwnershipStrict`

#### 2. **transfer_note.circom**
- [ ] 4개 모든 note에 동일한 변경 적용 (o0, o1, new, change)
- [ ] signal 이름 업데이트: `o0OwnerAddress` → `o0PkX, o0PkY`
- [ ] 모든 viewingKey signal 제거

#### 3. **make_order.circom**
- [ ] `PoseidonNoteWithAddress` → `PoseidonNoteWithPk`로 교체
- [ ] private input에서 `vk0, vk1` 제거
- [ ] 소유권 검증 업데이트

#### 4. **take_order.circom**
- [ ] Old note: `PoseidonNoteWithPk` 사용 (5 inputs)
- [ ] **New note (stake): `PoseidonSmartNote` 사용 (4 inputs)** ✅
- [ ] public input 변경: `newOwnerAddress` (160비트) → `newParentHash` (254비트)
- [ ] truncation 로직 제거

#### 5. **settle_order.circom** ⚠️ 높은 우선순위
- [ ] Maker note (o0): `PoseidonNoteWithPk` 사용
- [ ] **Taker stake (o1): `PoseidonSmartNote` 사용** ✅ 이슈 2.5 해결
- [ ] **Output notes (n0, n1, n2): `PoseidonSmartNote` 사용** ✅ 이슈 2.5 해결
- [ ] **라인 141-143 제거 (o1ParentReconstructed)** ✅ 오버플로우 수정
- [ ] 직접 비교로 교체: `o1.parentHash === o0Hash`
- [ ] parentHash 필드를 포함하도록 public input 업데이트 (이미 존재: n0ParentHash, n1ParentHash)
- [ ] 모든 viewingKey signal 제거
- [ ] **나머지 범위 체크 추가 (이슈 2.6)**:
  ```circom
  component r0Check = LessThan(252);
  r0Check.in[0] <== r0;
  r0Check.in[1] <== 10**18;
  r0Check.out === 1;

  component r1Check = LessThan(252);
  r1Check.in[0] <== r1;
  r1Check.in[1] <== price;
  r1Check.out === 1;
  ```

#### 6. **convert_note.circom** ⚠️ 높은 우선순위
- [ ] **Smart note: `PoseidonSmartNote` 사용 (4 inputs)** ✅ 이슈 2.5 해결
- [ ] Origin note: `PoseidonNoteWithPk` 사용
- [ ] New note: `PoseidonNoteWithPk` 사용
- [ ] **라인 70-72 제거 (smartParentReconstructed)** ✅ 오버플로우 수정
- [ ] 직접 비교로 교체: `smartNote.parentHash === originHash`
- [ ] 모든 viewingKey signal 제거

### 추가/수정할 유틸리티 Circuit

#### `circuits-circom/utils/poseidon/poseidon_note.circom`
- [ ] `PoseidonNoteWithAddress` → `PoseidonNoteWithPk`로 이름 변경
- [ ] input 변경: `(owner0, owner1, value, tokenType, vk0, vk1, salt)` → `(pkX, pkY, value, tokenType, salt)`
- [ ] **새 템플릿 `PoseidonSmartNote` 추가**:
  ```circom
  template PoseidonSmartNote() {
      signal input parentHash;
      signal input value;
      signal input tokenType;
      signal input salt;
      signal output out;

      component hasher = Poseidon(4);
      hasher.inputs[0] <== parentHash;
      hasher.inputs[1] <== value;
      hasher.inputs[2] <== tokenType;
      hasher.inputs[3] <== salt;
      out <== hasher.out;
  }
  ```
- [ ] `EmptyNoteHash`를 5-input 버전으로 업데이트
- [ ] **`TruncateHashToAddress` 템플릿 삭제** (더 이상 필요 없음)

#### `circuits-circom/utils/babyjubjub/proof_of_ownership.circom`
- [ ] `ProofOfOwnershipStrict` 유지 (이미 존재)
- [ ] `VerifyOwnershipByAddress` 템플릿 삭제

#### `circuits-circom/utils/babyjubjub/get_address.circom`
- [ ] 선택 사항: 삭제하거나 표시 목적으로만 유지

---

## 🔧 Smart Contract 업데이트

### ZkDaiBase.sol
```solidity
// EMPTY_NOTE_HASH 변경
// 이전: Poseidon(0, 0, 0, 0, 0, 0, 0) - 7 inputs
bytes32 public constant EMPTY_NOTE_HASH = 0x0a47ead74da5372e7d2598e4f93c389bf03e8330219f8bf1e49b362f73491a26;

// 새로운: Poseidon(0, 0, 0, 0, 0) - 5 inputs
// circuit 변경 후 circomlibjs를 사용하여 재계산 필요
bytes32 public constant EMPTY_NOTE_HASH = <NEW_VALUE>;
```

### ZkDex.sol
```solidity
// takeOrder - 전체 해시 비교 사용
// 이전:
require(uint160(uint256(order.makerNote)) == input[4], "Invalid maker note");

// 새로운:
require(uint256(order.makerNote) == input[4], "Invalid maker note");

// settleOrder - 전체 해시 비교 사용
// 이전:
require(uint160(uint256(order.parentNote)) == input[6], "Invalid parent");
require(uint160(uint256(order.makerNote)) == input[9], "Invalid maker");

// 새로운:
require(uint256(order.parentNote) == input[6], "Invalid parent");
require(uint256(order.makerNote) == input[9], "Invalid maker");

// Order struct에서 makerViewingKey 제거
struct Order {
    bytes32 makerNote;
    bytes32 parentNote;  // 제거: uint256 makerViewingKey;
    uint256 tokenType;
    uint256 price;
    // ...
}
```

---

## 🧪 테스트 및 검증

### Circuit 검증
```bash
# 1. Circomspect로 정적 분석
circomspect circuits-circom/main/*.circom

# 2. 모든 circuit 컴파일
circom circuits-circom/main/convert_note.circom --r1cs --wasm --sym
circom circuits-circom/main/settle_order.circom --r1cs --wasm --sym
# ... 6개 모든 circuit에 대해

# 3. R1CS 제약 조건 분석
snarkjs r1cs info convert_note.r1cs
snarkjs r1cs info settle_order.r1cs

# 4. 새 검증 키 생성
snarkjs groth16 setup convert_note.r1cs pot28_final.ptau convert_note_0000.zkey
# ... 모든 circuit에 대해 setup ceremony
```

### Contract 테스트
```bash
# 새 verifier로 배포
truffle migrate --network development

# 모든 테스트 실행
truffle test
```

### 프론트엔드 테스트
```bash
cd vapp

# circuit input 업데이트
# circuitInputs.ts 변경 사항에 대한 자세한 내용은 계획 파일 참조

# 테스트 실행
npm run test

# 빌드
npm run build
```

---

## ⚠️ 호환성을 깨는 변경 사항

### 하드 포크 필요

다음 이유로 **모든 기존 온체인 note가 무효화됩니다**:
1. Note 해시 계산 변경 (일반 note는 7 inputs → 5 inputs, smart는 4)
2. Smart note 구조 변경 (owner0/owner1 분할 → 전체 parentHash)
3. 모든 note에서 viewingKey 제거

### 마이그레이션 불가능

다음 이유로 기존 note에 대한 **마이그레이션 경로가 없습니다**:
- 이전 note 해시를 새 해시 형식으로 변환할 수 없음
- truncated address로부터의 parentHash 재구성은 단방향

### 배포 전략

**옵션 1: 새로 배포**
- 새 네트워크/주소에 새 contract 배포
- 사용자는 모든 계정과 note를 다시 생성해야 함

**옵션 2: 테스트넷 먼저**
- 새 circuit으로 테스트넷에 배포
- 모든 기능 검증
- 그 후 별도 인스턴스로 메인넷에 배포

---

## 📊 보안 점수 영향

### 아키텍처 변경 전
- **Smart Contract 보안**: 90/100
- **ZK Circuit 보안**: 85/100 (이슈 2.4, 2.5, 2.6으로 인해)

### 아키텍처 변경 후
- **Smart Contract 보안**: 95/100 (+5)
- **ZK Circuit 보안**: 95/100 (+10)
  - 이슈 2.5 (높음): parentHash 재구성 제거로 **해결됨**
  - 이슈 2.6 (중간): 나머지 범위 체크 추가로 **해결됨**
  - 이슈 2.4 (높음): **부분적으로 해결됨** (Circomspect 검증 필요)

### 전체 보안 점수
- **변경 전**: B+ (85/100)
- **변경 후**: A (95-98/100)

---

## 🚀 권장 구현 순서

1. **즉시** (이미 완료된 보안 수정):
   - ✅ 프론트엔드 암호화 수정 (이슈 3.3, 3.5, 4.4, 3.4) - 완료
   - ✅ Contract 개발 모드 수정 (이슈 1.5) - 완료

2. **다음 스프린트** (Circuit 재설계):
   - 1주차: 유틸리티 circuit 수정 + 컴파일 + 테스트
   - 2주차: 메인 circuit 수정 (높은 우선순위: convert_note, settle_order)
   - 3주차: contract + verifier 업데이트
   - 4주차: 프론트엔드 업데이트 + E2E 테스트

3. **프로덕션 전**:
   - 모든 circuit에 Circomspect 실행
   - 새 circuit에 대한 공식 보안 감사
   - 테스트넷에 배포
   - 커뮤니티 테스트 기간

---

## 📚 참조

- 보안 분석 보고서: `docs/ZK-DEX_Security_Analysis_Report_EN.md`
- 아키텍처 계획: 계획 파일 `quirky-sniffing-lovelace.md`
- 보안 수정 (완료): `SECURITY_FIXES.md`
- 배포 가이드: `DEPLOYMENT_CHECKLIST.md`

---

**결론**: 사용자의 계획 파일에 있는 계획된 아키텍처 변경 사항은 근본 원인(parentHash 재구성)을 제거하여 높은 심각도의 circuit 이슈(2.5)를 **포괄적으로 해결합니다**. 이것은 추가 제약 조건으로 패치하는 것보다 더 나은 솔루션입니다. circuit을 단순화하고 공격 표면을 완전히 제거하기 때문입니다.
