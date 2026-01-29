# G7. Credit Score Range

정확한 점수나 기본 신용 이력을 공개하지 않고 점수가 허용 범위 내에 있음을 입증하는 프라이버시 보존 신용도 증명.

**Constraints**: ~200K | **Complexity**: Medium

---

## 배경

신용 점수는 상당한 프라이버시 우려를 만듭니다:

- **점수 민감성**: 정확한 신용 점수는 재무 이력을 드러내고 차별에 사용될 수 있습니다
- **조회 영향**: 기존 신용 조회는 점수에 영향을 미침; 과도한 조회는 절박함을 신호합니다
- **데이터 누출**: 신용 보고서는 상세한 재무 이력, 계좌 정보 및 지급 패턴을 포함합니다
- **범위 충분성**: 대부분의 신용 결정은 점수가 임계값을 초과하는지만 알면 되며, 정확한 값은 필요 없습니다

현재 신용 시스템은 점수와 보고서의 전체 공개를 강요합니다. ZK 신용 증명은 정확한 점수, 상세한 이력을 공개하거나 점수 자체에 영향을 미치는 하드 조회를 트리거하지 않고 신용도(예: "점수 700 이상")를 증명할 수 있게 합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `creditCommitment` | field | 신용 프로필에 대한 commitment |
| `bureauCommit` | field | 신용 조사 기관 신원에 대한 commitment |
| `scoreRangeMin` | uint | 주장되는 최소 점수 |
| `scoreRangeMax` | uint | 주장되는 최대 점수 |
| `reportTimestamp` | uint | 신용 보고서가 생성된 시간 |
| `expiryTimestamp` | uint | 증명이 만료되는 시간 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `userPkX, userPkY` | field | 사용자의 public key |
| `userSk` | field | 사용자의 secret key |
| `actualScore` | uint | 실제 신용 점수 |
| `bureauPkX, bureauPkY` | field | 신용 조사 기관의 public key |
| `bureauSignature` | field[] | 점수 입증에 대한 기관의 서명 |
| `accountCount` | uint | 신용 계좌 수 |
| `utilizationRatio` | uint | 신용 이용률 백분율 |
| `paymentHistory` | uint | 지급 이력 점수 |
| `accountAges` | uint | 평균 계좌 연령(개월) |
| `inquiryCount` | uint | 최근 하드 조회 수 |
| `userSalt` | field | 신원 commitment 무작위성 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/babyjubjub/signature_verify.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template CreditScoreRange(BUREAU_TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input creditCommitment;
    signal input bureauCommit;
    signal input scoreRangeMin;
    signal input scoreRangeMax;
    signal input reportTimestamp;
    signal input expiryTimestamp;
    signal input trustedBureauRoot;

    // ===== Private Inputs =====
    signal input userPkX, userPkY;
    signal input userSk;
    signal input userSalt;

    signal input actualScore;
    signal input bureauPkX, bureauPkY;
    signal input bureauSigR8x, bureauSigR8y, bureauSigS;
    signal input bureauSalt;
    signal input bureauProof[BUREAU_TREE_DEPTH];
    signal input bureauProofIndices[BUREAU_TREE_DEPTH];

    // Credit factors (for detailed verification)
    signal input accountCount;
    signal input utilizationRatio;        // 0-100 percentage
    signal input paymentHistoryScore;     // 0-100 score
    signal input avgAccountAgeMonths;
    signal input recentInquiries;
    signal input derogatoryMarks;

    // ===== 1. Verify User Ownership =====
    component userOwnership = ProofOfOwnershipStrict();
    userOwnership.sk <== userSk;
    userOwnership.pkX <== userPkX;
    userOwnership.pkY <== userPkY;

    // ===== 2. Verify Bureau in Trusted Bureau Tree =====
    component bureauLeaf = Poseidon(2);
    bureauLeaf.inputs[0] <== bureauPkX;
    bureauLeaf.inputs[1] <== bureauPkY;

    component bureauMerkle = MerkleProof(BUREAU_TREE_DEPTH);
    bureauMerkle.leaf <== bureauLeaf.out;
    bureauMerkle.root <== trustedBureauRoot;
    for (var i = 0; i < BUREAU_TREE_DEPTH; i++) {
        bureauMerkle.siblings[i] <== bureauProof[i];
        bureauMerkle.pathIndices[i] <== bureauProofIndices[i];
    }

    // ===== 3. Verify Bureau Identity Commitment =====
    component bureauCommitHash = Poseidon(3);
    bureauCommitHash.inputs[0] <== bureauPkX;
    bureauCommitHash.inputs[1] <== bureauPkY;
    bureauCommitHash.inputs[2] <== bureauSalt;
    bureauCommitHash.out === bureauCommit;

    // ===== 4. Create Credit Report Hash =====
    component creditReportHash = Poseidon(8);
    creditReportHash.inputs[0] <== userPkX;
    creditReportHash.inputs[1] <== actualScore;
    creditReportHash.inputs[2] <== accountCount;
    creditReportHash.inputs[3] <== utilizationRatio;
    creditReportHash.inputs[4] <== paymentHistoryScore;
    creditReportHash.inputs[5] <== avgAccountAgeMonths;
    creditReportHash.inputs[6] <== recentInquiries;
    creditReportHash.inputs[7] <== reportTimestamp;

    // ===== 5. Verify Bureau Signature on Credit Report =====
    component sigVerify = EdDSAVerify();
    sigVerify.msg <== creditReportHash.out;
    sigVerify.pubKeyX <== bureauPkX;
    sigVerify.pubKeyY <== bureauPkY;
    sigVerify.R8x <== bureauSigR8x;
    sigVerify.R8y <== bureauSigR8y;
    sigVerify.S <== bureauSigS;

    // ===== 6. Verify Score Within Claimed Range =====
    // actualScore >= scoreRangeMin
    component minCheck = GreaterEqThan(32);
    minCheck.in[0] <== actualScore;
    minCheck.in[1] <== scoreRangeMin;
    minCheck.out === 1;

    // actualScore <= scoreRangeMax
    component maxCheck = LessEqThan(32);
    maxCheck.in[0] <== actualScore;
    maxCheck.in[1] <== scoreRangeMax;
    maxCheck.out === 1;

    // ===== 7. Verify Credit Score Is Valid (300-850 range) =====
    component validScoreMin = GreaterEqThan(32);
    validScoreMin.in[0] <== actualScore;
    validScoreMin.in[1] <== 300;
    validScoreMin.out === 1;

    component validScoreMax = LessEqThan(32);
    validScoreMax.in[0] <== actualScore;
    validScoreMax.in[1] <== 850;
    validScoreMax.out === 1;

    // ===== 8. Verify Report Not Expired =====
    component expiryCheck = GreaterThan(64);
    expiryCheck.in[0] <== expiryTimestamp;
    expiryCheck.in[1] <== reportTimestamp;
    expiryCheck.out === 1;

    // ===== 9. Verify Credit Factors Are Reasonable =====
    // Utilization should be 0-100
    component utilCheck = LessEqThan(16);
    utilCheck.in[0] <== utilizationRatio;
    utilCheck.in[1] <== 100;
    utilCheck.out === 1;

    // Payment history should be 0-100
    component paymentCheck = LessEqThan(16);
    paymentCheck.in[0] <== paymentHistoryScore;
    paymentCheck.in[1] <== 100;
    paymentCheck.out === 1;

    // ===== 10. Create Credit Commitment =====
    component creditCommit = Poseidon(5);
    creditCommit.inputs[0] <== userPkX;
    creditCommit.inputs[1] <== scoreRangeMin;
    creditCommit.inputs[2] <== scoreRangeMax;
    creditCommit.inputs[3] <== reportTimestamp;
    creditCommit.inputs[4] <== userSalt;
    creditCommit.out === creditCommitment;

    // ===== 11. Output Credit Tier (Optional Disclosure) =====
    signal output creditTier;
    // Tier 0: <580, Tier 1: 580-669, Tier 2: 670-739, Tier 3: 740-799, Tier 4: 800+
    signal tier0, tier1, tier2, tier3, tier4;

    component t0Check = LessThan(32);
    t0Check.in[0] <== actualScore;
    t0Check.in[1] <== 580;
    tier0 <== t0Check.out;

    component t1Check = LessThan(32);
    t1Check.in[0] <== actualScore;
    t1Check.in[1] <== 670;
    tier1 <== (1 - tier0) * t1Check.out;

    component t2Check = LessThan(32);
    t2Check.in[0] <== actualScore;
    t2Check.in[1] <== 740;
    tier2 <== (1 - tier0) * (1 - tier1) * t2Check.out;

    component t3Check = LessThan(32);
    t3Check.in[0] <== actualScore;
    t3Check.in[1] <== 800;
    tier3 <== (1 - tier0) * (1 - tier1) * (1 - tier2) * t3Check.out;

    tier4 <== (1 - tier0) * (1 - tier1) * (1 - tier2) * (1 - tier3);

    creditTier <== tier0 * 0 + tier1 * 1 + tier2 * 2 + tier3 * 3 + tier4 * 4;
}

component main {public [creditCommitment, bureauCommit, scoreRangeMin, scoreRangeMax, reportTimestamp, expiryTimestamp, trustedBureauRoot]} =
    CreditScoreRange(8);
```

### 주요 제약 조건

1. **사용자 소유권**: 사용자가 신용 보고서에 연결된 신원에 대한 제어를 증명합니다
2. **기관 진위성**: 신용 보고서가 신뢰할 수 있는 트리의 기관에 의해 서명됨
3. **점수 범위**: 실제 점수가 주장된 최소-최대 범위 내에 있음
4. **점수 유효성**: 점수가 표준 300-850 범위 내에 있음
5. **보고서 신선도**: 보고서가 검증 시점에 만료되지 않음
6. **요인 범위**: 신용 요인이 합리적 범위 내에 있음

## 효과

| Aspect | Impact |
|--------|--------|
| **점수 프라이버시** | 정확한 점수가 숨겨짐; 범위만 공개됨 |
| **하드 조회 없음** | ZK 증명이 새로운 신용 조회를 요구하지 않음 |
| **차별 감소** | 범위 기반 결정이 정확한 점수 편향을 줄임 |
| **다중 신청** | 하나의 증명이 여러 대출 기관에서 작동함 |
| **요인 보호** | 상세한 신용 요인이 비공개로 유지됨 |

## 보안 고려사항

| Risk | Mitigation |
|------|------------|
| **가짜 신용 보고서** | 기관 서명 검증 필요 |
| **기관 손상** | 신뢰할 수 있는 트리의 기관만 허용됨 |
| **오래된 보고서** | 만료 타임스탬프가 신선도를 강제함 |
| **점수 조작** | 점수 범위가 유효한 범위에 대해 확인됨 |
| **신원 도용** | 사용자 소유권 증명이 보고서를 사용자에게 바인딩 |
| **범위 게이밍** | 대출 기관이 사용자가 아닌 최소 범위를 지정 |

## 구현 과제

1. **기관 통합**
   - 주요 기관(Equifax, Experian, TransUnion)이 서명을 채택해야 함
   - 서명된 신용 보고서를 위한 API 통합
   - 다른 기관 점수 모델 간의 조정

2. **점수 모델 변형**
   - 다른 대출 기관은 다른 채점 모델을 사용함 (FICO, VantageScore)
   - 모델 버전 차이 (FICO 8 대 FICO 9)
   - 산업별 점수 (자동차, 모기지)

3. **실시간 검증**
   - 신용 점수가 자주 변경됨
   - 적절한 증명 유효 기간 결정
   - 신선도와 사용자 편의성의 균형

4. **규제 준수**
   - Fair Credit Reporting Act 요구사항
   - Equal Credit Opportunity Act 준수
   - 불리한 조치 통지 요구사항

## 파생 상품

1. **Multi-Bureau Aggregation** - 여러 기관의 점수를 단일 증명으로 결합합니다. 개별 기관 점수나 어떤 기관이 어떤 점수를 제공했는지 공개하지 않고 기관 간 평균 또는 최고 점수를 증명합니다.

2. **Score History Proofs** - 시간 경과에 따른 신용 점수 궤적을 보여줍니다. 과거 점수를 공개하지 않고 Y개월 동안 점수가 X점 향상되었음을 증명하며, 신용 회복을 입증하는 데 유용합니다.

3. **Credit Factor Disclosure** - 특정 신용 요인의 선택적 공개. 점수나 다른 요인을 공개하지 않고 낮은 이용률 또는 긴 신용 이력을 증명하며; 요인별 언더라이팅을 가능하게 합니다.

4. **Score Improvement Tracking** - 신용 개선 계획 준수를 증명합니다. 시작점이나 정확한 현재 위치를 공개하지 않고 신용 목표를 향한 진행 상황을 보여줍니다.

5. **Cross-Border Credit** - 관할권 간 신용도를 번역합니다. 외국 대출 기관 수락을 위해 본국 기관 데이터를 사용하여 동등한 신용도를 증명합니다.

## 사용 사례

1. **임대 신청**
   - 세입자가 아파트에 지원
   - 집주인의 최소값(예: 650) 이상의 신용 점수를 증명
   - 집주인은 정확한 점수나 전체 신용 보고서를 보지 못함
   - 세입자의 점수에 하드 조회 영향 없음

2. **사전 자격**
   - 소비자가 자동차 대출을 쇼핑
   - 점수가 "좋음" 계층에 있음을 보여주는 증명 생성
   - 여러 조회 없이 여러 딜러와 공유
   - 실제 점수는 선택한 대출 기관에만 공개됨

3. **고용 심사**
   - 고용주가 금융 역할에 대한 신용 조회를 요구
   - 후보자가 임계값 이상의 점수를 증명
   - 정확한 점수와 재무 세부 정보가 비공개로 유지됨
   - 최소 공개로 고용주 요구사항 충족

4. **보험 가격**
   - 보험 회사가 가격 책정에 신용을 사용
   - 고객이 할인 자격을 위해 점수 계층을 증명
   - 계층 기반 가격 책정에는 정확한 점수가 필요 없음
   - 더 나은 요율에 접근하면서 프라이버시 보존

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 시나리오는 [실제 제품 및 사용자 경험](../../product/g-enterprise/g7-credit-products.md)을 참조하십시오.

---

[목차로 돌아가기](../../README.md)
