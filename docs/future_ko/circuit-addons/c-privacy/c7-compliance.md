# C7. Compliance Proof (AML)

정확한 금액이나 신원을 드러내지 않으면서 AML 임계값을 준수하는 트랜잭션을 증명합니다.

**제약 조건**: ~120K | **복잡도**: 낮음

---

## 배경

AML 규정 준수는 전 세계 금융 시스템의 중요한 요구 사항입니다:

- **규제 요구 사항**: AML 법률은 특정 임계값 이상의 트랜잭션 모니터링을 요구합니다(예: 미화 $10,000)
- **프라이버시 충돌**: 전통적인 AML은 전체 트랜잭션 가시성을 요구하여 사용자 프라이버시와 충돌합니다
- **ZK 솔루션**: 정확한 금액이나 참가자 신원을 드러내지 않고 규정 준수를 증명합니다
- **Travel Rule 호환성**: 최소한의 공개로 FATF Travel Rule 요구 사항을 충족할 수 있습니다
- **기관 채택**: 규제 기관이 프라이버시 보존 시스템을 사용할 수 있게 합니다

금융 규제는 트랜잭션 모니터링을 요구하지만, 프라이버시 시스템은 트랜잭션 세부 정보를 숨깁니다. ZK 규정 준수 증명은 기본 데이터를 드러내지 않고 규칙 준수를 증명함으로써 이 격차를 메웁니다. 사용자는 트랜잭션이 보고 임계값 미만이거나 다른 규정 준수 기준을 충족함을 증명할 수 있습니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `noteHash` | field | 검증 중인 노트의 해시 |
| `merkleRoot` | field | 노트 커밋먼트 트리의 루트 |
| `threshold` | uint | 규정 준수 임계값 (예: $10,000) |
| `complianceResult` | uint | 준수하면 1, 아니면 0 |
| `complianceType` | uint | 확인 타입 (0=임계값 미만, 1=보고와 함께 초과) |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `pkX, pkY` | field | 소유자의 공개키 |
| `value` | uint | 노트 값 |
| `tokenType` | uint | 토큰 타입 |
| `salt` | field | 노트 무작위성 |
| `sk` | field | 소유권 증명을 위한 비밀키 |
| `merklePath[TREE_DEPTH]` | field[] | Merkle 증명 경로 |
| `merkleIndex` | uint | Merkle 트리 위치 |
| `pricePerToken` | uint | 토큰 단위당 USD 가격 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template AMLCompliance(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input merkleRoot;
    signal input threshold;          // e.g., 10000 * 10^6 (for $10,000 in USDC units)
    signal input complianceResult;   // Expected: 1 = compliant
    signal input complianceType;     // 0 = under threshold, 1 = reported

    // ===== Private Inputs =====
    signal input pkX, pkY;
    signal input value;
    signal input tokenType;
    signal input salt;
    signal input sk;
    signal input merklePath[TREE_DEPTH];
    signal input merkleIndex;
    signal input pricePerToken;      // Price oracle value (scaled)

    // ===== 1. Verify Note Format =====
    component note = PoseidonRegularNote();
    note.pkX <== pkX;
    note.pkY <== pkY;
    note.value <== value;
    note.tokenType <== tokenType;
    note.salt <== salt;
    note.out === noteHash;

    // ===== 2. Verify Ownership =====
    component own = ProofOfOwnershipStrict();
    own.sk <== sk;
    own.pkX <== pkX;
    own.pkY <== pkY;

    // ===== 3. Verify Merkle Inclusion =====
    component merkle = MerkleProof(TREE_DEPTH);
    merkle.leaf <== noteHash;
    merkle.root <== merkleRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path[i] <== merklePath[i];
    }
    merkle.index <== merkleIndex;

    // ===== 4. Calculate USD Value =====
    signal usdValue;
    usdValue <== value * pricePerToken;

    // ===== 5. Threshold Comparison =====
    component thresholdCheck = LessThan(128);
    thresholdCheck.in[0] <== usdValue;
    thresholdCheck.in[1] <== threshold;

    // underThreshold = 1 if value < threshold
    signal underThreshold;
    underThreshold <== thresholdCheck.out;

    // ===== 6. Compliance Logic =====
    // complianceType = 0: Must be under threshold
    // complianceType = 1: Can be any value (reported externally)

    component typeIsZero = IsZero();
    typeIsZero.in <== complianceType;

    // If type = 0, compliance requires underThreshold = 1
    // If type = 1, compliance always true (external reporting assumed)
    signal typeZeroCompliance;
    typeZeroCompliance <== underThreshold * typeIsZero.out;

    signal typeOneCompliance;
    typeOneCompliance <== 1 - typeIsZero.out;

    signal computedCompliance;
    computedCompliance <== typeZeroCompliance + typeOneCompliance;

    // Verify claimed result matches computed
    complianceResult === computedCompliance;
}

component main {public [noteHash, merkleRoot, threshold, complianceResult, complianceType]} =
    AMLCompliance(20);
```

### 주요 제약 조건

1. **노트 진정성**: 노트가 커밋먼트 트리에 존재합니다
2. **소유권 검증**: 소유자만 자신의 노트에 대한 규정 준수를 증명할 수 있습니다
3. **값 계산**: 토큰 값과 가격으로부터 USD 값이 계산됩니다
4. **임계값 확인**: 규정 준수 임계값과 값을 비교합니다
5. **결과 검증**: 주장된 규정 준수가 계산된 결과와 일치합니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **규제 준수** | AML 임계값 준수를 증명합니다 |
| **프라이버시 보존** | 정확한 금액이 숨겨진 채로 유지됩니다 |
| **자동화된 확인** | 프로그래밍 가능한 규정 준수 검증 |
| **감사 추적** | 규제 감사를 위해 증명을 저장할 수 있습니다 |
| **기관 액세스** | 규제 기관의 참여를 가능하게 합니다 |
| **사용자 주권** | 사용자가 규정 준수를 증명하는 시기/방법을 제어합니다 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **가격 오라클 조작** | TWAP, 여러 오라클 또는 신뢰할 수 있는 피드 사용 |
| **임계값 게임** | 패턴 분석을 통한 구조화 탐지 |
| **허위 규정 준수 주장** | 검증자가 증명을 확인합니다; ZK 증명을 위조할 수 없습니다 |
| **규정 준수 타입 남용** | 타입 1은 외부 검증이 필요합니다 |
| **구식 증명** | 타임스탬프 포함; 최근 merkleRoot 요구 |
| **신원 추론** | 증명은 증명자 신원에 대해 아무것도 드러내지 않습니다 |
| **배치 규정 준수 회피** | 시간대에 걸친 집계 규정 준수 확인 |

## 구현 과제

1. **가격 피드 통합**
   - 각 토큰 타입에 대한 신뢰할 수 있는 USD 가격 필요
   - 오라클 선택: Chainlink, Uniswap TWAP, Band Protocol
   - 가격 구식화 확인 필요

2. **다중 트랜잭션 집계**
   - 단일 트랜잭션은 준수할 수 있지만, 패턴은 그렇지 않을 수 있습니다
   - 24시간 롤링 집계 고려
   - 구조화 탐지는 과거 분석이 필요합니다

3. **관할권 간 임계값**
   - 국가마다 임계값이 다릅니다
   - 미국: $10,000, EU: EUR 10,000, 전 세계적으로 다양함
   - 회로의 매개변수화된 임계값

4. **보고 통합**
   - complianceType = 1인 경우 외부 보고 필요
   - 의심스러운 활동 보고서(SAR) 시스템과의 통합
   - 프라이버시 보존 보고 메커니즘

5. **지속적인 모니터링**
   - 규정 준수는 일회성이 아닙니다; 지속적인 모니터링이 필요합니다
   - 효율성을 위한 배치 규정 준수 증명
   - 실시간 vs. 주기적 검증 트레이드오프

## 파생물

1. **지속적인 규정 준수 모니터링** - 시간 창에서 모든 트랜잭션을 포함하는 주기적인 규정 준수 증명을 생성합니다. 지속적인 규제 요구 사항을 위한 자동화된 증명 생성. 수동 규정 준수 오버헤드를 줄입니다.

2. **다중 관할권 규정 준수** - 여러 규제 체제의 규정 준수를 증명하는 단일 증명. 미국 $10K와 EU EUR 10K 임계값을 동시에 증명합니다. 글로벌 운영을 가능하게 합니다.

3. **규정 준수 점수 생성** - 트랜잭션을 드러내지 않고 트랜잭션 패턴을 기반으로 한 위험 점수. 집계 점수가 전체 규정 준수 자세를 나타냅니다. 기관 위험 관리에 유용합니다.

4. **감사 추적 증명** - 과거 규정 준수를 증명하는 증명 체인. 감사관이 트랜잭션을 검사하는 대신 증명 체인을 검증합니다. 감사 중 프라이버시를 보존합니다.

5. **소급 규정 준수 검증** - 규제가 다를 때 과거 트랜잭션이 준수했음을 증명합니다. 규제 검토를 위한 과거 규정 준수 증명. 변경되는 임계값 요구 사항을 해결합니다.

## 사용 사례

1. **국경 간 송금**
   - 사용자가 국제적으로 자금을 전송합니다
   - 트랜잭션이 $10,000 임계값 미만임을 증명합니다
   - SAR 제출이 필요하지 않습니다
   - 송신자/수신자 프라이버시를 유지합니다

2. **거래소 통합**
   - 중앙화 거래소가 규정 준수 검증이 필요합니다
   - 사용자가 예금/출금이 한도를 준수함을 증명합니다
   - 거래소가 규제 요구 사항을 충족합니다
   - 거래소로부터 사용자 프라이버시가 보존됩니다

3. **기관 DeFi**
   - 은행이 DeFi에 참여하고자 합니다
   - 모든 트랜잭션이 AML을 준수해야 합니다
   - ZK 증명이 규정 준수 요구 사항을 충족합니다
   - 트랜잭션 세부 정보가 비공개로 유지됩니다

4. **결제 처리자 규정 준수**
   - 상인 처리자가 여러 지급을 처리합니다
   - 일일 트랜잭션에 대한 배치 규정 준수 증명
   - 고객 데이터를 노출하지 않고 규제 보고
   - 확장 가능한 규정 준수 솔루션

## 실제 제품 및 사용자 경험

자세한 실제 응용 프로그램 및 사용자 경험 시나리오는 [Compliance Proof (AML) - Products & UX](../../../product/c-privacy/c7-compliance-products.md)를 참조하세요.

---

[목차로 돌아가기](../../README.md)
