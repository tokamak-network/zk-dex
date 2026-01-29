# G5. Audit Disclosure

완전한 장부와 기록을 공개하지 않고 특정 재무 사실을 검증하는 감사자를 위한 선택적 공개 증명.

**Constraints**: ~250K | **Complexity**: Medium

---

## 배경

감사는 투명성을 요구하지만 전체 공개는 종종 과도합니다:

- **경쟁 민감성**: 전체 재무 기록은 가격, 마진 및 전략 계획을 드러냅니다
- **고객 기밀 유지**: 감사 데이터는 계약으로 보호되는 제3자 정보를 포함할 수 있습니다
- **범위 제한**: 감사자는 일반적으로 포괄적인 데이터 덤프가 아닌 특정 사실이 필요합니다
- **지속적 모니터링**: 현대적 감사 접근 방식은 지속적인 전체 접근 없이 지속적인 검증을 요구합니다

기존 감사는 완전한 신뢰(자체 증명) 또는 완전한 공개(전체 기록 접근)를 요구합니다. ZK 감사 공개는 정확한 수치나 기본 거래를 공개하지 않고 특정 재무 주장(예: "수익이 $1M 초과", "카테고리 X의 비용이 임계값 미만")을 증명할 수 있게 합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `entityCommit` | field | 감사 대상 기업 신원에 대한 commitment |
| `auditorCommit` | field | 감사자 신원에 대한 commitment |
| `periodStart` | uint | 감사 기간 시작 타임스탬프 |
| `periodEnd` | uint | 감사 기간 종료 타임스탬프 |
| `assertionHash` | field | 검증되는 주장의 해시 |
| `financialRoot` | field | 재무 기록의 Merkle root |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `entityPkX, entityPkY` | field | 기업의 public key |
| `entitySk` | field | 기업의 secret key |
| `auditorPkX, auditorPkY` | field | 감사자의 public key |
| `revenueAmount` | uint | 기간의 총 수익 |
| `expenseAmounts[N]` | uint[] | 카테고리별 비용 금액 |
| `assetValues[M]` | uint[] | 자산 평가액 |
| `liabilityValues[L]` | uint[] | 부채 금액 |
| `financialProofs` | field[][] | 재무 항목에 대한 Merkle proof |
| `entitySalt, auditorSalt` | field | 신원 commitment 무작위성 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template AuditDisclosure(NUM_EXPENSE_CATS, NUM_ASSETS, NUM_LIABILITIES, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input entityCommit;
    signal input auditorCommit;
    signal input periodStart;
    signal input periodEnd;
    signal input assertionHash;
    signal input financialRoot;

    // ===== Assertion Thresholds (Public) =====
    signal input minRevenue;
    signal input maxTotalExpenses;
    signal input minNetAssets;
    signal input expenseCategoryLimits[NUM_EXPENSE_CATS];

    // ===== Private Inputs =====
    signal input entityPkX, entityPkY;
    signal input entitySk;
    signal input auditorPkX, auditorPkY;
    signal input entitySalt;
    signal input auditorSalt;

    signal input revenueAmount;
    signal input revenueProof[TREE_DEPTH];
    signal input revenueProofIndices[TREE_DEPTH];

    signal input expenseAmounts[NUM_EXPENSE_CATS];
    signal input expenseProofs[NUM_EXPENSE_CATS][TREE_DEPTH];
    signal input expenseProofIndices[NUM_EXPENSE_CATS][TREE_DEPTH];

    signal input assetValues[NUM_ASSETS];
    signal input assetProofs[NUM_ASSETS][TREE_DEPTH];
    signal input assetProofIndices[NUM_ASSETS][TREE_DEPTH];

    signal input liabilityValues[NUM_LIABILITIES];
    signal input liabilityProofs[NUM_LIABILITIES][TREE_DEPTH];
    signal input liabilityProofIndices[NUM_LIABILITIES][TREE_DEPTH];

    // ===== 1. Verify Entity Identity =====
    component entityCommitHash = Poseidon(3);
    entityCommitHash.inputs[0] <== entityPkX;
    entityCommitHash.inputs[1] <== entityPkY;
    entityCommitHash.inputs[2] <== entitySalt;
    entityCommitHash.out === entityCommit;

    // ===== 2. Verify Entity Ownership =====
    component entityOwnership = ProofOfOwnershipStrict();
    entityOwnership.sk <== entitySk;
    entityOwnership.pkX <== entityPkX;
    entityOwnership.pkY <== entityPkY;

    // ===== 3. Verify Auditor Identity =====
    component auditorCommitHash = Poseidon(3);
    auditorCommitHash.inputs[0] <== auditorPkX;
    auditorCommitHash.inputs[1] <== auditorPkY;
    auditorCommitHash.inputs[2] <== auditorSalt;
    auditorCommitHash.out === auditorCommit;

    // ===== 4. Verify Revenue in Financial Records =====
    component revenueLeaf = Poseidon(4);
    revenueLeaf.inputs[0] <== entityPkX;
    revenueLeaf.inputs[1] <== revenueAmount;
    revenueLeaf.inputs[2] <== periodStart;
    revenueLeaf.inputs[3] <== periodEnd;

    component revenueMerkle = MerkleProof(TREE_DEPTH);
    revenueMerkle.leaf <== revenueLeaf.out;
    revenueMerkle.root <== financialRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        revenueMerkle.siblings[i] <== revenueProof[i];
        revenueMerkle.pathIndices[i] <== revenueProofIndices[i];
    }

    // ===== 5. Verify Revenue >= Minimum =====
    component revenueCheck = GreaterEqThan(64);
    revenueCheck.in[0] <== revenueAmount;
    revenueCheck.in[1] <== minRevenue;
    revenueCheck.out === 1;

    // ===== 6. Verify Expenses =====
    signal totalExpenses[NUM_EXPENSE_CATS + 1];
    totalExpenses[0] <== 0;

    component expenseLeaves[NUM_EXPENSE_CATS];
    component expenseMerkle[NUM_EXPENSE_CATS];
    component expenseLimitChecks[NUM_EXPENSE_CATS];

    for (var i = 0; i < NUM_EXPENSE_CATS; i++) {
        // Create expense leaf
        expenseLeaves[i] = Poseidon(4);
        expenseLeaves[i].inputs[0] <== entityPkX;
        expenseLeaves[i].inputs[1] <== expenseAmounts[i];
        expenseLeaves[i].inputs[2] <== i; // category index
        expenseLeaves[i].inputs[3] <== periodEnd;

        // Verify in Merkle tree
        expenseMerkle[i] = MerkleProof(TREE_DEPTH);
        expenseMerkle[i].leaf <== expenseLeaves[i].out;
        expenseMerkle[i].root <== financialRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            expenseMerkle[i].siblings[j] <== expenseProofs[i][j];
            expenseMerkle[i].pathIndices[j] <== expenseProofIndices[i][j];
        }

        // Verify category within limit
        expenseLimitChecks[i] = LessEqThan(64);
        expenseLimitChecks[i].in[0] <== expenseAmounts[i];
        expenseLimitChecks[i].in[1] <== expenseCategoryLimits[i];
        expenseLimitChecks[i].out === 1;

        totalExpenses[i + 1] <== totalExpenses[i] + expenseAmounts[i];
    }

    // Verify total expenses within limit
    component totalExpenseCheck = LessEqThan(64);
    totalExpenseCheck.in[0] <== totalExpenses[NUM_EXPENSE_CATS];
    totalExpenseCheck.in[1] <== maxTotalExpenses;
    totalExpenseCheck.out === 1;

    // ===== 7. Verify Assets =====
    signal totalAssets[NUM_ASSETS + 1];
    totalAssets[0] <== 0;

    component assetLeaves[NUM_ASSETS];
    component assetMerkle[NUM_ASSETS];

    for (var i = 0; i < NUM_ASSETS; i++) {
        assetLeaves[i] = Poseidon(3);
        assetLeaves[i].inputs[0] <== entityPkX;
        assetLeaves[i].inputs[1] <== assetValues[i];
        assetLeaves[i].inputs[2] <== periodEnd;

        assetMerkle[i] = MerkleProof(TREE_DEPTH);
        assetMerkle[i].leaf <== assetLeaves[i].out;
        assetMerkle[i].root <== financialRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            assetMerkle[i].siblings[j] <== assetProofs[i][j];
            assetMerkle[i].pathIndices[j] <== assetProofIndices[i][j];
        }

        totalAssets[i + 1] <== totalAssets[i] + assetValues[i];
    }

    // ===== 8. Verify Liabilities =====
    signal totalLiabilities[NUM_LIABILITIES + 1];
    totalLiabilities[0] <== 0;

    component liabilityLeaves[NUM_LIABILITIES];
    component liabilityMerkle[NUM_LIABILITIES];

    for (var i = 0; i < NUM_LIABILITIES; i++) {
        liabilityLeaves[i] = Poseidon(3);
        liabilityLeaves[i].inputs[0] <== entityPkX;
        liabilityLeaves[i].inputs[1] <== liabilityValues[i];
        liabilityLeaves[i].inputs[2] <== periodEnd;

        liabilityMerkle[i] = MerkleProof(TREE_DEPTH);
        liabilityMerkle[i].leaf <== liabilityLeaves[i].out;
        liabilityMerkle[i].root <== financialRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            liabilityMerkle[i].siblings[j] <== liabilityProofs[i][j];
            liabilityMerkle[i].pathIndices[j] <== liabilityProofIndices[i][j];
        }

        totalLiabilities[i + 1] <== totalLiabilities[i] + liabilityValues[i];
    }

    // ===== 9. Verify Net Assets =====
    signal netAssets;
    netAssets <== totalAssets[NUM_ASSETS] - totalLiabilities[NUM_LIABILITIES];

    component netAssetCheck = GreaterEqThan(64);
    netAssetCheck.in[0] <== netAssets;
    netAssetCheck.in[1] <== minNetAssets;
    netAssetCheck.out === 1;

    // ===== 10. Generate Assertion Hash =====
    component assertionHasher = Poseidon(6);
    assertionHasher.inputs[0] <== entityCommit;
    assertionHasher.inputs[1] <== minRevenue;
    assertionHasher.inputs[2] <== maxTotalExpenses;
    assertionHasher.inputs[3] <== minNetAssets;
    assertionHasher.inputs[4] <== periodStart;
    assertionHasher.inputs[5] <== periodEnd;
    assertionHasher.out === assertionHash;
}

component main {public [entityCommit, auditorCommit, periodStart, periodEnd, assertionHash, financialRoot, minRevenue, maxTotalExpenses, minNetAssets, expenseCategoryLimits]} =
    AuditDisclosure(8, 10, 5, 12);
```

### 주요 제약 조건

1. **기업 권한 부여**: 기업만 자신의 재무 데이터를 공개할 수 있습니다
2. **데이터 무결성**: 모든 재무 수치가 커밋된 재무 기록에 대해 증명됨
3. **임계값 검증**: 각 주장(수익, 비용, 순자산)이 요구사항을 충족함
4. **카테고리 준수**: 비용 카테고리가 개별적으로 제한 내에 있음
5. **기간 바인딩**: 주장이 특정 감사 기간에 바인딩됨

## 효과

| Aspect | Impact |
|--------|--------|
| **프라이버시 보존** | 정확한 수치 숨겨짐; 임계값 준수만 공개됨 |
| **감사 효율성** | 문서 검토 없이 주장의 즉각적인 검증 |
| **범위 제어** | 기업이 정확히 어떤 사실이 공개되는지 제어 |
| **지속적 모니터링** | 실시간 준수 확인 가능 |
| **비용 절감** | 일상적인 검증을 위한 감사자 시간 감소 |

## 보안 고려사항

| Risk | Mitigation |
|------|------------|
| **데이터 조작** | 재무 기록이 감사 전에 Merkle 트리에 커밋됨 |
| **선택적 공개 남용** | 감사자가 기업이 아닌 필요한 주장을 지정 |
| **오래된 데이터** | 기간 타임스탬프가 데이터 신선도를 보장 |
| **공모** | 감사자 신원이 커밋됨; 독립성 검증 가능 |
| **불완전한 공개** | 주장이 모든 필수 감사 영역을 커버해야 함 |
| **기록 변조** | 재무 root가 검증된 프로세스를 통해서만 업데이트됨 |

## 구현 과제

1. **재무 기록 Commitment**
   - 재무 기록이 Merkle 트리에 어떻게 커밋되는가?
   - 회계 시스템과의 통합 (QuickBooks, SAP 등)
   - 수정 및 정정 처리
   - 실시간 대 배치 commitment

2. **주장 표준화**
   - 다른 감사는 다른 주장을 요구
   - 산업별 감사 요구사항
   - 규제 프레임워크 정렬 (SOC2, GAAP, IFRS)

3. **감사자 검증**
   - 감사자가 적절히 허가되었는지 확인하는 방법?
   - 독립성 요구사항
   - 감사자 순환 준수

4. **증거 보존**
   - 증명은 잠재적 미래 분쟁을 위해 저장되어야 함
   - 장기 증명 유효성
   - ZK 맥락에서 작업 문서 동등물

## 파생 상품

1. **Continuous Auditing** - 주기적 증명 생성을 통한 실시간 준수 모니터링. 감사자가 지속적인 접근 없이 지속적인 준수를 검증할 수 있으며, 주장이 실패할 때 자동 알림이 제공됩니다.

2. **Internal Audit Proofs** - 조직 내 부서 또는 사업부 감사. 사업부가 다른 부서에 경쟁적인 내부 데이터를 공개하지 않고 기업에 대한 준수를 증명합니다.

3. **Regulatory Audits** - 특정 규제 프레임워크를 위한 특수 circuit. SOX 준수, 은행 자본 적정성 또는 보험 준비금 요구사항을 전체 공개 없이 증명합니다.

4. **Third-Party Verification** - 고객, 파트너 또는 투자자가 특정 사실을 검증할 수 있게 합니다. 회사가 정확한 수치를 공개하지 않고 최소 순자산 또는 수익 임계값을 증명합니다.

5. **Historical Audit Trails** - 시간 경과에 따른 재무 기록의 일관성을 증명합니다. 기록이 소급적으로 수정되지 않았음을 타임스탬프 검증 및 순차적 증명 연결을 통해 보여줍니다.

## 사용 사례

1. **연간 재무 감사**
   - 상장 기업이 연간 감사를 받음
   - 수익, 비용 및 순자산이 예상 범위 내에 있음을 증명
   - 감사자가 상세한 총계정원장에 접근하지 않고 주장을 검증
   - 이사회가 공개 위험이 감소된 감사 의견을 받음

2. **대출 약정 준수**
   - 차입자가 부채-자본 비율이 임계값 미만임을 증명해야 함
   - 은행이 분기별로 준수를 검증
   - 정확한 재무 상태가 기밀로 유지됨
   - 약정이 위반되면 자동 알림

3. **실사 지원**
   - 인수 대상이 재무 주장을 증명
   - 수익 최소값, 비용 통제, 자산 평가액
   - 인수자가 초기에 전체 데이터 룸 접근 없이 검증
   - 예비 계약 후에만 상세 공개

4. **규제 검사**
   - 은행이 자본 적정성 요구사항이 충족되었음을 증명
   - 특정 비율과 임계값이 검증됨
   - 상세한 대출 포트폴리오 데이터가 비공개로 유지됨
   - 규제 기관이 전체 접근 없이 준수를 확인

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 시나리오는 [실제 제품 및 사용자 경험](../../../product/g-enterprise/g5-audit-products.md)을 참조하십시오.

---

[목차로 돌아가기](../../README.md)
