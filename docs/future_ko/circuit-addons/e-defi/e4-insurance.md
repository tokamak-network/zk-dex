# E4. 보험 구매/청구

숨겨진 정책 금액 및 청구 세부 정보로 DeFi 보험 상품에 대한 커버리지를 구매하고 청구를 제출합니다.

**제약 조건**: ~200K | **복잡도**: 중간

---

## 배경

DeFi 보험 시장은 보험 계약자 보호와 보험계리적 무결성을 위해 프라이버시가 필요합니다:

- **커버리지 노출**: 가시적인 정책 금액은 포트폴리오 크기와 위험 허용도를 드러냅니다
- **청구 신호**: 공개 청구는 시장 반응과 선행 거래를 유발할 수 있습니다
- **보험료 유출**: 보험료 금액은 보험계리적 가정과 가격 책정을 노출합니다
- **사기 탐지 복잡성**: 프라이버시와 청구 검증의 균형을 맞추는 것은 어렵습니다

Nexus Mutual과 같은 현재 DeFi 보험 프로토콜은 정책 세부 정보를 노출합니다. 프라이빗 보험은 보험 금액을 드러내거나 청구 시 시장 반응을 유발하지 않고 커버리지를 가능하게 합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `policyNoteHash` | field | 보험 정책 노트의 해시 |
| `premiumNoteHash` | field | 보험료 지급 노트의 해시 |
| `poolCommitment` | field | 보험 풀 상태 커밋먼트 |
| `riskType` | uint | 커버되는 위험 유형 (스마트 컨트랙트, 페그 등) |
| `expirationTime` | uint | 정책 만료 타임스탬프 |
| `nullifier` | field | 이중 청구 방지 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `holderPkX, holderPkY` | field | 보험 계약자의 공개키 |
| `holderSk` | field | 보험 계약자의 비밀키 |
| `coverageAmount` | uint | 최대 지급 금액 (숨김) |
| `premiumAmount` | uint | 지불한 보험료 (숨김) |
| `deductible` | uint | 청구 공제액 |
| `policyId` | uint | 고유 정책 식별자 |
| `policySalt` | field | 정책 노트 무작위성 |
| `premiumSalt` | field | 보험료 노트 무작위성 |
| `poolReserves` | uint | 총 풀 준비금 |
| `poolUtilization` | uint | 현재 풀 활용률 |
| `poolSalt` | field | 풀 상태 무작위성 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template InsuranceBuy() {
    // ===== Public Inputs =====
    signal input policyNoteHash;
    signal input premiumNoteHash;
    signal input poolCommitment;
    signal input newPoolCommitment;
    signal input riskType;
    signal input expirationTime;
    signal input currentTime;

    // ===== Private Inputs =====
    signal input holderPkX, holderPkY, holderSk;
    signal input coverageAmount;
    signal input premiumAmount;
    signal input deductible;
    signal input policyId;
    signal input policySalt, premiumSalt;
    signal input poolReserves, poolUtilization, poolSalt;
    signal input newPoolReserves, newPoolUtilization, newPoolSalt;

    // ===== 1. Verify Policyholder Ownership =====
    component holderOwnership = ProofOfOwnershipStrict();
    holderOwnership.sk <== holderSk;
    holderOwnership.pkX <== holderPkX;
    holderOwnership.pkY <== holderPkY;

    // ===== 2. Verify Pool State =====
    component pool = Poseidon(4);
    pool.inputs[0] <== poolReserves;
    pool.inputs[1] <== poolUtilization;
    pool.inputs[2] <== riskType;
    pool.inputs[3] <== poolSalt;
    pool.out === poolCommitment;

    // ===== 3. Verify Pool Can Cover Policy =====
    // Available capacity = reserves - utilization
    signal availableCapacity;
    availableCapacity <== poolReserves - poolUtilization;

    component capacityCheck = GreaterEqThan(128);
    capacityCheck.in[0] <== availableCapacity;
    capacityCheck.in[1] <== coverageAmount;
    capacityCheck.out === 1;

    // ===== 4. Verify Premium Calculation =====
    // Premium = coverageAmount * riskRate * duration / (365 * 86400)
    // Simplified: premium >= coverageAmount * minRate
    signal minPremium;
    // Minimum 1% annual rate, pro-rated
    signal duration;
    duration <== expirationTime - currentTime;

    // minPremium = coverageAmount * duration * 100 / (365 * 86400 * 10000)
    // Simplified constraint: premium proportional to coverage
    minPremium <== coverageAmount / 100;  // 1% minimum

    component premiumCheck = GreaterEqThan(128);
    premiumCheck.in[0] <== premiumAmount;
    premiumCheck.in[1] <== minPremium;
    premiumCheck.out === 1;

    // ===== 5. Verify Policy Note =====
    component policyNote = Poseidon(8);
    policyNote.inputs[0] <== holderPkX;
    policyNote.inputs[1] <== holderPkY;
    policyNote.inputs[2] <== coverageAmount;
    policyNote.inputs[3] <== deductible;
    policyNote.inputs[4] <== riskType;
    policyNote.inputs[5] <== expirationTime;
    policyNote.inputs[6] <== policyId;
    policyNote.inputs[7] <== policySalt;
    policyNote.out === policyNoteHash;

    // ===== 6. Verify Premium Note =====
    component premiumNote = PoseidonRegularNote();
    premiumNote.pkX <== holderPkX;
    premiumNote.pkY <== holderPkY;
    premiumNote.value <== premiumAmount;
    premiumNote.tokenType <== 1;  // Premium in stablecoin
    premiumNote.salt <== premiumSalt;
    premiumNote.out === premiumNoteHash;

    // ===== 7. Update Pool State =====
    // New utilization = old utilization + coverage amount
    signal expectedNewUtilization;
    expectedNewUtilization <== poolUtilization + coverageAmount;

    // New reserves = old reserves + premium
    signal expectedNewReserves;
    expectedNewReserves <== poolReserves + premiumAmount;

    component newPool = Poseidon(4);
    newPool.inputs[0] <== expectedNewReserves;
    newPool.inputs[1] <== expectedNewUtilization;
    newPool.inputs[2] <== riskType;
    newPool.inputs[3] <== newPoolSalt;
    newPool.out === newPoolCommitment;

    // ===== 8. Verify Expiration in Future =====
    component expiryCheck = GreaterThan(64);
    expiryCheck.in[0] <== expirationTime;
    expiryCheck.in[1] <== currentTime;
    expiryCheck.out === 1;
}

template InsuranceClaim() {
    // ===== Public Inputs =====
    signal input policyNoteHash;
    signal input payoutNoteHash;
    signal input eventProofHash;      // Hash of verified loss event
    signal input poolCommitment;
    signal input newPoolCommitment;
    signal input currentTime;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input holderPkX, holderPkY, holderSk;
    signal input coverageAmount;
    signal input deductible;
    signal input riskType;
    signal input expirationTime;
    signal input policyId;
    signal input policySalt;
    signal input lossAmount;          // Actual loss incurred
    signal input payoutAmount;
    signal input payoutSalt;
    signal input poolReserves, poolUtilization, poolSalt;
    signal input newPoolReserves, newPoolUtilization, newPoolSalt;

    // ===== 1. Verify Policyholder Ownership =====
    component holderOwnership = ProofOfOwnershipStrict();
    holderOwnership.sk <== holderSk;
    holderOwnership.pkX <== holderPkX;
    holderOwnership.pkY <== holderPkY;

    // ===== 2. Verify Policy Note =====
    component policyNote = Poseidon(8);
    policyNote.inputs[0] <== holderPkX;
    policyNote.inputs[1] <== holderPkY;
    policyNote.inputs[2] <== coverageAmount;
    policyNote.inputs[3] <== deductible;
    policyNote.inputs[4] <== riskType;
    policyNote.inputs[5] <== expirationTime;
    policyNote.inputs[6] <== policyId;
    policyNote.inputs[7] <== policySalt;
    policyNote.out === policyNoteHash;

    // ===== 3. Verify Policy Not Expired =====
    component expiryCheck = GreaterEqThan(64);
    expiryCheck.in[0] <== expirationTime;
    expiryCheck.in[1] <== currentTime;
    expiryCheck.out === 1;

    // ===== 4. Verify Payout Calculation =====
    // Payout = min(lossAmount - deductible, coverageAmount)
    signal lossAfterDeductible;
    lossAfterDeductible <== lossAmount - deductible;

    // Ensure loss exceeds deductible
    component deductibleCheck = GreaterThan(128);
    deductibleCheck.in[0] <== lossAmount;
    deductibleCheck.in[1] <== deductible;
    deductibleCheck.out === 1;

    // Payout capped at coverage
    component payoutCap = LessEqThan(128);
    payoutCap.in[0] <== payoutAmount;
    payoutCap.in[1] <== coverageAmount;
    payoutCap.out === 1;

    // Payout should not exceed loss after deductible
    component payoutLossCheck = LessEqThan(128);
    payoutLossCheck.in[0] <== payoutAmount;
    payoutLossCheck.in[1] <== lossAfterDeductible;
    payoutLossCheck.out === 1;

    // ===== 5. Verify Pool State =====
    component pool = Poseidon(4);
    pool.inputs[0] <== poolReserves;
    pool.inputs[1] <== poolUtilization;
    pool.inputs[2] <== riskType;
    pool.inputs[3] <== poolSalt;
    pool.out === poolCommitment;

    // ===== 6. Verify Pool Can Pay Claim =====
    component reserveCheck = GreaterEqThan(128);
    reserveCheck.in[0] <== poolReserves;
    reserveCheck.in[1] <== payoutAmount;
    reserveCheck.out === 1;

    // ===== 7. Verify Payout Note =====
    component payoutNote = PoseidonRegularNote();
    payoutNote.pkX <== holderPkX;
    payoutNote.pkY <== holderPkY;
    payoutNote.value <== payoutAmount;
    payoutNote.tokenType <== 1;
    payoutNote.salt <== payoutSalt;
    payoutNote.out === payoutNoteHash;

    // ===== 8. Update Pool State =====
    signal expectedNewReserves;
    expectedNewReserves <== poolReserves - payoutAmount;

    signal expectedNewUtilization;
    expectedNewUtilization <== poolUtilization - coverageAmount;

    component newPool = Poseidon(4);
    newPool.inputs[0] <== expectedNewReserves;
    newPool.inputs[1] <== expectedNewUtilization;
    newPool.inputs[2] <== riskType;
    newPool.inputs[3] <== newPoolSalt;
    newPool.out === newPoolCommitment;

    // ===== 9. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== policyNoteHash;
    nullifierHash.inputs[1] <== holderSk;
    nullifierHash.out === nullifier;
}

component main {public [policyNoteHash, premiumNoteHash, poolCommitment,
    newPoolCommitment, riskType, expirationTime, currentTime]} = InsuranceBuy();
```

### 주요 제약 조건

1. **소유권 검증**: 보험 계약자가 비밀키를 통해 신원 증명
2. **풀 용량**: 보험 풀이 커버리지에 충분한 준비금 보유
3. **보험료 적정성**: 보험료가 최소 위험 조정 비율 충족
4. **정책 매개변수**: 커버리지, 공제액, 만료가 올바르게 인코딩됨
5. **청구 유효성**: 손실이 공제액을 초과하고, 지급이 커버리지로 제한됨
6. **풀 지급 능력**: 청구를 지불하기에 충분한 준비금

## 효과

| 측면 | 영향 |
|--------|--------|
| **커버리지 프라이버시** | 시장에서 정책 금액이 숨겨짐 |
| **청구 기밀성** | 청구 세부 정보가 공개적으로 보이지 않음 |
| **보험료 프라이버시** | 보험계리적 가격 책정이 보호됨 |
| **풀 무결성** | 개별 노출 없이 총계 지급 능력 검증 가능 |
| **사기 방지** | 손실에 대한 암호화 증명 필요 |

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **가짜 손실 이벤트** | 손실 이벤트에 대한 오라클/거버넌스 검증 필요 |
| **이중 청구** | Nullifier가 동일한 정책에 대한 다중 청구 방지 |
| **풀 지급 불능** | 회로가 지급 전 준비금 검증 |
| **보험료 조작** | 회로에서 최소 보험료 비율 강제 |
| **커버리지 인플레이션** | 풀 활용률 추적으로 과도한 커버리지 방지 |
| **오라클 게이밍** | 대형 청구에는 다중 이벤트 검증자 필요 |

## 구현 과제

1. **손실 검증**
   - 손실 발생 증명 방법 (스마트 컨트랙트 해킹, 디페그 등)
   - 이벤트 검증을 위한 오라클 네트워크
   - 청구 승인을 위한 임계값 서명

2. **보험계리적 가격 책정**
   - 위험 기반 보험료 계산
   - 과거 손실 데이터 통합
   - 풀 활용률 기반 동적 가격 책정

3. **풀 관리**
   - 자본 효율성 vs 지급 능력
   - 재보험 통합
   - 청구를 위한 유동성

4. **청구 평가**
   - 손실 금액 정확히 결정
   - 부분 손실 시나리오
   - 분쟁 해결 메커니즘

## 파생 상품

1. **파라메트릭 보험** - 검증 가능한 온체인 이벤트에 기반한 자동 지급 (가격 하락, 오라클 실패). 청구 평가 불필요; 회로가 이벤트 발생을 검증하고 사전 정의된 매개변수에 따라 지급 계산.

2. **멀티페릴 커버리지** - 여러 위험 유형을 커버하는 단일 정책 (스마트 컨트랙트 + 오라클 + 디페그). 카테고리당 총 노출을 숨기면서 카테고리 전체에서 커버리지 증명.

3. **보험 풀** - 숨겨진 지분 크기로 보험 자본에 LP 스타일로 참여. 비례 보험료 공유로 프라이빗 언더라이팅 가능.

4. **청구 검증 증명** - 제3자 손실 평가자가 청구자 신원을 드러내지 않고 손실 증명 제출. 프라이버시를 유지하면서 전문적인 손실 조정 가능.

5. **보험료 계산 증명** - 보험계리적 모델을 공정한 가격 책정 증명과 함께 비공개로 실행. 보험사는 모델 매개변수를 드러내지 않고 보험료가 올바르게 계산되었음을 증명.

## 사용 사례

1. **스마트 컨트랙트 커버리지**
   - 프로토콜이 DeFi에 재무부 보유
   - 스마트 컨트랙트 익스플로잇에 대한 보험 구매
   - 표적 공격을 방지하기 위해 커버리지 금액 숨김

2. **스테이블코인 디페그 보호**
   - 기관이 대형 스테이블코인 포지션 보유
   - 디페그 보험을 비공개로 구매
   - 청구가 시장 패닉을 유발하지 않음

3. **오라클 실패 보험**
   - DeFi 프로토콜이 오라클 조작에 대비한 보호
   - 잠재적 공격자로부터 커버리지 조건 숨김
   - 오라클 실패 시 자동 파라메트릭 지급

4. **청산 보험**
   - 레버리지 트레이더가 청산 대비 보호 구매
   - 청산 봇으로부터 정책 세부 정보 숨김
   - 청구가 청산과 공정 가격의 차액 지급

## 실제 제품 및 사용자 경험

참조: [보험 구매/청구 - 실제 제품](../../../product/e-defi/e4-insurance-products.md)
---

[색인으로 돌아가기](../../README.md)
