# C8. Income Range Proof

정확한 금액이나 개별 출처를 드러내지 않고 총 소득이 지정된 범위 내에 있음을 증명합니다.

**제약 조건**: ~400K (12 노트) | **복잡도**: 중간

---

## 배경

소득 검증은 많은 실제 응용 프로그램에 필요합니다:

- **대출 신청**: 대출자는 신용도 평가를 위한 소득 검증이 필요합니다
- **임대 신청**: 집주인은 임대료를 충당할 충분한 소득 증명을 요구합니다
- **정부 혜택**: 소득 기반 프로그램은 특정 범위 내의 소득을 요구합니다
- **보험 인수**: 생명 및 장애 보험은 소득 검증이 필요합니다
- **프라이버시 보존**: 정확한 소득은 매우 민감한 개인 정보입니다

전통적인 소득 검증은 정확한 금액과 출처를 드러내는 세금 신고서, 급여 명세서, 은행 명세서를 요구합니다. ZK 범위 증명은 정확한 수치나 기본 트랜잭션을 노출하지 않고 소득이 허용 가능한 범위 내에 있음을 증명할 수 있게 합니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `noteHashes[NUM_NOTES]` | field[] | 집계 중인 소득 노트의 해시 |
| `minIncome` | uint | 소득 범위의 하한 |
| `maxIncome` | uint | 소득 범위의 상한 |
| `merkleRoot` | field | 노트 커밋먼트 트리의 루트 |
| `timePeriodStart` | uint | 소득 기간의 시작 (예: 과세 연도) |
| `timePeriodEnd` | uint | 소득 기간의 종료 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `pkX, pkY` | field | 소유자의 공개키 |
| `sk` | field | 소유권 증명을 위한 비밀키 |
| `values[NUM_NOTES]` | uint[] | 개별 노트 값 |
| `tokenTypes[NUM_NOTES]` | uint[] | 각 노트의 토큰 타입 |
| `salts[NUM_NOTES]` | field[] | 각 노트의 무작위성 |
| `timestamps[NUM_NOTES]` | uint[] | 각 노트의 타임스탬프 |
| `merklePaths[NUM_NOTES][TREE_DEPTH]` | field[][] | Merkle 증명 |
| `merkleIndexes[NUM_NOTES]` | uint[] | Merkle 트리 위치 |
| `prices[NUM_NOTES]` | uint[] | 수령 시 토큰당 USD 가격 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template IncomeRangeProof(NUM_NOTES, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input noteHashes[NUM_NOTES];
    signal input minIncome;
    signal input maxIncome;
    signal input merkleRoot;
    signal input timePeriodStart;
    signal input timePeriodEnd;

    // ===== Private Inputs =====
    signal input pkX, pkY;
    signal input sk;
    signal input values[NUM_NOTES];
    signal input tokenTypes[NUM_NOTES];
    signal input salts[NUM_NOTES];
    signal input timestamps[NUM_NOTES];
    signal input merklePaths[NUM_NOTES][TREE_DEPTH];
    signal input merkleIndexes[NUM_NOTES];
    signal input prices[NUM_NOTES];

    // ===== 1. Verify Ownership Once =====
    component own = ProofOfOwnershipStrict();
    own.sk <== sk;
    own.pkX <== pkX;
    own.pkY <== pkY;

    // ===== 2. Process Each Note =====
    component note[NUM_NOTES];
    component merkle[NUM_NOTES];
    component timeStartCheck[NUM_NOTES];
    component timeEndCheck[NUM_NOTES];
    signal usdValues[NUM_NOTES];
    signal validNote[NUM_NOTES];

    for (var i = 0; i < NUM_NOTES; i++) {
        // Verify note format
        note[i] = PoseidonRegularNote();
        note[i].pkX <== pkX;
        note[i].pkY <== pkY;
        note[i].value <== values[i];
        note[i].tokenType <== tokenTypes[i];
        note[i].salt <== salts[i];
        note[i].out === noteHashes[i];

        // Verify Merkle inclusion
        merkle[i] = MerkleProof(TREE_DEPTH);
        merkle[i].leaf <== noteHashes[i];
        merkle[i].root <== merkleRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            merkle[i].path[j] <== merklePaths[i][j];
        }
        merkle[i].index <== merkleIndexes[i];

        // Verify timestamp within period
        timeStartCheck[i] = GreaterEqThan(64);
        timeStartCheck[i].in[0] <== timestamps[i];
        timeStartCheck[i].in[1] <== timePeriodStart;

        timeEndCheck[i] = LessEqThan(64);
        timeEndCheck[i].in[0] <== timestamps[i];
        timeEndCheck[i].in[1] <== timePeriodEnd;

        validNote[i] <== timeStartCheck[i].out * timeEndCheck[i].out;

        // Calculate USD value (only count if in time period)
        usdValues[i] <== values[i] * prices[i] * validNote[i];
    }

    // ===== 3. Sum Total Income =====
    signal partialSums[NUM_NOTES + 1];
    partialSums[0] <== 0;
    for (var i = 0; i < NUM_NOTES; i++) {
        partialSums[i + 1] <== partialSums[i] + usdValues[i];
    }
    signal totalIncome <== partialSums[NUM_NOTES];

    // ===== 4. Range Check =====
    // Verify: minIncome <= totalIncome <= maxIncome
    component minCheck = GreaterEqThan(128);
    minCheck.in[0] <== totalIncome;
    minCheck.in[1] <== minIncome;
    minCheck.out === 1;

    component maxCheck = LessEqThan(128);
    maxCheck.in[0] <== totalIncome;
    maxCheck.in[1] <== maxIncome;
    maxCheck.out === 1;
}

component main {public [noteHashes, minIncome, maxIncome, merkleRoot, timePeriodStart, timePeriodEnd]} =
    IncomeRangeProof(12, 20);
```

### 주요 제약 조건

1. **단일 소유권**: 모든 노트가 동일한 소유자에게 속해야 합니다
2. **노트 진정성**: 각 노트가 커밋먼트 트리에 존재합니다
3. **시간대 필터**: 지정된 기간 내의 노트만 계산됩니다
4. **USD 변환**: 제공된 가격을 사용하여 토큰 값을 USD로 변환합니다
5. **범위 검증**: 총 소득이 [minIncome, maxIncome] 내에 있습니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **프라이버시** | 정확한 소득 금액이 절대 드러나지 않습니다 |
| **유연성** | 검증자가 허용 가능한 범위를 지정합니다 |
| **집계** | 여러 소득 출처가 결합됩니다 |
| **시간 범위 지정** | 관련 기간으로 소득이 제한됩니다 |
| **무신뢰** | 암호학적 증명, 제3자 증명 없음 |
| **재사용 가능성** | 동일한 노트로 다른 범위를 증명할 수 있습니다 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **중복 계산** | 해시를 통한 노트 고유성; 검증자가 사용된 노트 추적 |
| **가격 조작** | 과거 TWAP 가격 사용; 검증자 제공 가격 |
| **미래 소득** | 타임스탬프가 과거여야 합니다 |
| **노트 차용** | 소유권 증명으로 다른 사람의 노트 사용을 방지합니다 |
| **범위 압박** | 검증자는 합리적인 범위를 사용해야 합니다 |
| **구식 데이터** | merkleRoot 신선도 요구 사항 |
| **통화 변환** | 단일 통화(USD)로 표준화합니다 |

## 구현 과제

1. **노트 집계 제한**
   - 회로 크기가 NUM_NOTES에 따라 증가합니다
   - 12개 노트가 합리적입니다; 100개 이상은 비싸집니다
   - 더 큰 세트를 위해 재귀 증명 고려

2. **과거 가격 데이터**
   - 각 노트 생성 시점의 가격 필요
   - 가격 오라클 과거 조회
   - 노트 생성 시 가격 커밋먼트 고려

3. **시간대 처리**
   - 관할권마다 과세 연도가 다릅니다
   - 역년 vs. 회계 연도
   - 다른 목적을 위한 겹치는 기간

4. **다중 토큰 소득**
   - 여러 통화/토큰의 소득
   - 각각 가격 변환이 필요합니다
   - 스테이블코인 소득이 계산을 단순화합니다

5. **소득 출처 분류**
   - 일부 검증자는 출처 타입별 소득을 원합니다
   - 급여 vs. 투자 vs. 선물
   - 추가 노트 메타데이터가 필요할 수 있습니다

## 파생물

1. **다기간 소득 평균** - 여러 연도에 걸친 평균 소득이 범위 내에 있음을 증명합니다. 변동 소득(프리랜서, 계절 근로자)을 완화합니다. 장기 수입 능력을 더 잘 나타냅니다.

2. **소득 출처 검증** - 소득이 특정 출처 타입(고용, 투자, 비즈니스)에서 나왔음을 증명합니다. 출처 타입으로 노트에 태그를 지정하고, 카테고리별로 필터링합니다. 세밀한 소득 검증을 가능하게 합니다.

3. **예상 소득 증명** - 과거 패턴을 기반으로 예상 미래 소득이 기준을 충족함을 증명합니다. 반복 소득 패턴 분석을 사용합니다. 장기 대출 신청에 유용합니다.

4. **비교 소득 증명** - 소득이 다른 당사자보다 크거나 작음을 증명합니다(둘 다 드러내지 않음). 소득 기반 혜택 또는 계층화된 가격 책정에 유용합니다. 프라이버시 보존 비교입니다.

5. **소득 안정성 증명** - 소득 분산이 임계값 미만임을 증명합니다(안정적인 소득). 기간에 걸친 표준 편차를 계산합니다. 대출자는 고분산보다 안정적인 소득을 선호합니다.

## 사용 사례

1. **주택 담보 대출 신청**
   - 은행이 대출 승인을 위한 소득 검증을 요구합니다
   - 차용자가 연간 소득이 $80,000-$150,000 사이임을 증명합니다
   - 은행이 대출 금액에 충분한 소득임을 확인합니다
   - 정확한 급여, 고용주 및 기타 세부 정보가 비공개로 유지됩니다

2. **임대 신청**
   - 집주인이 임대료의 3배 소득 검증을 요구합니다
   - 월 $2,000 임대료의 경우, 연간 >$72,000 증명 필요
   - 세입자가 소득이 $72,000-$200,000 범위에 있음을 증명합니다
   - 정확한 소득이나 고용 세부 정보를 드러내지 않습니다

3. **정부 혜택**
   - 소득 기반 혜택이 임계값 이하의 소득을 요구합니다
   - 신청자가 소득이 $0-$50,000 사이임을 증명합니다
   - 정확한 소득을 드러내지 않고 혜택 자격을 얻습니다
   - 요구 사항을 충족하면서 존엄성을 보존합니다

4. **보험 인수**
   - 생명 보험이 보장 계산을 위한 소득이 필요합니다
   - 신청자가 보장 등급의 소득 구간에 있음을 증명합니다
   - 보험자가 적절한 보장을 계산합니다
   - 정확한 소득이 보험 회사에 노출되지 않습니다

## 실제 제품 및 사용자 경험

자세한 실제 응용 프로그램 및 사용자 경험 시나리오는 [Income Range Proof - Products & UX](../../../product/c-privacy/c8-income-range-products.md)를 참조하세요.

---

[목차로 돌아가기](../../README.md)
