# ZK-DEX 핵심 개념 가이드

ZK-DEX 구현에 사용된 모든 개념적 요소를 정리한 문서.

---

## 목차

1. [노트 (Note)](#1-노트-note)
2. [노트 해시 (Note Hash)](#2-노트-해시-note-hash)
3. [노트 상태 (Note State)](#3-노트-상태-note-state)
4. [계정 (Account)](#4-계정-account)
5. [ZK 계정 (ZK Account)](#5-zk-계정-zk-account)
6. [소유권 모델 (Ownership Model)](#6-소유권-모델-ownership-model)
7. [노트 생성 — Mint](#7-노트-생성--mint)
8. [노트 소각 — Liquidate](#8-노트-소각--liquidate)
9. [노트 전송 — Transfer (Spend)](#9-노트-전송--transfer-spend)
10. [스마트 노트 (Smart Note)](#10-스마트-노트-smart-note)
11. [노트 변환 — Convert](#11-노트-변환--convert)
12. [주문 생성 — Make Order](#12-주문-생성--make-order)
13. [주문 수락 — Take Order](#13-주문-수락--take-order)
14. [주문 체결 — Settle Order](#14-주문-체결--settle-order)
15. [암호학 기본 요소](#15-암호학-기본-요소)
16. [노트 암호화 (ECDH)](#16-노트-암호화-ecdh)
17. [프라이버시 모델](#17-프라이버시-모델)
18. [보안 속성](#18-보안-속성)

---

## 1. 노트 (Note)

**노트**는 ZK-DEX의 기본 가치 단위로, Bitcoin의 UTXO와 유사한 개념이다. 각 노트는 특정 토큰의 특정 금액에 대한 소유권을 나타내는 암호학적 커밋먼트(commitment)다.

### 노트 구조 (5개 필드)

| 필드 | 크기 | 설명 |
|------|------|------|
| `ownerAddress` | 160비트 | 소유자의 BabyJubJub 공개키에서 Poseidon 해시로 파생된 주소 |
| `value` | 254비트 | 토큰 보유량 (wei 단위) |
| `tokenType` | 256비트 | 토큰 종류 (0 = ETH, 1 = DAI) |
| `viewingKey` | 256비트 | 소유자의 공개키에서 파생, 두 개의 128비트로 분할하여 회로에 입력 |
| `salt` | 254비트 | 무작위 값, 동일 조건의 노트가 같은 해시를 갖는 것을 방지 |

### 빈 노트 (Empty Note)

모든 필드가 0인 특수 노트. 전송 회로에서 입력 노트가 1개일 때 두 번째 슬롯을 채우는 데 사용한다.

```
EMPTY_NOTE_HASH = Poseidon(0, 0, 0, 0, 0, 0)
                = 0x1fdb1d1757a3a3502bec7084abc047ae86a4f442b8a073d5b3482bb02eb353d5
```

---

## 2. 노트 해시 (Note Hash)

노트의 5개 필드를 Poseidon 해시 함수에 입력하여 하나의 필드 원소(254비트)로 압축한 값. 온체인에서는 이 해시만 저장되므로, 원본 필드를 알지 못하면 노트의 내용을 알 수 없다.

```
noteHash = Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)
```

여기서 `vk0`, `vk1`은 `viewingKey`를 128비트씩 분할한 값이다:
```
vk0 = viewingKey >> 128      (상위 128비트)
vk1 = viewingKey & (2^128-1) (하위 128비트)
```

분할 이유: Circom 회로의 필드 크기가 254비트이므로 256비트 값을 직접 다룰 수 없어 두 조각으로 나눈다.

---

## 3. 노트 상태 (Note State)

온체인 컨트랙트에서 각 노트 해시의 생명주기를 추적하는 상태 머신:

```
Invalid ──(mint/transfer)──▶ Valid ──(spend)──▶ Spent
                               │
                               └──(makeOrder/takeOrder)──▶ Trading
```

| 상태 | 값 | 설명 |
|------|---|------|
| `Invalid` | 0 | 존재하지 않거나 이미 소비된 노트 |
| `Valid` | 1 | 유효한 노트, 전송/소각/주문 가능 |
| `Trading` | 2 | 주문에 잠긴 노트, 직접 전송 불가 |
| `Spent` | 3 | 소비 완료, 재사용 불가 |

### 상태 전이 규칙

- **Mint**: `Invalid → Valid` (새 노트 생성)
- **Transfer**: 입력 `Valid → Spent`, 출력 `Invalid → Valid`
- **Liquidate**: `Valid → Spent` (소각)
- **MakeOrder**: `Valid → Trading` (거래 잠금)
- **SettleOrder**: 입력 `Trading → Spent`, 출력 `Invalid → Valid`
- **ConvertNote**: 스마트 노트 `Valid → Invalid`, 새 노트 `Invalid → Valid`

---

## 4. 계정 (Account)

ZK-DEX에서 "계정"은 두 가지 키 체계를 모두 포함한다:

### Ethereum 계정 (MetaMask)
- 표준 secp256k1 키 쌍
- 컨트랙트 호출 및 ETH/DAI 입출금에 사용
- MetaMask 지갑으로 관리

### ZK 계정 (BabyJubJub)
- BabyJubJub 곡선 위의 키 쌍
- 노트 소유권 증명 및 프라이버시 보장에 사용
- scrypt 기반 키스토어(JSON)로 로컬 저장

하나의 사용자는 두 계정을 모두 보유하며, Ethereum 계정은 트랜잭션 전송에, ZK 계정은 노트 소유/암호화에 사용한다.

---

## 5. ZK 계정 (ZK Account)

ZK 계정은 BabyJubJub 타원곡선에 기반한 키 체계다. 주요 구성 요소:

### 비밀키 (Secret Key, sk)
- 254비트 무작위 스칼라
- BN128 필드 내에서 유효해야 함 (순서 `l`보다 작아야 함)
- 노트 소유권을 증명하는 유일한 수단

### 공개키 (Public Key, pk)
- BabyJubJub 곡선 위의 점 `(x, y)`
- 비밀키에서 파생: `pk = sk × G` (G는 생성자 점 BASE8)
- 직접 공개되지 않음 — 주소 파생에만 사용

### 소유자 주소 (Owner Address)
- 공개키에서 Poseidon 해시로 파생한 160비트 값
- `ownerAddress = Poseidon(pk.x, pk.y) & MASK_160`
- Ethereum 주소(160비트)와 동일한 크기

### 뷰잉 키 (Viewing Key)

공개키에서 Poseidon 해시로 파생한 전체 254비트 값.

```
viewingKey = Poseidon(pk.x, pk.y)
```

#### 왜 뷰잉 키가 필요한가?

ZK-DEX의 노트 해시는 6개 필드의 Poseidon 해시다:
```
noteHash = Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)
```

이때 `ownerAddress`(160비트)만으로는 노트를 고유하게 식별하기에 불충분하다. 같은 주소, 같은 금액, 같은 토큰의 노트가 여러 개 존재할 수 있기 때문이다. `salt`가 고유성을 보장하지만, 그것만으로는 소유자의 공개키 정보가 해시에 커밋(commit)되지 않는다.

**뷰잉 키는 공개키 전체(254비트)를 노트 해시에 바인딩하는 역할을 한다.** 160비트 주소만 포함하면 94비트의 공개키 정보가 손실되는데, 뷰잉 키를 통해 이 정보를 해시에 포함시킨다.

#### 뷰잉 키의 7가지 역할

**역할 1: 노트 해시 커밋먼트 (Note Hash Commitment)**

뷰잉 키는 128비트씩 분할(vk0, vk1)되어 노트 해시의 4번째·5번째 입력으로 들어간다. 이를 통해 노트 해시가 소유자의 공개키에 암호학적으로 바인딩된다.

```
vk0 = viewingKey >> 128      (상위 128비트)
vk1 = viewingKey & (2^128-1) (하위 128비트)

noteHash = Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)
                                                    ^^^  ^^^
                                        공개키 정보가 여기에 커밋됨
```

만약 뷰잉 키 없이 `Poseidon(ownerAddress, value, tokenType, salt)`만 사용한다면, 동일한 주소를 가진 다른 공개키로도 같은 해시를 생성할 수 있어 소유권 위조가 가능해진다.

**역할 2: 소유자 주소 내포 (Address Embedding)**

소유자 주소는 뷰잉 키의 하위 160비트와 정확히 일치한다:

```
ownerAddress = viewingKey & MASK_160
```

따라서 뷰잉 키를 알면 소유자 주소를 복원할 수 있고, 역으로 소유자 주소는 뷰잉 키의 일부분이다. 이 관계는 회로 안에서 자동으로 보장된다.

**역할 3: 노트 탐색 (Note Discovery)**

뷰잉 키를 아는 사람은 온체인에 저장된 암호화된 노트 중 자신에게 속한 것을 식별할 수 있다:

```
1. 온체인 NoteStateChange 이벤트 수신
2. encryptedNotes[noteHash]에서 암호화된 데이터 조회
3. ECDH 복호화 시도 (자신의 비밀키 사용)
4. 복호화 성공 → 노트 필드 복원 (ownerAddress, value, token, vk, salt)
5. 복원된 vk가 자신의 뷰잉 키와 일치하면 자신의 노트
```

지갑(Wallet)은 이 과정을 자동화하여 사용자의 모든 노트를 추적한다.

**역할 4: 선택적 공개 (Selective Disclosure)**

뷰잉 키를 제3자에게 공유하면, 해당 계정의 모든 노트를 조회할 수 있게 된다 (Zcash의 viewing key 방식). 비밀키를 공유하지 않으므로 노트를 소비할 수는 없다.

| 공유 대상 | 할 수 있는 것 | 할 수 없는 것 |
|-----------|--------------|--------------|
| 뷰잉 키 보유자 | 노트 잔액 조회, 거래 이력 확인 | 노트 전송, 소비, 주문 |
| 비밀키 보유자 | 위 모든 것 + 노트 전송/소비/주문 | — |

예: 감사인에게 뷰잉 키를 공유하면 자산을 열람할 수 있지만 이동시킬 수 없다.

**역할 5: 주문 메타데이터 (Order Metadata)**

메이커가 주문을 생성할 때 `makerViewingKey`를 온체인에 저장한다:

```solidity
struct Order {
    bytes32 makerViewingKey;  // ← 뷰잉 키 저장
    bytes32 makerNote;
    ...
}
```

이를 통해:
- 테이커가 메이커의 노트 구조를 이해하고 스테이크 노트를 올바르게 생성
- 주문 해시(`hashOrder`)에 뷰잉 키가 포함되어 주문 고유성 보장
- 메이커의 신원(비밀키)은 노출되지 않으면서 거래 상대방이 주문을 검증 가능

**역할 6: 스마트 노트에서의 부모 연결 (Smart Note Linking)**

스마트 노트의 경우 뷰잉 키가 일반적인 `Poseidon(pk.x, pk.y)`가 아니라 **부모 노트의 해시**로 설정된다:

```
일반 노트:   viewingKey = Poseidon(pk.x, pk.y)
스마트 노트: viewingKey = parentNoteHash
```

이 설계를 통해:
- 스마트 노트의 소유자 주소 = `parentNoteHash & MASK_160`
- 부모 노트의 소유자만 `convertNote`로 스마트 노트를 일반 노트로 변환 가능
- 주문 체결(settle) 시 출력 노트가 올바른 당사자에게 귀속되는 것을 보장

**역할 7: 암호화된 노트 데이터에 포함 (Encrypted Note Payload)**

노트가 ECDH로 암호화되어 온체인에 저장될 때, 뷰잉 키는 암호화된 페이로드의 일부로 포함된다:

```
암호화 전 평문: RLP([ownerAddress, value, tokenType, viewingKey, salt])
암호화 후:     0x01 || epk || nonce || AES-GCM(plaintext) || authTag
```

수신자가 복호화하면 뷰잉 키를 복원할 수 있고, 이를 통해 노트의 완전한 해시를 재계산하여 온체인 상태와 대조할 수 있다.

#### 뷰잉 키가 없다면?

뷰잉 키 없이 `ownerAddress`(160비트)만 사용하는 경우 발생하는 문제:

1. **공개키 바인딩 손실**: 160비트 주소 충돌 가능성이 이론적으로 존재. 서로 다른 공개키가 같은 주소를 가질 때, 뷰잉 키가 없으면 노트 해시가 동일해져 소유권 혼동 발생
2. **노트 탐색 불가**: 노트가 누구의 것인지 식별하려면 공개키 전체 정보가 필요. 160비트 주소만으로는 복호화 후 검증 단계에서 확신도가 낮아짐
3. **스마트 노트 불가능**: 스마트 노트의 `viewingKey = parentNoteHash` 메커니즘이 작동하지 않아, 주문 체결 시 노트 간 연결을 강제할 수단이 없어짐

### 키 파생 체인

```
sk (254비트 무작위)
  │
  ▼ BabyJubJub 스칼라 곱셈 (sk × G)
pk (x, y) — BabyJubJub 곡선 위의 점
  │
  ▼ Poseidon(pk.x, pk.y)
viewingKey (254비트)
  │
  ├── vk0 = viewingKey >> 128     (상위 128비트)
  ├── vk1 = viewingKey & MASK_128 (하위 128비트)
  │
  ▼ 하위 160비트 절단
ownerAddress (160비트)
```

---

## 6. 소유권 모델 (Ownership Model)

ZK-DEX는 **주소 기반 소유권** 모델을 사용한다. 노트 소유를 증명하려면 다음을 ZK 회로 안에서 검증한다:

1. 비밀키 `sk`에서 공개키 `pk` 파생: `pk = sk × G`
2. 공개키에서 주소 파생: `addr = Poseidon(pk.x, pk.y) & MASK_160`
3. 파생된 주소가 노트의 `ownerAddress`와 일치하는지 확인

이 과정은 회로 내부에서 수행되므로 `sk`와 `pk`는 외부에 공개되지 않는다. 온체인에서는 ZK 증명이 유효한지만 검증하면 되므로, 소유자의 신원이 보호된다.

### VerifyOwnershipByAddress (회로 컴포넌트)

```
입력: sk, expectedAddress
내부: pk = sk × G
      addr = Poseidon(pk.x, pk.y) truncated to 160-bit
출력: result = (addr == expectedAddress) ? 1 : 0
```

---

## 7. 노트 생성 — Mint

ETH 또는 DAI를 컨트랙트에 입금하고, 해당 금액에 대한 새로운 노트를 생성하는 연산.

### 회로: MintNBurnNote

**공개 입력 (4개)**:
| 인덱스 | 이름 | 설명 |
|--------|------|------|
| 0 | output | 항상 1 (유효성 마커) |
| 1 | noteHash | 생성할 노트의 해시 |
| 2 | value | 입금 금액 (공개 — `msg.value` 검증 필요) |
| 3 | tokenType | 토큰 종류 (공개) |

**비공개 입력**: ownerAddress, vk0, vk1, salt, sk

**검증 내용**:
1. `sk`로부터 `ownerAddress` 소유권 증명
2. 노트 해시가 공개 입력 `noteHash`와 일치하는지 확인
3. 노트의 `value`와 `tokenType`이 공개 입력과 일치하는지 확인

### 온체인 동작

```solidity
function mint(a, b, c, input, encryptedNote) external payable {
    // ETH: msg.value == input[2] 검증
    // DAI: transferFrom(msg.sender, address(this), input[2])
    // 증명 검증 후 notes[noteHash] = Valid
    // 암호화된 노트 데이터 저장
}
```

**핵심**: `value`가 공개 입력인 이유는 컨트랙트가 실제 입금액(`msg.value` 또는 DAI 전송량)과 노트의 값이 일치하는지 검증해야 하기 때문이다. 이것은 시스템 경계(외부 자산 ↔ ZK 노트)에서 불가피한 정보 공개다.

---

## 8. 노트 소각 — Liquidate

노트를 소각하고 해당 금액의 ETH 또는 DAI를 지정 주소로 인출하는 연산.

### 회로: MintNBurnNote (Mint과 동일 회로 재사용)

**공개 입력 (4개)**: output, noteHash, value, tokenType (Mint과 동일 구조)

**검증 내용**: Mint과 동일 — 소유권 증명 + 해시 일치 + 값/토큰 일치

### 온체인 동작

```solidity
function liquidate(to, a, b, c, input) external {
    // 증명 검증 후 notes[noteHash] = Spent
    // ETH: to.transfer(value) 또는 DAI: dai.transfer(to, value)
}
```

**상태 변화**: `Valid → Spent`

---

## 9. 노트 전송 — Transfer (Spend)

1~2개의 입력 노트를 소비하고 2개의 출력 노트(수신자 + 거스름돈)를 생성하는 연산. 금액과 소유자가 완전히 비공개로 처리된다.

### 회로: TransferNote

**공개 입력 (5개)**:
| 인덱스 | 이름 | 설명 |
|--------|------|------|
| 0 | output | 항상 1 |
| 1 | o0Hash | 입력 노트 0의 해시 |
| 2 | o1Hash | 입력 노트 1의 해시 (1개만 전송 시 EMPTY_NOTE_HASH) |
| 3 | newHash | 수신자 노트의 해시 |
| 4 | changeHash | 거스름돈 노트의 해시 |

**비공개 입력**:
- 입력 노트 0, 1의 전체 필드 (ownerAddress, value, tokenType, vk0, vk1, salt)
- 출력 노트 2개의 전체 필드
- 비밀키 sk0, sk1

**검증 내용**:
1. 입력 노트 0의 소유권 증명 (`sk0` → 주소 일치)
2. 입력 노트 1의 소유권 증명 (빈 노트가 아닌 경우)
3. 4개 노트의 해시가 각각 공개 입력과 일치
4. **가치 보존**: `input0.value + input1.value == new.value + change.value`
5. **토큰 일관성**: 모든 노트의 `tokenType`이 동일

### 핵심 속성

- `value`가 공개 입력에 포함되지 않으므로 전송 금액이 비공개
- `ownerAddress`가 공개 입력에 포함되지 않으므로 수신자가 비공개
- 가치 보존은 회로 내부에서만 검증 — 외부에서는 해시만 보임

---

## 10. 스마트 노트 (Smart Note)

**스마트 노트**는 소유자가 사용자의 공개키가 아닌 **다른 노트의 해시**에서 파생된 특수 노트다. 주문(order) 프로토콜에서 노트 간 연결 관계를 암호학적으로 강제하는 데 사용한다.

### 일반 노트 vs 스마트 노트

| 속성 | 일반 노트 | 스마트 노트 |
|------|-----------|------------|
| ownerAddress | `Poseidon(pk.x, pk.y) & MASK_160` | `parentNoteHash & MASK_160` |
| viewingKey | `Poseidon(pk.x, pk.y)` | `parentNoteHash` |
| 생성 시점 | mint, transfer | takeOrder, settleOrder |
| 소유권 증명 | 비밀키로 직접 증명 | 부모 노트 소유자만 convertNote로 변환 가능 |

### 스마트 노트 감지

스마트 노트의 소유자 주소는 254비트 해시의 하위 160비트이므로 상위 비트가 비어있을 확률이 높다. 회로에서는 `ownerAddress < 2^128`인지 확인하여 스마트 노트를 구별한다.

### 사용 목적

주문에서 "이 노트는 특정 다른 노트와 연결되어 있다"를 암호학적으로 증명하는 메커니즘. 예를 들어, 테이커의 스테이크 노트는 메이커 노트 해시에서 소유자가 파생되므로, 메이커만이 해당 스테이크를 최종적으로 사용할 수 있다.

---

## 11. 노트 변환 — Convert

스마트 노트를 일반 노트로 변환하는 연산. 스마트 노트의 원본(origin) 노트 소유자만 수행할 수 있다.

### 회로: ConvertNote

**공개 입력 (4개)**:
| 인덱스 | 이름 | 설명 |
|--------|------|------|
| 0 | output | 항상 1 |
| 1 | smartHash | 변환 대상 스마트 노트의 해시 |
| 2 | originHash | 원본 노트의 해시 (스마트 노트의 부모) |
| 3 | newHash | 변환 결과 일반 노트의 해시 |

**비공개 입력**: 스마트/원본/새 노트의 전체 필드 + sk

**검증 내용**:
1. 스마트 노트의 `ownerAddress == originHash & MASK_160` (연결 확인)
2. 원본 노트의 소유권 증명 (`sk` → 주소 일치)
3. 3개 노트의 해시가 공개 입력과 일치
4. **가치 보존**: `smartNote.value == newNote.value`
5. **토큰 보존**: `smartNote.tokenType == newNote.tokenType`

### 온체인 동작

```solidity
function convertNote(a, b, c, input, encryptedNote) external {
    // notes[smartHash] = Invalid (스마트 노트 소멸)
    // notes[newHash] = Valid (새 일반 노트 생성)
}
```

---

## 12. 주문 생성 — Make Order

메이커가 보유 노트를 기반으로 거래 주문을 생성하는 연산.

### 회로: MakeOrder

**공개 입력 (3개)**:
| 인덱스 | 이름 | 설명 |
|--------|------|------|
| 0 | output | 항상 1 |
| 1 | noteHash | 메이커 노트의 해시 |
| 2 | tokenType | 메이커가 제공하는 토큰 종류 (공개) |

**비공개 입력**: ownerAddress, value, vk0, vk1, salt, sk

**검증 내용**:
1. 메이커 노트의 소유권 증명
2. 노트 해시 일치 확인
3. `value`는 비공개 유지

### 온체인 동작

```solidity
function makeOrder(makerViewingKey, targetToken, price, a, b, c, input) external {
    // Order 구조체 생성:
    //   - makerViewingKey: 메이커의 뷰잉 키 (주문 조회용)
    //   - makerNote: 메이커 노트 해시
    //   - sourceToken: 메이커가 제공하는 토큰 (input[2])
    //   - targetToken: 메이커가 원하는 토큰
    //   - price: 교환 비율
    //   - state: Created
    // notes[makerNote] = Trading (거래 잠금)
}
```

### Order 구조체

```solidity
struct Order {
    bytes32 makerViewingKey;    // 메이커 뷰잉 키
    bytes32 makerNote;          // 메이커 노트 해시
    uint256 sourceToken;        // 메이커 토큰 종류
    uint256 targetToken;        // 원하는 토큰 종류
    uint256 price;              // 교환 비율 (10^18 단위)
    bytes32 takerNoteToMaker;   // 테이커 스테이크 노트
    bytes32 parentNote;         // 테이커 부모 노트
    OrderState state;           // Created → Taken → Settled
}
```

---

## 13. 주문 수락 — Take Order

테이커가 메이커의 주문에 자산을 스테이크하여 수락하는 연산. 테이커의 노트에서 메이커에게 연결된 **스마트 노트**를 생성한다.

### 회로: TakeOrder

**공개 입력 (6개)**:
| 인덱스 | 이름 | 설명 |
|--------|------|------|
| 0 | output | 항상 1 |
| 1 | parentNoteHash | 테이커의 부모(원본) 노트 해시 |
| 2 | parentNoteType | 부모 노트의 토큰 종류 |
| 3 | stakeNoteHash | 생성되는 스테이크 노트(스마트 노트) 해시 |
| 4 | stakeNoteOwner | 메이커 노트 해시의 하위 160비트 |
| 5 | stakeNoteType | 스테이크 노트의 토큰 종류 |

**비공개 입력**: 부모 노트 필드, 스테이크 노트 필드 (ownerAddress 제외), sk

**검증 내용**:
1. 부모 노트의 소유권 증명 (`sk` → 주소 일치)
2. 부모 노트 해시 일치
3. 스테이크 노트 해시 일치
4. **가치 보존**: `parentNote.value == stakeNote.value`
5. **스마트 노트 연결**: `stakeNote.ownerAddress == makerNoteHash & MASK_160`

### 온체인 동작

```solidity
function takeOrder(orderId, a, b, c, input, encryptedStakingNote) external {
    // 주문 상태 확인: Created
    // 토큰 타입 일치 확인: order.targetToken == input[2] == input[5]
    // 소유자 연결 확인: makerNote의 하위 160비트 == input[4]
    // notes[parentNote] = Trading
    // notes[stakeNote] = Trading
    // order.state = Taken
}
```

---

## 14. 주문 체결 — Settle Order

메이커와 테이커의 노트를 가격에 따라 원자적으로 교환하는 연산. ZK-DEX에서 가장 복잡한 회로.

### 회로: SettleOrder

**공개 입력 (14개)**:
| 인덱스 | 이름 | 설명 |
|--------|------|------|
| 0 | output | 항상 1 |
| 1 | o0Hash | 메이커 노트 해시 |
| 2 | o0Type | 메이커 노트 토큰 종류 |
| 3 | o1Hash | 테이커 스테이크 노트 해시 |
| 4 | o1Type | 테이커 스테이크 노트 토큰 종류 |
| 5 | n0Hash | 보상 노트 해시 (테이커에게) |
| 6 | n0Owner | 보상 노트 소유자 (parentNote 해시의 하위 160비트) |
| 7 | n0Type | 보상 노트 토큰 종류 |
| 8 | n1Hash | 지불 노트 해시 (메이커에게) |
| 9 | n1Owner | 지불 노트 소유자 (makerNote 해시의 하위 160비트) |
| 10 | n1Type | 지불 노트 토큰 종류 |
| 11 | n2Hash | 잔돈 노트 해시 |
| 12 | n2Type | 잔돈 노트 토큰 종류 |
| 13 | price | 교환 비율 |

### 가격 계산 로직

회로 내에서 **비결정론적 나눗셈 검증**(division witness)을 사용한다:

```
o0Value × price = q0 × 10^18 + r0    (메이커 가치의 가격 환산)
o1Value = q1 × price + r1            (테이커 가치의 가격 역환산)

조건: r0 < 10^18, r1 < price
```

`q0`, `r0`, `q1`, `r1`은 비공개 입력으로 제공되며, 회로는 위 관계가 성립하는지만 검증한다. 이것은 ZK 회로에서 나눗셈을 처리하는 표준 기법이다.

### 체결 방향 (누가 더 많은 가치를 제공했는가)

```
bit = (o0Value ≥ o1Value ÷ price) ? 1 : 0

bit == 1 (메이커 가치 ≥ 테이커 가치):
  보상(n0) = o1Value ÷ price      → 테이커에게 (메이커 토큰)
  지불(n1) = o1Value              → 메이커에게 (테이커 토큰)
  잔돈(n2) = o0Value - 보상값     → 메이커에게 반환

bit == 0 (테이커 가치 > 메이커 가치):
  보상(n0) = o0Value              → 테이커에게 (메이커 토큰 전부)
  지불(n1) = o0Value × price      → 메이커에게 (가격 환산 금액)
  잔돈(n2) = o1Value - 지불값     → 테이커에게 반환
```

### 출력 노트 소유자 규칙

| 노트 | 소유자 | 파생 방식 |
|------|--------|-----------|
| 보상 (n0) | 테이커 | `parentNote 해시 & MASK_160` (스마트 노트) |
| 지불 (n1) | 메이커 | `makerNote 해시 & MASK_160` (스마트 노트) |
| 잔돈 (n2) | 상황에 따라 다름 | bit==1: `makerNote 해시 & MASK_160`, bit==0: `parentNote 해시 & MASK_160` |

### 온체인 동작

```solidity
function settleOrder(orderId, a, b, c, input, encDatas) external {
    // 주문 데이터 일치 검증 (makerNote, takerNote, 토큰 종류, 가격)
    // 소유자 연결 검증 (reward → parentNote, payment → makerNote)
    // notes[makerNote] = Spent
    // notes[parentNote] = Spent
    // notes[takerNoteToMaker] = Spent
    // notes[rewardNote] = Valid
    // notes[paymentNote] = Valid
    // notes[changeNote] = Valid
    // order.state = Settled
}
```

### 체결 후

보상/지불/잔돈 노트는 모두 **스마트 노트**이므로, 수신자는 `convertNote`를 호출하여 일반 노트로 변환해야 자유롭게 사용할 수 있다.

---

## 15. 암호학 기본 요소

### Poseidon 해시

ZK 친화적 해시 함수. SHA256 대비 회로 내 비용이 약 100배 낮다.

| 용도 | 입력 | 출력 |
|------|------|------|
| 노트 해시 | (ownerAddress, value, tokenType, vk0, vk1, salt) | 254비트 해시 |
| 주소 파생 | (pk.x, pk.y) | 254비트 해시 → 160비트 절단 |
| 뷰잉 키 | (pk.x, pk.y) | 254비트 해시 (절단 없음) |

**비용 비교**:
| 해시 | 회로 제약조건 수 |
|------|-----------------|
| Poseidon(6) | ~1,500 |
| Poseidon(2) | ~350 |
| SHA256 | ~30,000 |

### BabyJubJub 타원곡선

- **유형**: 트위스트 에드워즈 곡선 (ax² + y² = 1 + dx²y²)
- **필드**: 254비트 (BN128 스칼라 필드 위)
- **용도**: 공개키 파생 (sk × G), ECDH 키 교환
- **생성자 점**: BASE8 (circomlib에 하드코딩)

**비용**: `EscalarMulFix(254)` (스칼라 곱셈) ≈ 128,000 제약조건 — 회로 비용의 97%+ 차지

### Groth16 증명 시스템

- **곡선**: BN128
- **증명 크기**: 3개 요소 (a[2], b[2][2], c[2]) — 약 256바이트
- **검증 비용**: 온체인 ~200K 가스
- **증명 생성**: snarkjs를 통해 브라우저(WASM) 또는 Node.js에서 수행

---

## 16. 노트 암호화 (ECDH)

노트 데이터는 수신자만 복호화할 수 있도록 ECDH + AES-256-GCM으로 암호화되어 온체인에 저장된다.

### 암호화 과정

```
1. 임시 키 쌍 생성: (esk, epk) — BabyJubJub
2. 공유 비밀 계산: sharedSecret = esk × recipientPk
3. AES 키 파생: aesKey = SHA256(sharedSecret.x || sharedSecret.y)
4. 랜덤 논스 생성: nonce (12바이트)
5. 암호화: ciphertext = AES-256-GCM(aesKey, nonce, plaintext)
```

### 온체인 저장 형식

```
0x01 || epk_x(32B) || epk_y(32B) || nonce(12B) || ciphertext || authTag(16B)
```

### 복호화

수신자는 자신의 비밀키로 `sharedSecret = sk × epk`를 계산하여 동일한 AES 키를 파생하고 복호화한다.

### 온체인 매핑

```solidity
mapping(bytes32 => bytes) public encryptedNotes;  // noteHash → 암호화된 바이트
```

제3자는 암호화된 바이트를 읽을 수 있지만, 비밀키 없이는 원본 `{ownerAddress, value, tokenType, viewingKey, salt}`을 복원할 수 없다.

---

## 17. 프라이버시 모델

### 연산별 정보 공개 수준

| 연산 | 금액 (value) | 소유자 | 토큰 종류 |
|------|-------------|--------|-----------|
| Mint | **공개** (입금 검증 필요) | 비공개 | 공개 |
| Liquidate | **공개** (출금 검증 필요) | 비공개 | 공개 |
| Transfer | **비공개** | **비공개** | 비공개 |
| ConvertNote | **비공개** | **비공개** | 비공개 |
| MakeOrder | 비공개 | 비공개 | 공개 (매칭 필요) |
| TakeOrder | 비공개 | 부분 공개 (160비트 주소) | 공개 |
| SettleOrder | 비공개 (가격만 공개) | 부분 공개 (160비트 주소) | 공개 |

### 계층별 보호

| 계층 | 보호 수준 | 설명 |
|------|----------|------|
| ZK 회로 | 부분적 | Transfer/Convert는 완전 비공개, Mint은 금액 공개 |
| 온체인 저장 (ECDH) | 보호됨 | 소유자만 복호화 가능 |
| 온체인 저장 (레거시) | 미보호 | 마이그레이션 전 노트는 평문 RLP |
| 소유권 | 보호됨 | 비밀키 + ZK 증명이 필수 |

---

## 18. 보안 속성

### 이중 지불 방지

온체인 상태 머신이 각 노트의 생명주기를 추적한다. `Valid` 상태의 노트만 소비할 수 있으며, 소비된 노트는 `Spent`로 전환되어 재사용이 불가능하다.

### 가치 보존 (Value Conservation)

- **Mint/Liquidate**: 외부 자산 입출금 시 `msg.value` 또는 DAI 전송량과 노트 값이 일치하는지 검증
- **Transfer**: 회로 내에서 `입력값 합 == 출력값 합` 제약조건 강제
- **Settle**: 회로 내에서 가격 기반 교환 수식이 정확히 성립하는지 검증

### 노트 고유성

무작위 `salt`가 각 노트에 포함되므로, 동일한 소유자/금액/토큰 조합이라도 서로 다른 해시를 갖는다. 이는 해시 충돌을 통한 프리이미지 공격을 방지한다.

### 스마트 노트 연결 무결성

- 스테이크 노트의 소유자 = 메이커 노트 해시의 하위 160비트
- 지불 노트의 소유자 = 메이커 노트 해시의 하위 160비트
- 보상 노트의 소유자 = 테이커 부모 노트 해시의 하위 160비트
- 이 관계는 회로와 온체인 양쪽에서 모두 검증되므로, 제3자가 노트를 가로챌 수 없다.

### 주문 원자성

`settleOrder`는 5개 노트의 상태를 단일 트랜잭션에서 원자적으로 변경한다:
- 입력 3개 (makerNote, parentNote, stakeNote) → Spent
- 출력 3개 (reward, payment, change) → Valid

부분 실행은 불가능하며, 증명이 유효하지 않으면 전체 트랜잭션이 실패한다.

---

## 회로 복잡도 요약

| 회로 | 제약조건 수 | 주요 연산 |
|------|------------|-----------|
| MintNBurnNote | ~131K | 소유권 증명 1회, 노트 해시 1회 |
| TransferNote | ~516K | 소유권 증명 2회, 노트 해시 4회, 가치 보존 |
| MakeOrder | ~131K | 소유권 증명 1회, 노트 해시 1회 |
| TakeOrder | ~258K | 소유권 증명 1회, 노트 해시 2회, 가치 보존 |
| ConvertNote | ~385K | 소유권 증명 1회, 노트 해시 3회, 해시 절단 |
| SettleOrder | ~641K | 소유권 증명 1회, 노트 해시 5회, 나눗셈 검증, 조건 분기 |

**비용 지배 요인**: BabyJubJub 스칼라 곱셈 (`EscalarMulFix`) ≈ 128K 제약조건이 각 소유권 증명의 97%+를 차지한다.

---

## 전체 거래 흐름

```
[사용자 A: ETH 보유]                     [사용자 B: DAI 보유]
      │                                        │
  ① mint(ETH)                              ① mint(DAI)
      │                                        │
      ▼                                        ▼
  NoteA (ETH, Valid)                    NoteB (DAI, Valid)
      │                                        │
  ② makeOrder(ETH→DAI, price)                  │
      │                                        │
      ▼                                        │
  NoteA (Trading)                              │
  Order(Created)                               │
      │                                        │
      │◄────────────── ③ takeOrder(orderId) ────┘
      │                                        │
      ▼                                        ▼
  Order(Taken)                          NoteB (Trading)
  StakeNote (Trading, 스마트노트)
      │
  ④ settleOrder(orderId)
      │
      ├──▶ RewardNote (ETH→B, 스마트노트, Valid)
      ├──▶ PaymentNote (DAI→A, 스마트노트, Valid)
      └──▶ ChangeNote (잔돈, 스마트노트, Valid)
              │
  ⑤ convertNote (각 수신자가 자신의 스마트노트를 일반 노트로 변환)
              │
              ▼
      NormalNote (Valid, 자유로운 전송/소각 가능)
```
