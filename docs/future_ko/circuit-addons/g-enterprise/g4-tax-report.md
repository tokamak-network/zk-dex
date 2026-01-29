# G4. Tax Report Generate

완전한 재무 기록을 공개하지 않고 세금 의무가 충족되었음을 입증하는 프라이버시 보존 세금 준수 증명.

**Constraints**: ~500K | **Complexity**: High

---

## 배경

세금 보고는 프라이버시와 준수 의무 사이의 균형을 요구합니다:

- **재무 프라이버시**: 전체 세금 신고서는 수입원, 투자 전략 및 재무 상태를 드러냅니다
- **준수 검증**: 세무 당국은 세금이 올바르게 계산되었다는 보장이 필요합니다
- **감사 위험**: 과도한 공개는 불필요한 조사를 초래하고, 과소 공개는 벌금 위험이 있습니다
- **국경 간 복잡성**: 다중 관할권 과세는 여러 당국에 대한 선택적 공개를 요구합니다

현재 시스템은 이진 선택을 강요합니다: 전체 공개 또는 미준수. ZK 세금 보고서는 기본 거래, 금액 또는 거래 상대방을 공개하지 않고 실제 재무 데이터를 기반으로 세금 의무가 올바르게 계산되었음을 증명할 수 있게 합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `taxpayerCommit` | field | 납세자 신원에 대한 commitment |
| `taxYear` | uint | 세금 보고 연도 |
| `jurisdictionId` | uint | 세금 관할권 코드 |
| `taxOwed` | uint | 계산된 세금 부채 |
| `taxPaid` | uint | 지급된 세금 금액 |
| `incomeRangeCommit` | field | 소득 구간에 대한 commitment |
| `complianceHash` | field | 준수 입증의 해시 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `taxpayerPkX, taxpayerPkY` | field | 납세자의 public key |
| `taxpayerSk` | field | 납세자의 secret key |
| `totalIncome` | uint | 총 소득 금액 |
| `deductions[N]` | uint[] | 항목별 공제 금액 |
| `deductionTypes[N]` | uint[] | 공제 카테고리 코드 |
| `taxableIncome` | uint | 공제 후 소득 |
| `taxBrackets[M]` | uint[] | 적용 가능한 세금 구간 |
| `taxRates[M]` | uint[] | 각 구간에 대한 세율 |
| `incomeProofs` | field[][] | 소득원에 대한 Merkle proof |
| `taxpayerSalt` | field | 신원 commitment 무작위성 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template TaxReportGenerate(NUM_DEDUCTIONS, NUM_BRACKETS, NUM_INCOME_SOURCES, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input taxpayerCommit;
    signal input taxYear;
    signal input jurisdictionId;
    signal input taxOwed;
    signal input taxPaid;
    signal input incomeRangeCommit;
    signal input complianceHash;
    signal input incomeSourcesRoot;

    // ===== Private Inputs =====
    signal input taxpayerPkX, taxpayerPkY;
    signal input taxpayerSk;
    signal input totalIncome;
    signal input deductions[NUM_DEDUCTIONS];
    signal input deductionTypes[NUM_DEDUCTIONS];
    signal input deductionLimits[NUM_DEDUCTIONS];
    signal input taxableIncome;
    signal input taxBrackets[NUM_BRACKETS];
    signal input taxRates[NUM_BRACKETS];
    signal input incomeSources[NUM_INCOME_SOURCES];
    signal input incomeProofs[NUM_INCOME_SOURCES][TREE_DEPTH];
    signal input incomeProofIndices[NUM_INCOME_SOURCES][TREE_DEPTH];
    signal input taxpayerSalt;
    signal input incomeLowerBound;
    signal input incomeUpperBound;

    // ===== 1. Verify Taxpayer Identity =====
    component taxpayerCommitHash = Poseidon(3);
    taxpayerCommitHash.inputs[0] <== taxpayerPkX;
    taxpayerCommitHash.inputs[1] <== taxpayerPkY;
    taxpayerCommitHash.inputs[2] <== taxpayerSalt;
    taxpayerCommitHash.out === taxpayerCommit;

    // ===== 2. Verify Taxpayer Ownership =====
    component taxpayerOwnership = ProofOfOwnershipStrict();
    taxpayerOwnership.sk <== taxpayerSk;
    taxpayerOwnership.pkX <== taxpayerPkX;
    taxpayerOwnership.pkY <== taxpayerPkY;

    // ===== 3. Verify Income Sources =====
    signal incomeSum[NUM_INCOME_SOURCES + 1];
    incomeSum[0] <== 0;

    component incomeMerkle[NUM_INCOME_SOURCES];
    component incomeLeaves[NUM_INCOME_SOURCES];

    for (var i = 0; i < NUM_INCOME_SOURCES; i++) {
        // Create leaf for income source
        incomeLeaves[i] = Poseidon(3);
        incomeLeaves[i].inputs[0] <== taxpayerPkX;
        incomeLeaves[i].inputs[1] <== incomeSources[i];
        incomeLeaves[i].inputs[2] <== taxYear;

        // Verify income source in Merkle tree
        incomeMerkle[i] = MerkleProof(TREE_DEPTH);
        incomeMerkle[i].leaf <== incomeLeaves[i].out;
        incomeMerkle[i].root <== incomeSourcesRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            incomeMerkle[i].siblings[j] <== incomeProofs[i][j];
            incomeMerkle[i].pathIndices[j] <== incomeProofIndices[i][j];
        }

        incomeSum[i + 1] <== incomeSum[i] + incomeSources[i];
    }

    // Total income must match sum of verified sources
    incomeSum[NUM_INCOME_SOURCES] === totalIncome;

    // ===== 4. Verify Deductions =====
    signal deductionSum[NUM_DEDUCTIONS + 1];
    deductionSum[0] <== 0;

    component deductionChecks[NUM_DEDUCTIONS];

    for (var i = 0; i < NUM_DEDUCTIONS; i++) {
        // Each deduction must be within allowed limit for its type
        deductionChecks[i] = LessEqThan(64);
        deductionChecks[i].in[0] <== deductions[i];
        deductionChecks[i].in[1] <== deductionLimits[i];
        deductionChecks[i].out === 1;

        deductionSum[i + 1] <== deductionSum[i] + deductions[i];
    }

    // ===== 5. Verify Taxable Income Calculation =====
    signal calculatedTaxableIncome;
    calculatedTaxableIncome <== totalIncome - deductionSum[NUM_DEDUCTIONS];

    // Handle case where deductions exceed income
    component taxableCheck = GreaterEqThan(64);
    taxableCheck.in[0] <== calculatedTaxableIncome;
    taxableCheck.in[1] <== 0;

    // Use actual taxable income (minimum 0)
    signal effectiveTaxableIncome;
    effectiveTaxableIncome <== taxableCheck.out * calculatedTaxableIncome;
    effectiveTaxableIncome === taxableIncome;

    // ===== 6. Calculate Tax Using Brackets =====
    signal bracketTax[NUM_BRACKETS];
    signal taxAccum[NUM_BRACKETS + 1];
    taxAccum[0] <== 0;

    component bracketComparators[NUM_BRACKETS];
    signal incomeInBracket[NUM_BRACKETS];

    for (var i = 0; i < NUM_BRACKETS; i++) {
        // Determine income in this bracket
        if (i == 0) {
            bracketComparators[i] = LessThan(64);
            bracketComparators[i].in[0] <== taxableIncome;
            bracketComparators[i].in[1] <== taxBrackets[i];

            // If income < bracket limit, tax all income; else tax up to limit
            incomeInBracket[i] <== bracketComparators[i].out * taxableIncome +
                                   (1 - bracketComparators[i].out) * taxBrackets[i];
        } else {
            bracketComparators[i] = LessThan(64);
            bracketComparators[i].in[0] <== taxableIncome;
            bracketComparators[i].in[1] <== taxBrackets[i];

            signal bracketWidth;
            bracketWidth <== taxBrackets[i] - taxBrackets[i-1];

            signal incomeAbovePrevBracket;
            incomeAbovePrevBracket <== taxableIncome - taxBrackets[i-1];

            // If income exceeds this bracket, use full bracket width
            incomeInBracket[i] <== bracketComparators[i].out * incomeAbovePrevBracket +
                                   (1 - bracketComparators[i].out) * bracketWidth;
        }

        // Calculate tax for this bracket
        bracketTax[i] <== incomeInBracket[i] * taxRates[i] / 10000;
        taxAccum[i + 1] <== taxAccum[i] + bracketTax[i];
    }

    // Verify calculated tax matches claimed tax
    taxAccum[NUM_BRACKETS] === taxOwed;

    // ===== 7. Verify Tax Payment Sufficiency =====
    component paymentCheck = GreaterEqThan(64);
    paymentCheck.in[0] <== taxPaid;
    paymentCheck.in[1] <== taxOwed;
    paymentCheck.out === 1;

    // ===== 8. Verify Income Range Commitment =====
    component incomeRangeHash = Poseidon(2);
    incomeRangeHash.inputs[0] <== incomeLowerBound;
    incomeRangeHash.inputs[1] <== incomeUpperBound;
    incomeRangeHash.out === incomeRangeCommit;

    // Verify income falls within committed range
    component lowerBoundCheck = GreaterEqThan(64);
    lowerBoundCheck.in[0] <== totalIncome;
    lowerBoundCheck.in[1] <== incomeLowerBound;
    lowerBoundCheck.out === 1;

    component upperBoundCheck = LessEqThan(64);
    upperBoundCheck.in[0] <== totalIncome;
    upperBoundCheck.in[1] <== incomeUpperBound;
    upperBoundCheck.out === 1;

    // ===== 9. Generate Compliance Attestation =====
    component complianceHasher = Poseidon(5);
    complianceHasher.inputs[0] <== taxpayerCommit;
    complianceHasher.inputs[1] <== taxYear;
    complianceHasher.inputs[2] <== jurisdictionId;
    complianceHasher.inputs[3] <== taxOwed;
    complianceHasher.inputs[4] <== taxPaid;
    complianceHasher.out === complianceHash;
}

component main {public [taxpayerCommit, taxYear, jurisdictionId, taxOwed, taxPaid, incomeRangeCommit, complianceHash, incomeSourcesRoot]} =
    TaxReportGenerate(10, 5, 20, 12);
```

### 주요 제약 조건

1. **신원 검증**: 납세자 신원이 commitment를 통해 바인딩됨
2. **소득 검증**: 모든 소득원이 Merkle 포함을 통해 증명됨
3. **공제 제한**: 각 공제가 유형에 대한 허용 제한 내에 있음
4. **세금 계산**: 세금이 구간 구조를 사용하여 올바르게 계산됨
5. **지급 충분성**: 지급된 세금이 의무를 충족하거나 초과함
6. **범위 증명**: 소득이 공개된 범위 내에 있음

## 효과

| Aspect | Impact |
|--------|--------|
| **프라이버시 보존** | 정확한 소득과 공제가 공개적으로 숨겨짐 |
| **준수 증명** | 세무 당국이 올바른 계산을 검증할 수 있음 |
| **선택적 공개** | 다른 당국에 다른 정보 제공 |
| **감사 효율성** | 사전 검증된 신고서가 감사 부담을 줄임 |
| **사기 방지** | 소득이 검증 가능하게 소싱되어야 함 |

## 보안 고려사항

| Risk | Mitigation |
|------|------------|
| **소득 과소 보고** | 소득은 검증된 출처의 Merkle 포함을 통해 증명되어야 함 |
| **공제 인플레이션** | 공제가 관할권별 제한으로 상한 설정됨 |
| **허위 신원** | 납세자 소유권 증명 필요 |
| **구간 조작** | 세금 구간과 세율은 계약이 검증하는 public input |
| **이중 보고** | 연도와 관할권이 포함되어 교차 신고 방지 |
| **증명 위조** | 영지식 증명은 암호학적으로 위조 불가능 |

## 구현 과제

1. **소득원 오라클**
   - 누가 검증된 소득원 Merkle 트리를 유지하는가?
   - 고용주 보고 통합
   - 투자 소득 추적
   - 자영업 소득 검증

2. **관할권별 규칙**
   - 다른 국가들은 매우 다른 세법을 가짐
   - 공제 카테고리와 제한이 다름
   - 관할권 플러그인을 위한 모듈식 circuit 설계 필요

3. **다년도 이월**
   - 손실 이월은 연도 간 연결이 필요
   - 자본 이득 계산은 원가 기준 추적이 필요
   - 감가상각 스케줄이 여러 연도에 걸침

4. **감사 호환성**
   - 선택적 공개를 통해 감사 요청을 처리하는 방법
   - 잠재적 분쟁을 위한 증거 보존
   - 기존 세무 당국 시스템과의 통합

## 파생 상품

1. **Multi-Jurisdiction Tax** - 여러 국가에 의무가 있는 납세자를 처리합니다. Circuit은 소득의 적절한 배분, 외국 세액 공제 및 조약 혜택을 증명하여 단일 당국에 전체 글로벌 소득 그림을 공개하지 않습니다.

2. **Capital Gains Calculation** - 투자 세금 계산을 위한 특수 circuit. 특정 포지션이나 거래 전략을 공개하지 않고 거래 이력에서 원가 기준, 보유 기간 및 이득/손실 금액을 증명합니다.

3. **Loss Harvesting Proofs** - 세금 손실 수확이 규칙 내에서 수행되었음을 입증합니다. 포트폴리오 구성을 공개하지 않고 손실이 진짜이고, 워시세일 규칙을 위반하지 않았으며, 손실 금액이 정확함을 증명합니다.

4. **Deduction Verification** - 특정 공제 카테고리에 대한 상세 증명. 수혜자나 공급업체를 공개하지 않고 자선 기부금, 의료비 또는 사업비가 요구사항을 충족함을 증명합니다.

5. **Audit-Ready Reports** - 선택적 공개 기능이 있는 향상된 보고서. 일반적인 감사 쿼리에 대한 증명을 사전 계산하여 쿼리되지 않은 항목에 대한 프라이버시를 유지하면서 신속한 응답을 가능하게 합니다.

## 사용 사례

1. **고액 자산가**
   - 전 세계 여러 출처에서 복잡한 소득
   - 부의 구조를 공개하지 않고 세금 준수 증명
   - 다른 관할권에 다른 공개
   - 세금 거주지의 프라이버시 보존 증명

2. **암호화폐 거래자**
   - 여러 거래소에 걸쳐 수천 건의 거래
   - 자본 이득이 올바르게 계산되었음을 증명
   - 거래 전략을 공개하지 않고 원가 기준 추적
   - 모든 거래를 보여주지 않고 워시세일이 없음을 입증

3. **사업주**
   - 개인 소득과 사업 소득의 혼합
   - 사업 비용 공제가 합법적임을 증명
   - 급여 대 배당금 분할 준수
   - 고객 관련 사업 공제에 대한 프라이버시

4. **국제 직원**
   - 연중 여러 국가에서 근무
   - 관할권 간 적절한 세금 배분 증명
   - 외국 세액 공제 계산
   - 전체 소득 공개 없이 조약 혜택 자격

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 시나리오는 [실제 제품 및 사용자 경험](../../../product/g-enterprise/g4-tax-report-products.md)을 참조하십시오.

---

[목차로 돌아가기](../../README.md)
