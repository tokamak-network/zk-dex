# C4. Stealth Address Receive

ECDH 키 교환을 사용하여 메타 주소로부터 유도된 일회성 스텔스 주소로 전송된 지급을 청구합니다.

**제약 조건**: ~250K | **복잡도**: 중간

---

## 배경

스텔스 주소는 프라이버시 시스템의 주소 재사용 문제를 해결합니다:

- **주소 재사용 위험**: 동일한 주소로 여러 지급을 받으면 트랜잭션 연결이 가능해집니다
- **메타 주소 시스템**: 단일 공개 주소가 무제한의 일회성 수신 주소를 생성합니다
- **ECDH 기반**: 타원 곡선 Diffie-Hellman이 상호 작용 없이 공유 비밀을 가능하게 합니다
- **EIP-5564 표준**: 이더리움 스텔스 주소 제안이 상호 운용성 프레임워크를 제공합니다
- **조정 불필요**: 송신자가 수신자에게 연락하지 않고 스텔스 주소를 생성합니다

전통적인 시스템에서 수신자는 각 지급마다 새 주소를 생성하고 공유해야 하므로 마찰이 발생합니다. 스텔스 주소는 송신자가 단일 메타 주소로부터 고유한 수신 주소를 유도할 수 있게 합니다. 수신자만 뷰 키로 스캔하여 이러한 지급을 탐지하고 청구할 수 있습니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `noteHash` | field | 청구되는 스텔스 노트의 해시 |
| `outputHash` | field | 출력 노트의 해시 |
| `ephemeralPkX, ephemeralPkY` | field | 송신자의 임시 공개키 |
| `tokenType` | uint | 청구되는 토큰 타입 |
| `stealthMetaAddressHash` | field | 수신자의 메타 주소 해시 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `stealthPkX, stealthPkY` | field | 일회성 스텔스 공개키 |
| `value` | uint | 노트 값 |
| `salt` | field | 노트 무작위성 |
| `spendSk` | field | 수신자의 지출 비밀키 |
| `viewSk` | field | 수신자의 조회 비밀키 |
| `spendPkX, spendPkY` | field | 수신자의 지출 공개키 |
| `viewPkX, viewPkY` | field | 수신자의 조회 공개키 |
| `outPkX, outPkY` | field | 출력 노트 소유자 (메인 지갑일 수 있음) |
| `outSalt` | field | 출력 노트 무작위성 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/baby_jub_jub.circom";
include "../utils/babyjubjub/scalar_mul.circom";
include "../utils/babyjubjub/point_add.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";

template StealthReceive() {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input outputHash;
    signal input ephemeralPkX, ephemeralPkY;
    signal input tokenType;
    signal input stealthMetaAddressHash;

    // ===== Private Inputs =====
    signal input stealthPkX, stealthPkY;
    signal input value, salt;
    signal input spendSk, viewSk;
    signal input spendPkX, spendPkY;
    signal input viewPkX, viewPkY;
    signal input outPkX, outPkY, outSalt;

    // ===== 1. Verify Stealth Note Format =====
    component note = PoseidonRegularNote();
    note.pkX <== stealthPkX;
    note.pkY <== stealthPkY;
    note.value <== value;
    note.tokenType <== tokenType;
    note.salt <== salt;
    note.out === noteHash;

    // ===== 2. Verify Meta-Address Ownership =====
    // Meta-address = (spendPk, viewPk)
    component metaAddr = Poseidon(4);
    metaAddr.inputs[0] <== spendPkX;
    metaAddr.inputs[1] <== spendPkY;
    metaAddr.inputs[2] <== viewPkX;
    metaAddr.inputs[3] <== viewPkY;
    metaAddr.out === stealthMetaAddressHash;

    // Verify spend key ownership
    component spendOwn = BabyJubJubScalarMulBase();
    spendOwn.scalar <== spendSk;
    spendOwn.outX === spendPkX;
    spendOwn.outY === spendPkY;

    // Verify view key ownership
    component viewOwn = BabyJubJubScalarMulBase();
    viewOwn.scalar <== viewSk;
    viewOwn.outX === viewPkX;
    viewOwn.outY === viewPkY;

    // ===== 3. Compute Shared Secret via ECDH =====
    // sharedSecret = viewSk * ephemeralPk
    component ecdh = BabyJubJubScalarMul();
    ecdh.scalar <== viewSk;
    ecdh.pointX <== ephemeralPkX;
    ecdh.pointY <== ephemeralPkY;

    // Hash shared secret to get scalar
    component sharedHash = Poseidon(2);
    sharedHash.inputs[0] <== ecdh.outX;
    sharedHash.inputs[1] <== ecdh.outY;

    // ===== 4. Derive Expected Stealth Public Key =====
    // stealthPk = spendPk + H(sharedSecret) * G
    component offset = BabyJubJubScalarMulBase();
    offset.scalar <== sharedHash.out;

    component expectedStealth = BabyJubJubPointAdd();
    expectedStealth.x1 <== spendPkX;
    expectedStealth.y1 <== spendPkY;
    expectedStealth.x2 <== offset.outX;
    expectedStealth.y2 <== offset.outY;

    // Verify derived stealth pk matches note's pk
    expectedStealth.outX === stealthPkX;
    expectedStealth.outY === stealthPkY;

    // ===== 5. Derive and Verify Stealth Secret Key =====
    // stealthSk = spendSk + H(sharedSecret)
    signal stealthSk;
    stealthSk <== spendSk + sharedHash.out;

    component stealthOwn = ProofOfOwnershipStrict();
    stealthOwn.sk <== stealthSk;
    stealthOwn.pkX <== stealthPkX;
    stealthOwn.pkY <== stealthPkY;

    // ===== 6. Create Output Note =====
    component outNote = PoseidonRegularNote();
    outNote.pkX <== outPkX;
    outNote.pkY <== outPkY;
    outNote.value <== value;
    outNote.tokenType <== tokenType;
    outNote.salt <== outSalt;
    outNote.out === outputHash;
}

component main {public [noteHash, outputHash, ephemeralPkX, ephemeralPkY, tokenType, stealthMetaAddressHash]} =
    StealthReceive();
```

### 주요 제약 조건

1. **스텔스 노트 유효성**: 입력 노트가 스텔스 공개키로 올바르게 포맷되어야 합니다
2. **메타 주소 소유권**: 증명자가 지출 키와 조회 키를 모두 제어합니다
3. **ECDH 정확성**: 공유 비밀이 조회 키와 임시 키로부터 계산됩니다
4. **스텔스 키 유도**: 스텔스 pk = 지출 pk + H(공유) * G
5. **지출 권한**: 스텔스 sk가 올바르게 유도되고 스텔스 pk와 일치합니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **수신자 프라이버시** | 각 지급이 고유하고 연결 불가능한 주소로 이루어집니다 |
| **송신자 경험** | 일반 전송과 동일 (스텔스 주소 계산) |
| **스캔 요구 사항** | 수신자가 지급을 위해 체인을 스캔해야 합니다 |
| **키 관리** | 두 개의 키: 지출 (콜드)과 조회 (핫) |
| **위임 가능** | 모니터링을 위해 조회 키를 공유할 수 있습니다 |
| **주소 재사용** | 제거됨 - 모든 지급이 고유합니다 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **조회 키 침해** | 지급만 드러나고 지출 권한은 아닙니다 |
| **지출 키 침해** | 완전한 제어 손실; 콜드 스토리지 사용 |
| **임시 키 재사용** | 송신자가 지급마다 새 키를 생성해야 합니다 |
| **스캔 프라이버시** | 로컬 스캔 또는 신뢰할 수 있는 제3자 사용 |
| **타이밍 공격** | 스캔 간격을 무작위화합니다 |
| **메타 주소 연결** | 다른 컨텍스트에 다른 메타 주소 사용 |
| **계산 비용** | ECDH는 비쌉니다; 배치 스캔이 도움이 됩니다 |

## 구현 과제

1. **지급 탐지**
   - 수신자가 모든 스텔스 지급을 스캔해야 합니다
   - 각각에 대해 계산: try_decrypt(view_key, ephemeral_pk)
   - 활성 체인의 경우 계산적으로 비쌀 수 있습니다

2. **스캔 인프라**
   - 스텔스 공지의 효율적인 인덱싱이 필요합니다
   - 고려 사항: 전용 스텔스 공지 컨트랙트
   - 스캔 서비스에 조회 키 위임

3. **임시 키 게시**
   - 송신자가 지급과 함께 임시 공개키를 게시해야 합니다
   - 이벤트 방출 또는 전용 공지 컨트랙트
   - 상호 운용성을 위한 표준 형식 (EIP-5564)

4. **청구를 위한 가스**
   - 스텔스 주소에서 청구하려면 가스가 필요합니다
   - 스텔스 주소를 직접 사용할 수 없습니다 (소유권 드러남)
   - 솔루션: 릴레이어, 사전 자금 지원된 청구 지갑

5. **키 유도 표준**
   - 송신자의 유도와 정확히 일치해야 합니다
   - 상호 운용성을 위해 엄격한 표준이 필요합니다
   - BIP-32 스타일 계층적 유도 고려

## 파생물

1. **스텔스 주소 레지스트리** - 신원을 메타 주소에 매핑하는 온체인 레지스트리. ENS 통합으로 name.eth 스텔스 주소로 전송할 수 있습니다. 지급 프라이버시를 유지하면서 발견을 단순화합니다.

2. **위임 스캔 서비스** - 위임된 조회 키를 사용하여 스텔스 지급을 스캔하는 제3자 서비스. 사용자가 들어오는 지급 알림을 받습니다. 편의를 위해 일부 프라이버시를 교환합니다.

3. **조회 키 구획화** - 다른 컨텍스트를 위한 여러 조회 키 (비즈니스, 개인, 투자). 각 조회 키는 지급의 하위 집합만 탐지할 수 있습니다. 회계사나 감사관에게 선택적 공개를 가능하게 합니다.

4. **스텔스-투-스텔스 전송** - 소유권을 드러내지 않고 스텔스 지급을 체인으로 연결합니다. 스텔스 주소로 받고, 즉시 다른 스텔스 주소로 전송합니다. 민감한 전송에 대한 최대 연결 불가능성입니다.

5. **규정 준수 호환 스텔스** - 임베디드 규정 준수 증명이 있는 스텔스 주소. 수신자가 신원을 드러내지 않고 AML 규정 준수를 증명합니다. 스텔스 주소의 기관 채택을 가능하게 합니다.

## 사용 사례

1. **기부 프라이버시**
   - 비영리 단체가 스텔스 메타 주소를 게시합니다
   - 기부자가 신원을 드러내지 않고 전송합니다
   - 비영리 단체가 들어오는 기부를 스캔합니다
   - 개별 기부 금액이 비공개로 유지됩니다

2. **급여 프라이버시**
   - 직원이 스텔스 메타 주소를 등록합니다
   - 고용주가 각 기간마다 스텔스 주소로 지급합니다
   - 직원들이 서로의 급여를 볼 수 없습니다
   - 고용주 지출이 개인과 추적 가능하지 않습니다

3. **전자상거래 프라이버시**
   - 상인이 결제 시 스텔스 메타 주소를 표시합니다
   - 각 고객 지급이 고유한 주소로 이루어집니다
   - 고객이 구매에 걸쳐 연결될 수 없습니다
   - 상인이 완전한 트랜잭션 기록을 유지합니다

4. **투자 펀드 프라이버시**
   - 펀드가 투자를 위한 메타 주소를 게시합니다
   - LP가 고유한 스텔스 주소에 기여합니다
   - 투자 금액이 다른 LP에게 보이지 않습니다
   - 펀드가 규정 준수 보고를 위해 집계할 수 있습니다

## 실제 제품 및 사용자 경험

자세한 실제 응용 프로그램 및 사용자 경험 시나리오는 [Stealth Address Receive - Products & UX](../../product/c-privacy/c4-stealth-address-products.md)를 참조하세요.

---

[목차로 돌아가기](../../README.md)
