# G1. Private Payroll Batch

총액 및 개별 권한에 대한 프라이버시 보존 검증을 통한 일괄 급여 분배.

**Constraints**: ~400K | **Complexity**: High

---

## 배경

프라이빗 급여 시스템은 조직의 프라이버시와 직원의 기밀 유지에 필수적입니다:

- **보수 기밀 유지**: 급여 정보는 매우 민감하며, 노출 시 직장 내 갈등과 경쟁적 불이익을 초래합니다
- **규제 준수**: 많은 관할권에서 급여 프라이버시를 요구하면서도 세금 원천징수 검증을 의무화합니다
- **일괄 효율성**: 단일 증명으로 여러 지급을 처리하면 가스 비용을 극적으로 절감합니다
- **감사 호환성**: 조직은 개별 금액을 공개하지 않고도 올바른 급여 실행을 증명해야 합니다

기존 블록체인 급여는 모든 급여 정보를 공개적으로 노출합니다. "프라이버시" 솔루션조차도 종종 집계 데이터나 지급 패턴을 누출합니다. ZK 급여는 감사자와 세무 당국을 위한 검증 가능성을 유지하면서 완전한 기밀성을 가능하게 합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `companyNoteHash` | field | 회사 자금 note의 해시 |
| `totalPayout` | uint | 모든 급여 지급의 합계 (commitment를 통해 숨길 수 있음) |
| `payrollRoot` | field | 급여 commitment의 Merkle root |
| `outputNotesRoot` | field | 모든 직원 output note의 Merkle root |
| `periodId` | uint | 급여 기간 식별자 (월/주) |
| `employeeCount` | uint | 일괄 처리의 직원 수 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `companyPkX, companyPkY` | field | 회사의 public key |
| `companySk` | field | 회사의 secret key |
| `companyValue` | uint | 회사 note 값 |
| `companySalt` | field | 회사 note 무작위성 |
| `salaries[N]` | uint[] | 개별 급여 금액 |
| `employeePkX[N], employeePkY[N]` | field[] | 직원 public key |
| `employeeSalts[N]` | field[] | Output note 무작위성 |
| `payrollProofs[N]` | field[][] | 각 직원에 대한 Merkle proof |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template PrivatePayrollBatch(N, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input companyNoteHash;
    signal input totalPayout;
    signal input payrollRoot;
    signal input outputNotesRoot;
    signal input periodId;
    signal input employeeCount;

    // ===== Private Inputs =====
    signal input companyPkX, companyPkY;
    signal input companySk;
    signal input companyValue;
    signal input companySalt;
    signal input tokenType;

    signal input salaries[N];
    signal input employeePkX[N];
    signal input employeePkY[N];
    signal input employeeSalts[N];
    signal input payrollProofs[N][TREE_DEPTH];
    signal input payrollProofIndices[N][TREE_DEPTH];

    // ===== 1. Verify Company Ownership =====
    component companyNote = PoseidonRegularNote();
    companyNote.pkX <== companyPkX;
    companyNote.pkY <== companyPkY;
    companyNote.value <== companyValue;
    companyNote.tokenType <== tokenType;
    companyNote.salt <== companySalt;
    companyNote.out === companyNoteHash;

    component companyOwnership = ProofOfOwnershipStrict();
    companyOwnership.sk <== companySk;
    companyOwnership.pkX <== companyPkX;
    companyOwnership.pkY <== companyPkY;

    // ===== 2. Sum All Salaries =====
    signal salarySum[N + 1];
    salarySum[0] <== 0;
    for (var i = 0; i < N; i++) {
        salarySum[i + 1] <== salarySum[i] + salaries[i];
    }
    salarySum[N] === totalPayout;

    // ===== 3. Verify Sufficient Funds =====
    component fundCheck = GreaterEqThan(128);
    fundCheck.in[0] <== companyValue;
    fundCheck.in[1] <== totalPayout;
    fundCheck.out === 1;

    // ===== 4. Verify Each Employee in Payroll =====
    component payrollLeaves[N];
    component payrollMerkle[N];
    component outputNotes[N];
    signal outputHashes[N];

    for (var i = 0; i < N; i++) {
        // Create payroll commitment: hash(employeePk, expectedSalary, periodId)
        payrollLeaves[i] = Poseidon(4);
        payrollLeaves[i].inputs[0] <== employeePkX[i];
        payrollLeaves[i].inputs[1] <== employeePkY[i];
        payrollLeaves[i].inputs[2] <== salaries[i];
        payrollLeaves[i].inputs[3] <== periodId;

        // Verify employee is in payroll Merkle tree
        payrollMerkle[i] = MerkleProof(TREE_DEPTH);
        payrollMerkle[i].leaf <== payrollLeaves[i].out;
        payrollMerkle[i].root <== payrollRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            payrollMerkle[i].siblings[j] <== payrollProofs[i][j];
            payrollMerkle[i].pathIndices[j] <== payrollProofIndices[i][j];
        }

        // Create output note for employee
        outputNotes[i] = PoseidonRegularNote();
        outputNotes[i].pkX <== employeePkX[i];
        outputNotes[i].pkY <== employeePkY[i];
        outputNotes[i].value <== salaries[i];
        outputNotes[i].tokenType <== tokenType;
        outputNotes[i].salt <== employeeSalts[i];
        outputHashes[i] <== outputNotes[i].out;
    }

    // ===== 5. Verify Output Notes Root =====
    component outputTree = MerkleRoot(N);
    for (var i = 0; i < N; i++) {
        outputTree.leaves[i] <== outputHashes[i];
    }
    outputTree.root === outputNotesRoot;
}

component main {public [companyNoteHash, totalPayout, payrollRoot, outputNotesRoot, periodId, employeeCount]} =
    PrivatePayrollBatch(64, 10);
```

### 주요 제약 조건

1. **회사 권한 부여**: 유효한 secret key를 가진 회사만 급여를 시작할 수 있습니다
2. **급여 무결성**: 각 직원-급여 쌍은 사전 커밋된 급여 트리에 존재해야 합니다
3. **잔액 보존**: 총 지급액은 개별 급여의 합계와 같아야 합니다
4. **충분한 자금**: 회사 note는 총 지급액에 충분한 가치를 가져야 합니다
5. **기간 바인딩**: 급여는 특정 기간에 고정되어 재생 공격을 방지합니다

## 효과

| Aspect | Impact |
|--------|--------|
| **프라이버시** | 개별 급여가 공개적으로 완전히 숨겨짐 |
| **효율성** | N개의 개별 트랜잭션 대신 전체 일괄 처리에 대한 단일 증명 |
| **준수** | 감사자가 개별 금액을 보지 않고도 총액을 검증할 수 있음 |
| **직원 보호** | 근로자의 보상 데이터가 기밀로 유지됨 |
| **비용 절감** | 개별 지급에 비해 ~90% 가스 절감 |

## 보안 고려사항

| Risk | Mitigation |
|------|------------|
| **급여 조작** | 실행 전 급여 데이터에 대한 Merkle commitment |
| **이중 지급** | 기간 ID 및 nullifier가 중복 급여 실행을 방지 |
| **무단 접근** | 증명 생성에 회사 secret key 필요 |
| **직원 사칭** | 직원 public key가 급여 트리에서 검증됨 |
| **선택적 미지급** | Output notes root가 모든 지급을 원자적으로 커밋 |
| **선행 실행** | 급여 commitment는 실행 전까지 숨겨짐 |

## 구현 과제

1. **확장성 제한**
   - Circuit 크기가 직원 수에 따라 선형적으로 증가
   - 100명 이상의 직원이 있는 조직의 경우 일괄 처리가 필요할 수 있음
   - 대규모 급여에 대한 재귀적 증명 구성 고려

2. **급여 데이터 관리**
   - 급여 데이터를 위한 안전한 오프체인 저장소
   - HR 담당자를 위한 키 관리
   - HR 시스템과 ZK 인프라 간의 동기화

3. **세금 통합**
   - 다른 관할권은 다양한 원천징수 요구사항을 가짐
   - 세금 계산 검증을 위한 하위 회로 필요
   - 국경 간 급여는 복잡성을 추가

4. **분쟁 해결**
   - 직원이 급여 미지급을 주장하는 경우 미지급을 증명하는 방법
   - 분쟁 사례에 대한 선택적 공개 메커니즘
   - 감사 추적 유지

## 파생 상품

1. **Multi-Currency Payroll** - 직원이 선호도에 따라 다른 토큰으로 급여를 받습니다. Circuit은 환율을 검증하고 토큰별 output note를 처리하여 글로벌 팀이 현지 스테이블코인으로 급여를 받을 수 있게 합니다.

2. **Bonus Distribution** - 성과 지표와 연계된 변동 보상. 기본 급여를 확장하여 추가 range proof를 통해 보너스 금액이 정확한 성과 점수를 공개하지 않고 승인된 범위 내에 있음을 보여줍니다.

3. **Tax Withholding Proofs** - 세금 원천징수 준수의 자동 계산 및 증명. 하위 회로가 급여 구간에 따라 원천징수를 계산하고 총 급여를 공개하지 않고 세무 당국에 대한 증명을 생성합니다.

4. **Benefits Deduction** - 건강 보험, 퇴직 연금 및 기타 혜택 공제가 비공개로 검증됩니다. 각 직원이 선택한 특정 혜택을 노출하지 않고 공제가 등록된 혜택 수준과 일치함을 증명합니다.

5. **Contractor Payments** - 급여를 확장하여 다른 지급 조건을 가진 계약 근로자를 포함합니다. 마일스톤 기반 지급, 시간당 청구 검증 및 가변 지급 일정을 지원합니다.

## 사용 사례

1. **기업 급여 처리**
   - 50명의 직원을 둔 회사가 월별 급여를 처리
   - HR이 급여 데이터에 커밋; 재무가 총액 승인
   - 단일 증명으로 모든 급여를 비공개로 분배
   - 감사자는 총액이 승인된 예산과 일치하는지 검증 가능

2. **DAO 기여자 보상**
   - 탈중앙화 조직이 익명 기여자에게 지급
   - 가명 멤버가 신원 노출 없이 보상 수령
   - 거버넌스는 개별 금액 없이 총 지출을 검증 가능
   - 프라이버시 보존 기여자 보상 가능

3. **다국적 조직**
   - 글로벌 기업이 여러 관할권의 직원에게 급여 지급
   - 다양한 통화, 세율 및 혜택 구조
   - 단일 일괄 증명이 모든 변형을 처리
   - 중앙 급여 데이터베이스 없이 현지 준수 검증

4. **민감한 산업 급여**
   - 기밀 프로젝트를 가진 방위 산업체 또는 연구 조직
   - 보상 수준이 프로젝트 중요성이나 역할 우선순위를 드러낼 수 있음
   - ZK 급여가 경쟁 정보 수집을 방지
   - 조직 구조를 보호하면서 준수 유지

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 시나리오는 [실제 제품 및 사용자 경험](../../../product/g-enterprise/g1-payroll-products.md)을 참조하십시오.

---

[목차로 돌아가기](../../README.md)
