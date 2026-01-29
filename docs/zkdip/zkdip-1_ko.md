# ZKDIP-1: 대체 가능한(Fungible) 스마트 노트

| 항목 | 내용 |
|------|------|
| **ZKDIP** | 1 |
| **제목** | 대체 가능한(Fungible) 스마트 노트 |
| **작성자** | ZK-DEX Team |
| **상태** | Draft |
| **타입** | Standards Track |
| **생성일** | 2026-01-29 |
| **관련 이슈** | Security Report 2.5 (Field Overflow), 2.6 (Division Remainder) |

---

## 요약

스마트 노트를 일반 노트와 **대체 가능**하게 만든다. DEX 거래뿐 아니라 일반 사용자에게도 전송 가능해야 함.

---

## 동기

### 현재 설계의 문제점

```
// 현재 스마트 노트 구조 (7 inputs)
smartNote = {
  owner0: parentHash_hi,    // 부모 해시 상위 128비트
  owner1: parentHash_lo,    // 부모 해시 하위 128비트
  value, tokenType,
  vk0: parentHash_hi,       // 중복
  vk1: parentHash_lo,       // 중복
  salt
}
```

**문제점**:
1. **오버플로우 위험**: `owner0 * 2^128 + owner1` 연산 시 owner0 >= 2^126이면 BN128 필드 오버플로우
2. **대체 불가능**: 부모 노트 소유자만 청구 가능 (수령인 지정 불가)
3. **전송 불가**: 스마트 노트를 다른 사용자에게 "보낼" 수 없음

### 보안 이슈 참조

**Issue 2.5 (High Severity)**: `convert_note.circom:70-72`, `settle_order.circom:141-143`에서 parentHash 재구성 시 필드 오버플로우 발생 가능.

```circom
signal smartParentReconstructed;
smartParentReconstructed <== smartOwner0 * (2**128) + smartOwner1;  // 오버플로우!
smartParentReconstructed === originHash;
```

---

## 명세

### 일반 노트 (5 inputs)

```circom
// PoseidonRegularNote
noteHash = Poseidon(pkX, pkY, value, tokenType, salt)
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `pkX` | Field (254-bit) | 소유자 BabyJubJub 공개키 X 좌표 |
| `pkY` | Field (254-bit) | 소유자 BabyJubJub 공개키 Y 좌표 |
| `value` | Field | 노트 금액 |
| `tokenType` | Field | 토큰 타입 (0=ETH, 1=DAI, ...) |
| `salt` | Field (254-bit) | 랜덤 솔트 |

**소유권 증명**: `sk → pk` 검증 (ProofOfOwnershipStrict)

### 스마트 노트 (6 inputs)

```circom
// PoseidonSmartNote
smartNoteHash = Poseidon(parentHash, recipientPkX, recipientPkY, value, tokenType, salt)
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `parentHash` | Field (254-bit) | 원본 노트의 전체 해시 (출처 추적) |
| `recipientPkX` | Field (254-bit) | 수령인 BabyJubJub 공개키 X 좌표 |
| `recipientPkY` | Field (254-bit) | 수령인 BabyJubJub 공개키 Y 좌표 |
| `value` | Field | 노트 금액 |
| `tokenType` | Field | 토큰 타입 |
| `salt` | Field (254-bit) | 랜덤 솔트 |

**소유권 증명**: `sk → recipientPk` 검증 (ProofOfOwnershipStrict)

---

## 근거

### 오버플로우 해결

**이전**:
```circom
// convert_note.circom:70-72 - 오버플로우 위험
signal smartParentReconstructed;
smartParentReconstructed <== smartOwner0 * (2**128) + smartOwner1;
smartParentReconstructed === originHash;
```

**이후**:
```circom
// 직접 비교 - 오버플로우 불가능
smartNote.parentHash === originHash;
```

### 대체 가능성

**이전**: 스마트 노트는 부모 노트 소유자만 청구 가능
```
Bob이 자신의 노트로 스마트 노트 생성 → Bob만 청구 가능
Alice에게 보낼 수 없음
```

**이후**: 스마트 노트를 누구에게나 전송 가능
```
Bob이 recipientPk = Alice의 pk로 스마트 노트 생성 → Alice가 청구 가능
일반 노트와 완전히 대체 가능
```

### DEX 호환성

```
takeOrder:
  - Taker가 스테이크 노트 생성
  - parentHash = maker의 노트 해시 (주문에 연결)
  - recipientPk = maker의 pk (maker가 청구 가능)

settleOrder:
  - stake.parentHash == makerNoteHash 검증 (올바른 주문)
  - maker가 sk → stake.recipientPk로 소유권 증명
```

---

## 회로 변경 사항

### 유틸리티 템플릿

#### `circuits-circom/utils/poseidon/poseidon_note.circom`

```circom
// 일반 노트 해시 (5 inputs)
template PoseidonRegularNote() {
    signal input pkX;
    signal input pkY;
    signal input value;
    signal input tokenType;
    signal input salt;
    signal output out;

    component hasher = Poseidon(5);
    hasher.inputs[0] <== pkX;
    hasher.inputs[1] <== pkY;
    hasher.inputs[2] <== value;
    hasher.inputs[3] <== tokenType;
    hasher.inputs[4] <== salt;
    out <== hasher.out;
}

// 스마트 노트 해시 (6 inputs)
template PoseidonSmartNote() {
    signal input parentHash;
    signal input recipientPkX;
    signal input recipientPkY;
    signal input value;
    signal input tokenType;
    signal input salt;
    signal output out;

    component hasher = Poseidon(6);
    hasher.inputs[0] <== parentHash;
    hasher.inputs[1] <== recipientPkX;
    hasher.inputs[2] <== recipientPkY;
    hasher.inputs[3] <== value;
    hasher.inputs[4] <== tokenType;
    hasher.inputs[5] <== salt;
    out <== hasher.out;
}

// 빈 일반 노트 해시 (5 inputs)
template EmptyRegularNoteHash() {
    signal output out;
    component hasher = Poseidon(5);
    for (var i = 0; i < 5; i++) {
        hasher.inputs[i] <== 0;
    }
    out <== hasher.out;
}

// 빈 스마트 노트 해시 (6 inputs)
template EmptySmartNoteHash() {
    signal output out;
    component hasher = Poseidon(6);
    for (var i = 0; i < 6; i++) {
        hasher.inputs[i] <== 0;
    }
    out <== hasher.out;
}
```

### 메인 회로

#### 1. `mint_burn_note.circom`

```
Public:  [noteHash, value, tokenType]
Private: [pkX, pkY, salt, sk]

변경:
- 제거: ownerAddress, vk0, vk1
- 추가: pkX, pkY (전체 공개키)
- 사용: PoseidonRegularNote (5 inputs)
- 사용: ProofOfOwnershipStrict (sk → pk)
```

#### 2. `transfer_note.circom`

```
Public:  [o0Hash, o1Hash, newHash, changeHash]
Private: 4개 노트 × (pkX, pkY, value, tokenType, salt) + sk0, sk1

변경:
- 모든 노트: PoseidonRegularNote (5 inputs) 사용
- 제거: 모든 노트에서 ownerAddress, vk0, vk1
- 소유권: ProofOfOwnershipStrict
```

#### 3. `make_order.circom`

```
Public:  [noteHash, tokenType]
Private: [pkX, pkY, value, salt, sk]

변경:
- 사용: PoseidonRegularNote (5 inputs)
- 제거: ownerAddress, vk0, vk1
```

#### 4. `take_order.circom`

```
Public:  [oldNoteHash, oldType, stakeNoteHash, parentHash, recipientPkX, recipientPkY, stakeType]
Private: old note (pkX, pkY, value, salt, sk) + stake note (value, salt)

변경:
- Old note: PoseidonRegularNote (5 inputs)
- Stake note: PoseidonSmartNote (6 inputs)
  - parentHash = maker의 노트 해시 (public input - 온체인 검증)
  - recipientPk = maker의 pk (public input - maker가 청구 가능)
```

#### 5. `settle_order.circom`

```
Public:  [o0Hash, o0Type,
          o1Hash, o1ParentHash, o1RecipientPkX, o1RecipientPkY, o1Type,
          n0Hash, n0ParentHash, n0RecipientPkX, n0RecipientPkY, n0Type,
          n1Hash, n1ParentHash, n1RecipientPkX, n1RecipientPkY, n1Type,
          n2Hash, n2Type,
          price]

변경:
- Maker note (o0): PoseidonRegularNote - sk로 증명
- Taker stake (o1): PoseidonSmartNote - parentHash == o0Hash 검증
- Output notes (n0, n1): PoseidonSmartNote - 수령인 지정
- Change note (n2): PoseidonRegularNote
```

**나눗셈 나머지 검증 추가 (Issue 2.6)**:
```circom
// r0 < 10^18 강제
component r0Check = LessThan(252);
r0Check.in[0] <== r0;
r0Check.in[1] <== 10**18;
r0Check.out === 1;

// r1 < price 강제
component r1Check = LessThan(252);
r1Check.in[0] <== r1;
r1Check.in[1] <== price;
r1Check.out === 1;
```

#### 6. `convert_note.circom`

```
Public:  [smartHash, originHash, newHash]
Private: smart note (parentHash, recipientPkX, recipientPkY, value, salt) +
         origin note (pkX, pkY, value, salt) +
         new note (pkX, pkY, value, salt) +
         sk

변경:
- Smart note: PoseidonSmartNote (6 inputs)
- Origin note: PoseidonRegularNote (5 inputs)
- New note: PoseidonRegularNote (5 inputs)
- 검증:
  - smartNote.parentHash === originHash (출처 확인)
  - ProofOfOwnershipStrict(sk, smartNote.recipientPk) (소유권 확인)
  - ProofOfOwnershipStrict(sk, originNote.pk) (원본 소유권 - 동일 사용자)
```

---

## 프론트엔드 변경

### `vapp/src/lib/circuitInputs.ts`

```typescript
// 일반 노트 데이터
interface RegularNoteData {
  pkX: string;      // hex
  pkY: string;      // hex
  value: string;    // hex
  token: string;    // hex (tokenType)
  salt: string;     // hex
}

// 스마트 노트 데이터
interface SmartNoteData {
  parentHash: string;      // hex (전체 254비트)
  recipientPkX: string;    // hex
  recipientPkY: string;    // hex
  value: string;           // hex
  token: string;           // hex
  salt: string;            // hex
}

// 일반 노트 해시 계산
async function computeRegularNoteHash(note: RegularNoteData): Promise<bigint> {
  return poseidonHash([
    hexToBigInt(note.pkX),
    hexToBigInt(note.pkY),
    hexToBigInt(note.value),
    hexToBigInt(note.token),
    hexToBigInt(note.salt)
  ]);
}

// 스마트 노트 해시 계산
async function computeSmartNoteHash(note: SmartNoteData): Promise<bigint> {
  return poseidonHash([
    hexToBigInt(note.parentHash),
    hexToBigInt(note.recipientPkX),
    hexToBigInt(note.recipientPkY),
    hexToBigInt(note.value),
    hexToBigInt(note.token),
    hexToBigInt(note.salt)
  ]);
}
```

### `vapp/src/stores/note.ts`

```typescript
interface Note {
  hash: string;
  // 일반 노트용
  pkX?: string;
  pkY?: string;
  // 스마트 노트용
  parentHash?: string;
  recipientPkX?: string;
  recipientPkY?: string;
  // 공통
  value: string;
  token: string;
  salt: string;
  state: NoteState;
  isSmart: boolean;
}
```

---

## 보안 고려사항

### 해결되는 이슈

| 이슈 | 심각도 | 상태 |
|------|--------|------|
| 2.5: Field Overflow in Parent Hash Reconstruction | High | **해결됨** |
| 2.6: Division Remainder Bounds | Medium | **해결됨** |

### 오버플로우 방지

- `owner0 * 2^128 + owner1` 재구성 연산 제거
- `parentHash`를 전체 254비트 필드 원소로 저장
- 직접 비교: `parentHash === originHash`

### 소유권 검증 강화

- 이전: 부모 노트 소유자만 청구 가능 (암묵적)
- 이후: 명시적 recipientPk - 누구나 스마트 노트를 받을 수 있음
- 소유권 검증: 표준 `sk → pk` 증명

---

## 하위 호환성

**하드 포크 필요** - 모든 기존 노트 무효화:

1. 일반 노트: 7 inputs → 5 inputs
2. 스마트 노트: 7 inputs → 6 inputs (다른 구조)
3. 해시 계산 방식 완전히 변경

### 마이그레이션

기존 온체인 노트는 새 해시 형식으로 변환 불가능. 재배포 필요.

**배포 전략**:
1. 테스트넷에서 새 회로 검증
2. 커뮤니티 테스트 기간
3. 메인넷에 새 인스턴스 배포

---

## 트레이드오프

### 장점
- 대체 가능한 스마트 노트 (누구에게나 전송 가능)
- 오버플로우 위험 없음
- 더 깔끔한 아키텍처
- 모든 노트에 표준 소유권 검증

### 단점
- 스마트 노트가 4 inputs 대신 6 inputs (제약 조건 더 많음)
- 호환성 깨짐 (하드 포크)
- 일부 회로에서 public inputs 더 많음

### 제약 조건 비교

| 노트 타입 | 현재 | 제안 |
|-----------|------|------|
| 일반 | 7 inputs (Poseidon-7) | 5 inputs (Poseidon-5) |
| 스마트 | 7 inputs (Poseidon-7) | 6 inputs (Poseidon-6) |

순 효과: 전체적으로 제약 조건 약간 감소 + 보안/기능 이점.

---

## 구현 순서

1. 유틸리티 회로 (`poseidon_note.circom`)
2. 메인 회로 (6개 회로)
3. 컴파일 + trusted setup
4. Solidity 컨트랙트 (verifiers + ZkDex)
5. 프론트엔드 TypeScript (circuitInputs, noteEncryption, stores)
6. Vue 컴포넌트
7. E2E 테스트

---

## 참조

- [Security Analysis Report](../ZK-DEX_Security_Analysis_Report_EN.md)
- [CIRCUIT_SECURITY_ANALYSIS.md](../../CIRCUIT_SECURITY_ANALYSIS.md)

---

## 저작권

이 문서는 MIT 라이선스에 따라 배포됩니다.
