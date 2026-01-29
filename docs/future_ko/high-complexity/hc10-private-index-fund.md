# HC10. 프라이빗 인덱스 펀드 리밸런싱

복잡한 리밸런싱 로직으로 여러 자산을 추적하는 프라이빗 인덱스 펀드를 관리합니다.

**제약조건**: ~900K | **복잡도**: 매우 높음

---

## 배경

인덱스 펀드 관리는 민감한 작업을 포함합니다:
- 리밸런싱 거래가 포트폴리오 구성을 신호함
- 대규모 거래가 시장을 움직임 (정보 유출)
- 투자자 포지션이 부의 분포를 드러냄
- 수수료 계산은 검증 가능해야 함
- 규제 준수는 감사 추적이 필요

**현재 접근 방식이 불충분한 이유:**

| 접근 방식 | 한계 |
|----------|------------|
| 온체인 펀드 (예: TokenSets) | 모든 보유량 공개; 선행 거래가 만연함 |
| 전통적인 펀드 보관 | 불투명한 운영; 보관인에 대한 신뢰 |
| DAO 재무부 | 투명한 보유량; 거버넌스 공격 |
| 헤지 펀드 SPV | 제한된 접근; 높은 최소 금액; 느린 결제 |

프라이빗 인덱스 펀드 회로는 암호화 감사 가능성을 유지하면서 완전한 프라이버시로 기관급 펀드 관리를 가능하게 합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `fundCommitment` | field | 현재 펀드 상태 commitment |
| `newFundCommitment` | field | 리밸런스 후 펀드 상태 |
| `indexWeights` | uint[N_ASSETS] | 목표 인덱스 가중치 (기준점) |
| `oraclePrices` | uint[N_ASSETS] | 현재 자산 가격 |
| `managementFee` | uint | 기준점의 연간 수수료 |
| `performanceFee` | uint | 성과 수수료 백분율 |
| `benchmarkReturn` | uint | 성과 수수료를 위한 벤치마크 수익 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `managerPkX/Y, managerSk` | field | 펀드 매니저 자격 증명 |
| `currentHoldings, newHoldings` | uint[N_ASSETS] | 자산 수량 |
| `holdingSalts` | field[N_ASSETS] | 보유 노트 salt |
| `investorPkX/Y, investorShares, investorShareSalts` | 배열 | 투자자 포지션 |
| `previousNAV, currentNAV` | uint | 순자산가치 |

### Circuit Logic

## 효과

| 측면 | 영향 |
|--------|--------|
| **정보 유출** | 제로 - 모든 포지션과 거래가 비공개 |
| **시장 영향** | 리밸런스의 선행 거래 제거됨 |
| **투자자 프라이버시** | 포지션 크기가 절대 공개되지 않음 |
| **수수료 투명성** | 검증 가능한 수수료 계산 |
| **준수** | 암호화 감사 추적 |
| **확장성** | 20개 자산, 100명 투자자에 대한 단일 증명 |

## 파생물

1. **액티브 펀드 관리** - 위임 제약 내에서 재량적 거래. 매니저는 유연성이 있지만 리스크 한계 내에 머물러야 합니다. 회로가 섹터 한계, 집중 한계 등을 강제합니다.

2. **다중 매니저 펀드** - 할당 한계가 있는 여러 매니저. 각 매니저는 하위 한계로 일부를 제어합니다. 집계된 증명이 모든 매니저의 준수를 검증합니다.

3. **스마트 베타 펀드** - 팩터 기반 리밸런싱 (가치, 모멘텀, 품질, 변동성). 오라클의 팩터 점수를 포함합니다. 목표 팩터 노출로 리밸런스합니다.

4. **레버리지 펀드** - 빌린 자산으로 리밸런싱. 레버리지 비율 제약 조건 포함. 마진 요구사항 유지를 검증합니다.

5. **펀드 오브 펀드** - 여러 하위 펀드에 걸친 할당 관리. 하위 펀드 준수를 위한 재귀 증명. 마스터 증명이 모든 하위 펀드 상태를 집계합니다.

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template PrivateIndexFund(N_ASSETS, N_INVESTORS) {
    // ===== Public Inputs =====
    signal input fundCommitment;
    signal input newFundCommitment;
    signal input indexWeights[N_ASSETS];
    signal input oraclePrices[N_ASSETS];
    signal input managementFee;       // Annual fee in basis points
    signal input performanceFee;      // % of gains above benchmark
    signal input highWaterMark;       // Previous peak NAV for performance fee
    signal input rebalanceTimestamp;  // For time-based fee accrual

    // ===== Private Inputs =====
    signal input managerPkX, managerPkY, managerSk;

    signal input currentHoldings[N_ASSETS];
    signal input currentHoldingSalts[N_ASSETS];

    signal input newHoldings[N_ASSETS];
    signal input newHoldingSalts[N_ASSETS];

    signal input investorPkX[N_INVESTORS], investorPkY[N_INVESTORS];
    signal input investorShares[N_INVESTORS];
    signal input investorShareSalts[N_INVESTORS];
    signal input investorIsActive[N_INVESTORS];

    signal input previousNAV;
    signal input currentNAV;
    signal input benchmarkReturn;
    signal input daysSinceLastRebalance;

    // ===== Component Declarations =====
    component managerOwnership;
    component fundHash;
    component newFundHash;
    component navCheck;
    component excessCheck;
    component weightCheck[N_ASSETS];
    component sharesSumCheck;

    // Intermediate signals
    signal actualWeight[N_ASSETS];
    signal weightDeviation[N_ASSETS];
    signal deviationSq[N_ASSETS];
    signal fundReturn;
    signal excessReturn;
    signal managementFeeAmount;
    signal performanceFeeAmount;
    signal totalFees;

    // ===== Verify Manager =====
    managerOwnership = ProofOfOwnershipStrict();
    managerOwnership.sk <== managerSk;
    managerOwnership.pkX <== managerPkX;
    managerOwnership.pkY <== managerPkY;

    // ===== Calculate Current NAV =====
    var calculatedNAV = 0;
    for (var i = 0; i < N_ASSETS; i++) {
        calculatedNAV += currentHoldings[i] * oraclePrices[i];
    }
    // Verify NAV matches claimed value
    calculatedNAV === currentNAV;

    // ===== Verify Investor Shares Sum to 100% =====
    var totalShares = 0;
    for (var i = 0; i < N_INVESTORS; i++) {
        totalShares += investorShares[i] * investorIsActive[i];
    }
    // Total shares should equal 10000 (100% in basis points)
    totalShares === 10000;

    // ===== Verify Fund Commitment =====
    fundHash = Poseidon(N_ASSETS * 2 + N_INVESTORS * 3 + 4);
    fundHash.inputs[0] <== managerPkX;
    fundHash.inputs[1] <== managerPkY;
    fundHash.inputs[2] <== previousNAV;
    fundHash.inputs[3] <== highWaterMark;

    var idx = 4;
    for (var i = 0; i < N_ASSETS; i++) {
        fundHash.inputs[idx] <== currentHoldings[i];
        fundHash.inputs[idx + 1] <== currentHoldingSalts[i];
        idx += 2;
    }
    for (var i = 0; i < N_INVESTORS; i++) {
        fundHash.inputs[idx] <== investorPkX[i];
        fundHash.inputs[idx + 1] <== investorPkY[i];
        fundHash.inputs[idx + 2] <== investorShares[i];
        idx += 3;
    }
    fundHash.out === fundCommitment;

    // ===== Calculate Fees =====
    // Fund return = (currentNAV - previousNAV) / previousNAV * 10000
    fundReturn <-- (currentNAV - previousNAV) * 10000 / previousNAV;

    // Management fee (pro-rata for days elapsed)
    managementFeeAmount <== currentNAV * managementFee * daysSinceLastRebalance / 10000 / 365;

    // Performance fee (only on gains above high water mark)
    excessCheck = LessThan(64);
    excessCheck.in[0] <== highWaterMark;
    excessCheck.in[1] <== currentNAV;

    // If currentNAV > highWaterMark, calculate performance fee
    signal navAboveHWM;
    navAboveHWM <== (currentNAV - highWaterMark) * excessCheck.out;
    performanceFeeAmount <== navAboveHWM * performanceFee / 100;

    totalFees <== managementFeeAmount + performanceFeeAmount;

    // ===== Verify Rebalancing Follows Index =====
    var newNAV = 0;
    for (var i = 0; i < N_ASSETS; i++) {
        newNAV += newHoldings[i] * oraclePrices[i];
    }

    // New NAV should equal current NAV minus fees (within tolerance)
    navCheck = LessThan(64);
    navCheck.in[0] <== (currentNAV - totalFees) * 99 / 100;  // 1% tolerance
    navCheck.in[1] <== newNAV + 1;
    navCheck.out === 1;

    // Each asset should be close to target weight
    for (var i = 0; i < N_ASSETS; i++) {
        actualWeight[i] <== newHoldings[i] * oraclePrices[i] * 10000 / newNAV;
        weightDeviation[i] <== actualWeight[i] - indexWeights[i];
        deviationSq[i] <== weightDeviation[i] * weightDeviation[i];

        weightCheck[i] = LessThan(32);
        weightCheck[i].in[0] <== deviationSq[i];
        weightCheck[i].in[1] <== 100 * 100 + 1;  // 1% tolerance squared
        weightCheck[i].out === 1;
    }

    // ===== Verify New Fund Commitment =====
    // Update high water mark if NAV increased
    signal newHighWaterMark;
    newHighWaterMark <== currentNAV * excessCheck.out + highWaterMark * (1 - excessCheck.out);

    newFundHash = Poseidon(N_ASSETS * 2 + N_INVESTORS * 3 + 4);
    newFundHash.inputs[0] <== managerPkX;
    newFundHash.inputs[1] <== managerPkY;
    newFundHash.inputs[2] <== newNAV;
    newFundHash.inputs[3] <== newHighWaterMark;

    idx = 4;
    for (var i = 0; i < N_ASSETS; i++) {
        newFundHash.inputs[idx] <== newHoldings[i];
        newFundHash.inputs[idx + 1] <== newHoldingSalts[i];
        idx += 2;
    }
    for (var i = 0; i < N_INVESTORS; i++) {
        newFundHash.inputs[idx] <== investorPkX[i];
        newFundHash.inputs[idx + 1] <== investorPkY[i];
        newFundHash.inputs[idx + 2] <== investorShares[i];
        idx += 3;
    }
    newFundHash.out === newFundCommitment;
}

component main {public [fundCommitment, newFundCommitment, indexWeights,
    oraclePrices, managementFee, performanceFee, highWaterMark, rebalanceTimestamp]} =
    PrivateIndexFund(20, 100);
```

### 주요 제약조건

1. **매니저 승인**: 펀드 매니저만 리밸런스를 트리거할 수 있음
2. **NAV 계산**: 보유량 * 가격이 주장된 NAV와 일치해야 함
3. **지분 무결성**: 투자자 지분이 100%로 합산됨
4. **수수료 정확성**: 관리 및 성과 수수료가 올바르게 계산됨
5. **인덱스 추적**: 자산 가중치가 목표의 허용 범위 내
6. **최고 수위표**: 새로운 이익에 대해서만 성과 수수료

### 수수료 구조 세부 정보

| 수수료 유형 | 계산 | 일반적인 범위 |
|----------|-------------|---------------|
| 관리 수수료 | NAV * 비율 * 일수 / 365 | 연간 0.5% - 2% |
| 성과 수수료 | (NAV - HWM) * 비율 | 이익의 10% - 20% |
| 진입/퇴출 수수료 | (이 회로에 없음) | 0% - 2% |

**최고 수위표 (HWM)**는 성과 수수료가 새로운 이익에 대해서만 부과되도록 보장합니다:
- 달성한 최고 NAV를 추적
- HWM을 초과하는 금액에 대해서만 성과 수수료
- 손실 후 이중 청구 방지

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **NAV 조작** | 신뢰할 수 있는 소스의 오라클 가격; TWAP |
| **수수료 추출** | 수수료 공식이 공개; 회로에서 검증 가능 |
| **매니저 위법 행위** | 인덱스 추적 강제; 허용 범위를 벗어날 수 없음 |
| **투자자 희석** | 지분 합계 = 100% 제약 조건이 인플레이션 방지 |
| **리밸런스 선행 거래** | 실행 후까지 거래가 공개되지 않음 |
| **무단 리밸런스** | 매니저 소유권 증명 필요 |
| **오라클 신선도** | 가격 데이터에 대한 타임스탬프 확인 |
| **지분 조작** | 투자자 지분 변경에는 별도의 증명 필요 |

## 구현 과제

1. **대규모 상태 관리**
   - 20개 자산 + 100명 투자자 = 복잡한 상태
   - Poseidon 해시 입력 한계 (~일반적으로 16개 필드)
   - 계층적 해싱 또는 Merkle 트리 필요

2. **회로에서의 나눗셈**
   - NAV/지분 계산에 나눗셈 필요
   - 사전 계산된 몫 사용; 곱셈을 통해 검증
   - 정수 나눗셈이 반올림 오류 발생

3. **투자자 추가/제거**
   - 새로운 투자자가 가입하거나 지분을 상환
   - 별도의 구독/상환 증명 필요
   - 지분 희석/통합 로직

4. **거래 실행**
   - 회로가 리밸런스 유효성을 검증
   - 실제 거래는 별도로 실행됨
   - 원자적 실행 또는 에스크로 필요

5. **다중 기간 회계**
   - 리밸런스 기간 전반에 걸쳐 성과 추적
   - 누적 수수료 발생
   - 투자자별 성과 (늦게 가입한 사람을 위해)

## 사용 사례

1. **프라이빗 인덱스 펀드**
   - 상위 20개 보유량으로 S&P 500 추적
   - 프라이빗 포지션 크기의 100명 투자자
   - 목표 가중치로 자동 리밸런싱
   - 검증 가능한 수수료 공제

2. **헤지 펀드**
   - 제약 내에서 액티브 관리
   - 알파 생성에 대한 성과 수수료
   - 경쟁적 이유로 투자자 프라이버시
   - 감사 추적을 통한 규제 준수

3. **DAO 재무부 관리**
   - 20개 자산에 걸친 다각화된 재무부
   - 토큰 보유자가 "투자자"로
   - 거버넌스 승인 리밸런싱
   - 투명한 수수료 구조

4. **패밀리 오피스**
   - 다세대 자산 관리
   - 다른 가족 구성원이 투자자로
   - 가족 구성원 간 프라이버시
   - 수탁 의무 증명 가능

5. **연금 펀드**
   - 장기 투자 위임
   - 규제 할당 요구사항
   - 검증 가능한 준수
   - 수혜자 프라이버시

## 실제 제품 및 사용자 경험

자세한 제품 시나리오 및 사용 사례는 [실제 제품 및 사용자 경험](../../future/product/high-complexity/hc10-private-index-fund-products.md)을 참조하세요.

---

[인덱스로 돌아가기](../README.md)
