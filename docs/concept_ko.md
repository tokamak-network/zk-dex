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
19. [FAQ](#19-faq)

---

## 1. 노트 (Note)

**노트**는 ZK-DEX의 기본 가치 단위로, Bitcoin의 UTXO와 유사한 개념이다. 각 노트는 특정 토큰의 특정 금액에 대한 소유권을 나타내는 암호학적 커밋먼트(commitment)다.

### 노트 구조 (7개 필드)

| 필드 | 크기 | 설명 |
|------|------|------|
| `owner0` | 254비트 | 소유자의 BabyJubJub 공개키 x 좌표 (pkX) |
| `owner1` | 254비트 | 소유자의 BabyJubJub 공개키 y 좌표 (pkY) |
| `value` | 254비트 | 토큰 보유량 (wei 단위) |
| `tokenType` | 256비트 | 토큰 종류 (0 = ETH, 1 = DAI) |
| `vk0` | 254비트 | Viewing key의 첫 번째 좌표 (= pkX) |
| `vk1` | 254비트 | Viewing key의 두 번째 좌표 (= pkY) |
| `salt` | 254비트 | 무작위 값, 동일 조건의 노트가 같은 해시를 갖는 것을 방지 |

**참고**: 현재 구현에서 viewing key는 공개키 자체이므로 `vk0 = owner0 = pkX`, `vk1 = owner1 = pkY`다.

### 빈 노트 (Empty Note)

모든 필드가 0인 특수 노트. 전송 회로에서 입력 노트가 1개일 때 두 번째 슬롯을 채우는 데 사용한다.

```
EMPTY_NOTE_HASH = Poseidon(0, 0, 0, 0, 0, 0, 0)
```

---

## 2. 노트 해시 (Note Hash)

노트의 7개 필드를 Poseidon 해시 함수에 입력하여 하나의 필드 원소(254비트)로 압축한 값. 온체인에서는 이 해시만 저장되므로, 원본 필드를 알지 못하면 노트의 내용을 알 수 없다.

```
noteHash = Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)
```

여기서:
- `owner0` = pkX (BabyJubJub 공개키 x 좌표)
- `owner1` = pkY (BabyJubJub 공개키 y 좌표)
- `vk0` = pkX (viewing key = 공개키 자체)
- `vk1` = pkY

**참고**: 현재 아키텍처에서 viewing key는 공개키 자체이므로 `owner0 == vk0`, `owner1 == vk1`이다. 이 구조는 향후 viewing key를 별도로 분리할 필요가 생길 때 확장성을 제공한다.

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

사용자는 두 계정을 동시에 혹은 별도로 보유할 수 있다. Ethereum 계정은 트랜잭션 전송에, ZK 계정은 노트 소유/암호화에 사용한다.

---

## 5. ZK 계정 (ZK Account)

ZK 계정은 BabyJubJub 타원곡선에 기반한 키 체계다. 주요 구성 요소:

### 이더리움 계정과의 독립성

**핵심 개념: ZK 계정은 이더리움 계정과 완전히 독립적이다.**

- ZK 계정(BabyJubJub 키 쌍)과 이더리움 계정(secp256k1 키 쌍)은 암호학적 연관성이 전혀 없다
- 노트 소유권은 오직 ZK 비밀키(z-sk)에 의해서만 결정되며, 이더리움 주소와는 무관하다
- **어떤 이더리움 계정이든 ZK 계정을 대신하여 트랜잭션을 제출할 수 있다** — 중요한 것은 ZK 증명의 유효성이지, 어떤 이더리움 주소가 트랜잭션을 보냈는지가 아니다

이것이 의미하는 바:
- Alice가 z-sk를 알고 있다면, 어떤 이더리움 지갑(MetaMask, 하드웨어 지갑, 제3자 릴레이어)에서든 노트를 제어할 수 있다
- 이더리움 계정은 가스비를 지불하고 트랜잭션을 제출하는 역할만 한다 — 노트 소유권에 대한 권한은 없다
- Alice의 이더리움 개인키가 유출되더라도, z-sk가 안전한 한 ZK 노트는 보호된다
- 반대로 z-sk가 유출되면, 공격자는 어떤 이더리움 계정에서든 노트를 제어할 수 있다

| 키 유형 | 제어 대상 | 유출 시 영향 |
|---------|----------|-------------|
| 이더리움 개인키 | 가스 지불, 트랜잭션 제출 | ZK 노트 접근 불가 |
| ZK 비밀키 (z-sk) | 노트 소유권, 증명 생성 | 해당 z-sk 소유의 모든 노트에 대한 완전한 제어권 |

이 설계가 가능하게 하는 사용 사례:
- **메타 트랜잭션**: 릴레이어가 사용자를 대신해 증명을 제출
- **계정 추상화**: 스마트 컨트랙트 지갑을 통해 노트 제어 가능
- **키 로테이션**: ZK 노트에 영향 없이 이더리움 계정 변경 가능

### 비밀키 (Secret Key, sk)
- 254비트 무작위 스칼라
- BN128 필드 내에서 유효해야 함 (순서 `l`보다 작아야 함)
- 노트 소유권을 증명하는 유일한 수단

### 공개키 (Public Key, pk)
- BabyJubJub 곡선 위의 점 `(pkX, pkY)`
- 비밀키에서 파생: `pk = sk × G` (G는 생성자 점 BASE8)
- **노트 소유권의 직접적인 기반** — owner0, owner1 필드에 직접 저장됨

### 뷰잉 키 (Viewing Key)

**핵심: 일반 노트에서 vk0/vk1은 임의의 값이 가능하며, 소유권 검증에 사용되지 않는다. 뷰잉 키가 실제로 의미를 갖는 것은 스마트 노트에서뿐이다.**

#### 일반 노트 vs 스마트 노트에서의 뷰잉 키

| 노트 유형 | vk0, vk1 값 | 회로에서의 검증 | 용도 |
|----------|-------------|----------------|------|
| 일반 노트 | 임의의 값 가능 (관례상 pkX, pkY 사용) | 검증 없음 | 노트 해시의 일부로만 포함 |
| 스마트 노트 | `parentHash >> 128`, `parentHash & MASK_128` | **필수 검증** | 부모-자식 노트 연결 강제 |

#### 왜 일반 노트에서 뷰잉 키가 자유로운가?

ZK 회로에서 소유권 검증은 **오직 `owner0`, `owner1`만 사용한다**:

```
sk → pk = sk × G → (pkX, pkY)
owner0 == pkX && owner1 == pkY 확인  ← 소유권 검증의 전부
```

`vk0`, `vk1`은 노트 해시 계산에만 포함되며, 회로에서 별도로 검증되지 않는다:

```
noteHash = Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)
                                                      ^^^  ^^^
                                         해시 입력일 뿐, 검증 대상 아님
```

따라서 일반 노트에서는 vk0/vk1에 어떤 값을 넣어도 노트가 유효하다. 현재 구현에서는 관례적으로 `vk0 = pkX`, `vk1 = pkY`를 사용하지만, 이는 필수가 아니다.

#### 스마트 노트에서 뷰잉 키가 필수인 이유

스마트 노트는 주문 프로토콜(takeOrder, settleOrder)에서 생성되며, **부모 노트와의 연결을 암호학적으로 강제**해야 한다. 이때 `owner0`, `owner1`이 부모 노트 해시에서 파생되고, 회로와 온체인 컨트랙트 모두에서 이 관계를 검증한다.

#### 뷰잉 키의 주요 용도

**용도 1: 노트 탐색 (Note Discovery)**

뷰잉 키를 아는 사람은 온체인에 저장된 암호화된 노트 중 자신에게 속한 것을 식별할 수 있다:

```
1. 온체인 NoteStateChange 이벤트 수신
2. encryptedNotes[noteHash]에서 암호화된 데이터 조회
3. ECDH 복호화 시도 (자신의 비밀키 사용)
4. 복호화 성공 → 노트 필드 복원 (owner0, owner1, value, token, vk0, vk1, salt)
5. 복원된 vk0, vk1이 자신의 공개키와 일치하면 자신의 노트
```

지갑(Wallet)은 이 과정을 자동화하여 사용자의 모든 노트를 추적한다.

**용도 2: 선택적 공개 (Selective Disclosure)**

> **주의: 현재 구현의 한계**
>
> Zcash에서는 viewing key만으로 온체인 암호화 데이터를 직접 복호화할 수 있도록 별도의 암호화 계층을 두고 있다. 그러나 **ZK-DEX의 현재 구현에서는 온체인 노트 데이터가 ECDH + AES-256-GCM 단일 계층으로 암호화되어 있으며, 이를 복호화하려면 반드시 비밀키(sk)가 필요하다.** 뷰잉 키만으로는 온체인 암호문을 복호화할 수 없다.
>
> 따라서 선택적 공개는 다음과 같은 **오프체인 방식**으로만 가능하다:
>
> 1. 노트 소유자가 비밀키로 온체인 데이터를 복호화
> 2. 복호화된 노트 데이터 `(owner0, owner1, value, tokenType, vk0, vk1, salt)`를 제3자에게 직접 전달
> 3. 제3자가 받은 데이터로 `noteHash = Poseidon(...)`를 재계산하여 온체인 상태와 대조
> 4. 뷰잉 키를 통해 해당 노트가 특정 계정 소유임을 검증

이 방식에서 뷰잉 키는 복호화 키가 아니라 **소유자 신원 증명 마커** 역할을 한다. 제3자는 전달받은 데이터의 뷰잉 키가 소유자의 공개키와 일치함을 확인하여 노트 소유권을 검증할 수 있다.

| 공유 대상 | 할 수 있는 것 | 할 수 없는 것 |
|-----------|--------------|--------------|
| 뷰잉 키 + 오프체인 노트 데이터 보유자 | 노트 잔액 검증, 온체인 상태 대조 | 온체인 암호문 직접 복호화, 노트 전송/소비/주문 |
| 비밀키 보유자 | 온체인 데이터 복호화 + 노트 전송/소비/주문 | — |

예: 감사인에게 뷰잉 키와 복호화된 노트 데이터를 전달하면 자산을 검증할 수 있지만 이동시킬 수 없다.

**용도 3: 주문 메타데이터 (Order Metadata)**

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

**용도 4: 스마트 노트에서의 부모 연결 (필수)**

스마트 노트의 경우 소유자가 일반적인 공개키가 아니라 **부모 노트의 해시에서 파생**된다:

```
일반 노트:   owner0 = pkX, owner1 = pkY
스마트 노트: owner0 = parentHash >> 128
            owner1 = parentHash & MASK_128
```

이 설계를 통해:
- 부모 노트의 소유자만 `convertNote`로 스마트 노트를 일반 노트로 변환 가능
- 주문 체결(settle) 시 출력 노트가 올바른 당사자에게 귀속되는 것을 보장

**용도 5: 암호화된 노트 데이터에 포함**

노트가 ECDH로 암호화되어 온체인에 저장될 때, 뷰잉 키는 암호화된 페이로드의 일부로 포함된다:

```
암호화 전 평문: RLP([owner0, owner1, value, tokenType, vk0, vk1, salt])
암호화 후:     0x01 || epk || nonce || AES-GCM(plaintext) || authTag
```

수신자가 복호화하면 뷰잉 키를 복원할 수 있고, 이를 통해 노트의 완전한 해시를 재계산하여 온체인 상태와 대조할 수 있다.

### 키 파생 체인

```
sk (254비트 무작위)
  │
  ▼ BabyJubJub 스칼라 곱셈 (sk × G)
pk (pkX, pkY) — BabyJubJub 곡선 위의 점
  │
  ├── owner0 = pkX (노트의 소유자 필드 1)
  ├── owner1 = pkY (노트의 소유자 필드 2)
  ├── vk0 = pkX    (viewing key = 공개키 자체)
  └── vk1 = pkY
```

**참고**: 더 이상 Poseidon 해시 파생이나 160비트 truncation이 없다. 공개키 좌표가 직접 노트 필드로 사용된다.

---

## 6. 소유권 모델 (Ownership Model)

ZK-DEX는 **공개키 기반 소유권** 모델을 사용한다. 노트 소유를 증명하려면 다음을 ZK 회로 안에서 검증한다:

1. 비밀키 `sk`에서 공개키 `pk` 파생: `pk = sk × G`
2. 파생된 공개키 좌표가 노트의 `owner0`, `owner1`과 일치하는지 확인

이 과정은 회로 내부에서 수행되므로 `sk`는 외부에 공개되지 않는다. 온체인에서는 ZK 증명이 유효한지만 검증하면 되므로, 소유자의 신원이 보호된다.

**참고**: 이전 아키텍처에서는 주소 기반(160비트 truncation) 소유권 모델을 사용했으나, 현재는 공개키 좌표(pkX, pkY)를 직접 비교하는 방식으로 변경되었다.

### VerifyOwnership (회로 컴포넌트)

```
입력: sk, expectedOwner0, expectedOwner1
내부: pk = sk × G → (pkX, pkY)
출력: result = (pkX == expectedOwner0 && pkY == expectedOwner1) ? 1 : 0
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

**비공개 입력**: owner0, owner1, vk0, vk1, salt, sk

**검증 내용**:
1. `sk`로부터 공개키 파생 후 `owner0`, `owner1`과 일치 확인 (소유권 증명)
2. 노트 해시 `Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)`가 공개 입력 `noteHash`와 일치하는지 확인
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
- 입력 노트 0, 1의 전체 필드 (owner0, owner1, value, tokenType, vk0, vk1, salt)
- 출력 노트 2개의 전체 필드
- 비밀키 sk0, sk1

**검증 내용**:
1. 입력 노트 0의 소유권 증명 (`sk0` → 공개키 일치)
2. 입력 노트 1의 소유권 증명 (빈 노트가 아닌 경우)
3. 4개 노트의 해시가 각각 공개 입력과 일치
4. **가치 보존**: `input0.value + input1.value == new.value + change.value`
5. **토큰 일관성**: 모든 노트의 `tokenType`이 동일

### 핵심 속성

- `value`가 공개 입력에 포함되지 않으므로 전송 금액이 비공개
- `owner0`, `owner1`이 공개 입력에 포함되지 않으므로 수신자가 비공개
- 가치 보존은 회로 내부에서만 검증 — 외부에서는 해시만 보임

---

## 10. 스마트 노트 (Smart Note)

**스마트 노트**는 소유자가 사용자의 공개키가 아닌 **다른 노트의 해시**에서 파생된 특수 노트다. 주문(order) 프로토콜에서 노트 간 연결 관계를 암호학적으로 강제하는 데 사용한다.

### 일반 노트 vs 스마트 노트

| 속성 | 일반 노트 | 스마트 노트 |
|------|-----------|------------|
| owner0 | pkX (공개키 x 좌표) | `parentHash >> 128` (상위 128비트) |
| owner1 | pkY (공개키 y 좌표) | `parentHash & MASK_128` (하위 128비트) |
| vk0, vk1 | pkX, pkY (공개키 자체) | 부모 노트 해시에서 파생된 값 |
| 생성 시점 | mint, transfer | takeOrder, settleOrder |
| 소유권 증명 | 비밀키로 직접 증명 | 부모 노트 소유자만 convertNote로 변환 가능 |

### 스마트 노트 소유자 파생

스마트 노트의 소유자는 부모 노트 해시에서 다음과 같이 파생된다:

```
parentHash = 254비트 노트 해시
owner0 = parentHash >> 128      (상위 128비트, 우측 시프트)
owner1 = parentHash & MASK_128  (하위 128비트)
```

여기서 `MASK_128 = (2^128) - 1`이다.

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
1. 스마트 노트의 소유자 연결 확인:
   - `smartNote.owner0 == originHash >> 128`
   - `smartNote.owner1 == originHash & MASK_128`
2. 원본 노트의 소유권 증명 (`sk` → 공개키 일치)
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

**비공개 입력**: owner0, owner1, value, vk0, vk1, salt, sk

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
| 4 | stakeNoteOwner0 | 메이커 노트 해시의 상위 128비트 |
| 5 | stakeNoteOwner1 | 메이커 노트 해시의 하위 128비트 |
| 6 | stakeNoteType | 스테이크 노트의 토큰 종류 |

**비공개 입력**: 부모 노트 필드, 스테이크 노트 필드 (owner0, owner1 제외), sk

**검증 내용**:
1. 부모 노트의 소유권 증명 (`sk` → 공개키 일치)
2. 부모 노트 해시 일치
3. 스테이크 노트 해시 일치
4. **가치 보존**: `parentNote.value == stakeNote.value`
5. **스마트 노트 연결**:
   - `stakeNote.owner0 == makerNoteHash >> 128`
   - `stakeNote.owner1 == makerNoteHash & MASK_128`

### 온체인 동작

```solidity
function takeOrder(orderId, a, b, c, input, encryptedStakingNote) external {
    // 주문 상태 확인: Created
    // 토큰 타입 일치 확인: order.targetToken == input[2] == input[6]
    // 소유자 연결 확인:
    //   - makerNote >> 128 == input[4] (owner0)
    //   - makerNote & MASK_128 == input[5] (owner1)
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
| 6 | n0Owner0 | 보상 노트 소유자 owner0 (parentNote 해시 >> 128) |
| 7 | n0Owner1 | 보상 노트 소유자 owner1 (parentNote 해시 & MASK_128) |
| 8 | n0Type | 보상 노트 토큰 종류 |
| 9 | n1Hash | 지불 노트 해시 (메이커에게) |
| 10 | n1Owner0 | 지불 노트 소유자 owner0 (makerNote 해시 >> 128) |
| 11 | n1Owner1 | 지불 노트 소유자 owner1 (makerNote 해시 & MASK_128) |
| 12 | n1Type | 지불 노트 토큰 종류 |
| 13 | n2Hash | 잔돈 노트 해시 |
| 14 | n2Type | 잔돈 노트 토큰 종류 |
| 15 | price | 교환 비율 |

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
| 보상 (n0) | 테이커 | owner0 = `parentNote 해시 >> 128`, owner1 = `parentNote 해시 & MASK_128` |
| 지불 (n1) | 메이커 | owner0 = `makerNote 해시 >> 128`, owner1 = `makerNote 해시 & MASK_128` |
| 잔돈 (n2) | 상황에 따라 다름 | bit==1: 메이커 노트 해시에서 파생, bit==0: 테이커 부모 노트 해시에서 파생 |

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
| 노트 해시 | (owner0, owner1, value, tokenType, vk0, vk1, salt) | 254비트 해시 |

**비용 비교**:
| 해시 | 회로 제약조건 수 |
|------|-----------------|
| Poseidon(7) | ~1,750 |
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

제3자는 암호화된 바이트를 읽을 수 있지만, 비밀키 없이는 원본 `{owner0, owner1, value, tokenType, vk0, vk1, salt}`을 복원할 수 없다.

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

- 스테이크 노트의 소유자(owner0, owner1) = 메이커 노트 해시에서 파생 (`>> 128`, `& MASK_128`)
- 지불 노트의 소유자 = 메이커 노트 해시에서 파생
- 보상 노트의 소유자 = 테이커 부모 노트 해시에서 파생
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

---

## 19. FAQ

### Q1. 노트의 소유권을 증명하려면 어떤 데이터가 필요한가?

**핵심은 비밀키(sk) 하나다.** ZK 회로 내부에서 다음 과정을 거쳐 소유권을 검증한다:

```
sk → pk = sk × G → (pkX, pkY)
owner0 == pkX && owner1 == pkY 확인
```

다만 ZK proof를 생성하려면 노트 해시를 재구성해야 하므로, 회로에는 sk 외에 노트의 나머지 필드도 함께 입력해야 한다:

| 데이터 | 용도 |
|--------|------|
| **sk** (비밀키) | 소유권 증명의 핵심 — sk에서 공개키를 유도하여 노트 owner와 매칭 |
| owner0 | 노트에 기록된 소유자 공개키 x 좌표 |
| owner1 | 노트에 기록된 소유자 공개키 y 좌표 |
| value | 노트 잔액 |
| tokenType | 토큰 종류 |
| vk0, vk1 | viewing key (= pkX, pkY) |
| salt | 노트 고유성 보장 |

이 7개 필드로 `noteHash = Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)`를 재계산하고, 온체인에 기록된 noteHash와 일치하는지 회로 내에서 검증한다.

### Q2. sk를 알아도 나머지 노트 데이터(owner0, owner1, value, tokenType, vk0, vk1, salt)를 잃으면 노트를 사용할 수 없는가?

**로컬 데이터만 잃은 경우라면 복구 가능하다.** 노트가 생성될 때 7개 필드가 ECDH로 암호화되어 온체인에 저장되기 때문이다:

```solidity
mapping(bytes32 => bytes) public encryptedNotes;  // noteHash → ECDH 암호화된 바이트
```

복구 과정:

1. 온체인에서 `encryptedNotes[noteHash]` 데이터를 가져옴
2. sk로 ECDH 복호화 수행: `shared = sk × epk` → AES 키 파생 → 복호화
3. RLP 디코딩으로 `[owner0, owner1, value, tokenType, vk0, vk1, salt]` 복원
4. 복원된 데이터로 ZK proof 생성 가능

따라서:
- **로컬 데이터 소실 + sk 보유**: 온체인 암호화 데이터에서 복구 가능 → 노트 사용 가능
- **sk 소실**: 복호화도, 소유권 증명도 불가 → **노트 영구 소실**
- **온체인 데이터 소실**: 블록체인 특성상 발생하지 않음

**결론: 시스템에서 진짜 잃으면 안 되는 유일한 것은 sk다.**

### Q3. 온체인에 저장되는 암호화된 노트의 키-밸류 구조는 어떻게 되는가?

```solidity
mapping(bytes32 => bytes) public encryptedNotes;
```

- **Key**: `noteHash` (bytes32) — `Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)`
- **Value**: ECDH 암호화된 바이트열 — `ECDH_Encrypt(RLP(owner0, owner1, value, tokenType, vk0, vk1, salt))`

Value의 온체인 바이트 포맷:

```
0x01 || epk_x(32B) || epk_y(32B) || nonce(12B) || ciphertext || authTag(16B)
```

| 필드 | 크기 | 설명 |
|------|------|------|
| version | 1 byte | 항상 `0x01` |
| epk_x | 32 bytes | ephemeral public key의 x좌표 |
| epk_y | 32 bytes | ephemeral public key의 y좌표 |
| nonce | 12 bytes | AES-GCM IV (랜덤) |
| ciphertext | 가변 | RLP 인코딩된 노트 필드의 암호문 |
| authTag | 16 bytes | AES-GCM 인증 태그 |

즉, 같은 원본 데이터의 **Poseidon 해시가 키**, **ECDH 암호화본이 밸류**인 구조다.

### Q4. 뷰잉 키(Viewing Key)란 무엇이고 왜 필요한가?

현재 아키텍처에서 뷰잉 키는 공개키 자체다:

```
vk0 = pkX (BabyJubJub 공개키 x 좌표)
vk1 = pkY (BabyJubJub 공개키 y 좌표)
```

더 이상 Poseidon 해시로 파생하지 않고, 160비트 truncation도 없다.

뷰잉 키가 필요한 이유:

1. **공개키 바인딩**: 노트 해시에 공개키 전체를 커밋하여 소유권 위조 방지
2. **노트 탐색**: 복호화 후 vk0, vk1을 비교하여 내 노트인지 식별
3. **스마트 노트 연결**: 스마트 노트에서 owner가 parentHash에서 파생되어 부모 노트와의 연결고리 역할

자세한 내용은 [5장 뷰잉 키 섹션](#뷰잉-키-viewing-key)을 참고한다.

### Q5. 뷰잉 키만으로 온체인 노트 데이터를 복호화할 수 있는가?

**아니다.** 현재 ZK-DEX 구현에서는 불가능하다.

온체인 노트 데이터는 ECDH + AES-256-GCM으로 암호화되어 있으며, 복호화에는 `shared = sk × epk` 계산이 필요하다. 뷰잉 키(vk0, vk1)는 공개키 좌표 자체이지만, ECDH 공유 비밀을 계산하려면 비밀키 sk가 필요하다.

Zcash에서는 viewing key로 직접 온체인 데이터를 복호화할 수 있도록 별도의 암호화 계층(in-band secret distribution)을 두고 있지만, ZK-DEX는 ECDH 단일 계층만 사용하므로 이 기능이 지원되지 않는다.

선택적 공개가 필요한 경우, 노트 소유자가 sk로 복호화한 데이터를 오프체인으로 제3자에게 전달하고, 제3자가 noteHash를 재계산하여 온체인 상태와 대조하는 방식으로 검증한다. 자세한 내용은 [5장 역할 3: 선택적 공개](#뷰잉-키의-주요-역할)를 참고한다.
