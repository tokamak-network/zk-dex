# C5. Selective Disclosure

다른 속성(값, 신원)을 비공개로 유지하면서 특정 노트 속성(토큰 타입, 소유권 상태)을 공개합니다.

**제약 조건**: ~150K | **복잡도**: 낮음

---

## 배경

선택적 공개는 규정 준수 및 검증을 위한 세밀한 프라이버시 제어를 가능하게 합니다:

- **최소 공개 원칙**: 특정 컨텍스트에 필요한 정보만 공개합니다
- **속성 독립성**: 다른 속성을 다른 당사자에게 공개할 수 있습니다
- **검증 가능한 주장**: 공개된 속성이 암호학적으로 증명되며, 단순히 주장된 것이 아닙니다
- **프라이버시 보존**: 공개되지 않은 속성은 계산적으로 숨겨진 채로 유지됩니다
- **규제 호환성**: 완전한 투명성 없이 규정 준수를 가능하게 합니다

많은 시나리오에서 완전한 투명성은 불필요하고 해롭습니다. 집주인은 정확한 금액이 아닌 소득 범위를 확인할 필요가 있습니다. 규정 준수 담당자는 소유자 신원이 아닌 토큰 타입을 확인할 필요가 있습니다. 선택적 공개는 다른 모든 것을 숨기면서 특정 속성의 암호학적 증명을 제공합니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `noteHash` | field | 공개되는 노트의 해시 |
| `merkleRoot` | field | 노트 커밋먼트 트리의 루트 |
| `disclosureFlags` | uint | 공개할 속성의 비트맵 |
| `disclosedTokenType` | uint | 토큰 타입 (플래그가 설정된 경우, 아니면 0) |
| `disclosedValueMin` | uint | 최소값 (범위 플래그가 설정된 경우) |
| `disclosedValueMax` | uint | 최대값 (범위 플래그가 설정된 경우) |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `pkX, pkY` | field | 소유자의 공개키 |
| `value` | uint | 노트 값 |
| `tokenType` | uint | 실제 토큰 타입 |
| `salt` | field | 노트 무작위성 |
| `sk` | field | 소유권 증명을 위한 비밀키 |
| `merklePath[TREE_DEPTH]` | field[] | Merkle 증명 경로 |
| `merkleIndex` | uint | Merkle 트리 위치 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";
include "../utils/bitify.circom";

template SelectiveDisclosure(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input merkleRoot;
    signal input disclosureFlags;    // Bit 0: tokenType, Bit 1: valueRange, Bit 2: ownership
    signal input disclosedTokenType;
    signal input disclosedValueMin;
    signal input disclosedValueMax;

    // ===== Private Inputs =====
    signal input pkX, pkY;
    signal input value;
    signal input tokenType;
    signal input salt;
    signal input sk;
    signal input merklePath[TREE_DEPTH];
    signal input merkleIndex;

    // ===== 1. Parse Disclosure Flags =====
    component flagBits = Num2Bits(8);
    flagBits.in <== disclosureFlags;
    signal discloseTokType <== flagBits.out[0];
    signal discloseRange <== flagBits.out[1];
    signal discloseOwnership <== flagBits.out[2];

    // ===== 2. Verify Note Format =====
    component note = PoseidonRegularNote();
    note.pkX <== pkX;
    note.pkY <== pkY;
    note.value <== value;
    note.tokenType <== tokenType;
    note.salt <== salt;
    note.out === noteHash;

    // ===== 3. Verify Ownership (always required) =====
    component own = ProofOfOwnershipStrict();
    own.sk <== sk;
    own.pkX <== pkX;
    own.pkY <== pkY;

    // ===== 4. Verify Merkle Inclusion =====
    component merkle = MerkleProof(TREE_DEPTH);
    merkle.leaf <== noteHash;
    merkle.root <== merkleRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path[i] <== merklePath[i];
    }
    merkle.index <== merkleIndex;

    // ===== 5. Conditional Token Type Disclosure =====
    // If discloseTokType = 1, tokenType must equal disclosedTokenType
    // If discloseTokType = 0, no constraint (disclosedTokenType should be 0)
    signal tokenTypeMatch;
    tokenTypeMatch <== (tokenType - disclosedTokenType) * discloseTokType;
    tokenTypeMatch === 0;

    // ===== 6. Conditional Value Range Disclosure =====
    // If discloseRange = 1, value must be in [disclosedValueMin, disclosedValueMax]
    component minCheck = LessEqThan(64);
    minCheck.in[0] <== disclosedValueMin;
    minCheck.in[1] <== value;

    component maxCheck = LessEqThan(64);
    maxCheck.in[0] <== value;
    maxCheck.in[1] <== disclosedValueMax;

    // Only enforce if discloseRange = 1
    signal rangeValid;
    rangeValid <== minCheck.out * maxCheck.out;

    signal rangeConstraint;
    rangeConstraint <== (1 - rangeValid) * discloseRange;
    rangeConstraint === 0;

    // ===== 7. Ownership Disclosure (optional public key reveal) =====
    // If discloseOwnership = 1, public key could be made public
    // This is handled by including pkX, pkY in public inputs conditionally
    // For circuit simplicity, we just verify ownership was proven
}

component main {public [noteHash, merkleRoot, disclosureFlags, disclosedTokenType, disclosedValueMin, disclosedValueMax]} =
    SelectiveDisclosure(20);
```

### 주요 제약 조건

1. **노트 진정성**: 노트가 커밋먼트 트리에 존재해야 합니다
2. **소유권 필수**: 증명자가 속성을 공개하려면 노트를 소유해야 합니다
3. **조건부 제약**: 공개 플래그가 특정 증명을 활성화/비활성화합니다
4. **토큰 타입 일치**: 공개된 경우 실제 타입이 주장된 타입과 일치해야 합니다
5. **값 범위**: 공개된 경우 값이 지정된 범위 내에 있어야 합니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **프라이버시 세분성** | 속성 수준 공개 제어 |
| **규정 준수 활성화** | 과도한 공개 없이 요구 사항을 증명합니다 |
| **검증 가능성** | 공개된 속성이 암호학적으로 검증됩니다 |
| **조합 가능성** | 여러 공개를 결합할 수 있습니다 |
| **감사 가능성** | 증명을 감사 추적을 위해 저장할 수 있습니다 |
| **사용자 제어** | 소유자가 공개할 내용을 결정합니다 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **과도한 공개** | 신중한 플래그 선택; 사용자 교육 |
| **재생 공격** | 증명 요청에 타임스탬프 또는 nonce 포함 |
| **상관관계 공격** | 동일한 노트의 반복적인 공개 피하기 |
| **검증자 담합** | 다른 검증자에게 다른 공개 |
| **범위 추론** | 넓은 범위 사용; 좁은 경계 피하기 |
| **노트 식별** | noteHash가 존재를 드러냅니다; 숨기기 고려 |
| **증명 신선도** | 검증자가 merkleRoot 최신성을 확인해야 합니다 |

## 구현 과제

1. **공개 요청 프로토콜**
   - 특정 공개를 요청하는 표준 형식
   - 검증자가 불필요한 데이터를 요청하는 것을 방지합니다
   - 프라이버시 보존 요청 메커니즘 고려

2. **증명 집계**
   - 동일한 노트에 대한 여러 공개
   - 효율성을 위한 배치 증명
   - 반복된 증명을 통한 연결 피하기

3. **취소 및 업데이트**
   - 공개 후 노트 상태가 변경될 수 있습니다
   - 시간 제한 공개 고려
   - Merkle 루트 신선도 요구 사항

4. **사용자 인터페이스**
   - 공개될 내용의 명확한 표시
   - 공개 전 확인
   - 사용자를 위한 과거 공개 로그

5. **검증자 통합**
   - 표준 검증 API
   - 공개 자격 증명 형식
   - 기존 신원 시스템과의 통합

## 파생물

1. **임계값 공개** - 정확한 금액을 드러내지 않고 값이 임계값을 초과하거나 미만임을 증명합니다. 접근 제어(최소 잔액 게이트) 또는 규정 준수(보고 임계값 미만)에 유용합니다. 범위 공개보다 더 프라이빗합니다.

2. **속성 인증** - 선택적으로 공개할 수 있는 제3자 증명. KYC 제공자가 신원 속성을 인증하고, 사용자가 특정 속성을 다른 검증자에게 공개합니다. 분산형 신원 통합입니다.

3. **부분 공개가 있는 범위 증명** - 대략적인 크기를 드러내면서 범위 내 값을 증명합니다(예: "$10K-$100K 사이"). 정확한 소득 없이 신용도에 유용합니다. 버킷 범위 증명입니다.

4. **다중 속성 선택적 공개** - 논리적 제약이 있는 속성 조합을 공개합니다. 단일 증명으로 "토큰이 ETH이고 값 > 1000"입니다. 복잡한 검증에 필요한 증명 수를 줄입니다.

5. **시간 제한 공개** - 지정된 시간 후 만료되는 증명. 오래된 증명의 무한정 재사용을 방지합니다. 회로에 타임스탬프와 온체인 시간 검증이 필요합니다.

## 사용 사례

1. **임대 신청**
   - 집주인이 소득 확인을 요구합니다
   - 세입자가 소득이 월 $5K-$10K 범위에 있음을 증명합니다
   - 정확한 소득, 고용주, 기타 보유 자산이 숨겨집니다
   - 집주인이 프라이버시 침해 없이 보장을 받습니다

2. **토큰 게이트 접근**
   - NFT 커뮤니티가 소유권 증명을 요구합니다
   - 사용자가 올바른 타입의 토큰을 소유하고 있음을 증명합니다
   - 토큰 ID, 기타 보유 자산이 비공개로 유지됩니다
   - Sybil 저항 접근 제어를 가능하게 합니다

3. **세금 규정 준수**
   - 세무 당국이 보유 자산 보고를 요구합니다
   - 사용자가 총 값이 세금 등급 내에 있음을 증명합니다
   - 개별 포지션이 비공개로 유지됩니다
   - 요구 사항을 충족하면서 감사 표면을 줄입니다

4. **신용 평가**
   - 대출자가 신용도 검증이 필요합니다
   - 차용자가 충분한 담보 가치를 증명합니다
   - 정확한 포트폴리오 구성이 숨겨집니다
   - 프라이버시를 갖춘 저담보 대출을 가능하게 합니다

## 실제 제품 및 사용자 경험

자세한 실제 응용 프로그램 및 사용자 경험 시나리오는 [Selective Disclosure - Products & UX](../../product/c-privacy/c5-selective-disclosure-products.md)를 참조하세요.

---

[목차로 돌아가기](../../README.md)
