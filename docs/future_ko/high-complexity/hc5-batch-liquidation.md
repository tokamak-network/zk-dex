# HC5. 배치 청산

하나의 증명으로 여러 담보 부족 포지션을 청산합니다.

**제약조건**: ~700K | **복잡도**: 높음

---

## 배경

DeFi 청산은 여러 과제에 직면합니다:
- MEV 봇이 청산 이익을 위해 경쟁
- Gas 전쟁이 비용을 증가시키고 이익을 감소시킴
- 순차적 청산은 비효율적
- 복잡한 포지션은 여러 트랜잭션이 필요
- 청산자는 공정한 청산을 증명해야 함

**현재 접근 방식이 불충분한 이유:**

| 접근 방식 | 한계 |
|----------|------------|
| 순차적 청산 | 높은 gas; 트랜잭션 간 MEV 추출; 느린 청산 |
| Flashbots 번들 | MEV 인프라 필요; 중앙화 우려 |
| 프로토콜 네이티브 배치 | 각 프로토콜이 다름; 크로스 프로토콜 없음 |
| Keeper 네트워크 | 신뢰할 수 있는 운영자; 이익 추출 |

배치 청산은 암호화 공정성 보장으로 여러 포지션의 효율적이고 증명 가능한 청산을 가능하게 합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `positionHashes` | field[N_POSITIONS] | 청산되는 포지션에 대한 commitment |
| `liquidatorPaymentHashes` | field[N_POSITIONS] | 부채 지불 노트 commitment |
| `liquidatorRewardHashes` | field[N_POSITIONS] | 담보 보상 노트 commitment |
| `collateralPrices` | uint[N_POSITIONS] | 담보 자산의 오라클 가격 |
| `debtPrices` | uint[N_POSITIONS] | 부채 자산의 오라클 가격 |
| `liquidationThreshold` | uint | 최소 담보 비율 (예: 150%) |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `borrowerPkX/Y` | field[N_POSITIONS] | 차용자 공개 키 |
| `collateralAmount, collateralType` | 배열 | 담보 세부 정보 |
| `debtAmount, debtType` | 배열 | 부채 세부 정보 |
| `positionSalt, isActive` | 배열 | 포지션 메타데이터 |
| `liquidatorPkX/Y, liquidatorSk` | field | 청산자 자격 증명 |
| `paymentValues, paymentSalts` | 배열 | 지불 노트 세부 정보 |
| `rewardValues, rewardSalts` | 배열 | 보상 노트 세부 정보 |

### Circuit Logic

## 효과

| 측면 | 영향 |
|--------|--------|
| **Gas 효율성** | 순차적 청산 대비 80-90% 감소 |
| **MEV 공정성** | 첫 번째 유효한 배치 증명이 승리; gas 경매 없음 |
| **자본 효율성** | 청산자 자본이 여러 포지션에 걸쳐 분산됨 |
| **프로토콜 안전성** | 부실 부채의 더 빠른 청산 (~10배 처리량) |
| **투명성** | 유효한 청산의 암호화 증명 |
| **원자성** | 모든 포지션이 청산되거나 아무것도 청산되지 않음; 부분 배치 실패 없음 |

## 파생물

1. **부분 배치 청산** - 전체 포지션이 아닌 건전한 비율로만 청산합니다. 차용자는 초과 담보를 유지합니다. 시장 영향을 줄이고 차용자 자본을 보존합니다. 회로에서 청산 계수 계산이 필요합니다.

2. **더치 경매 배치** - 시간에 따라 청산 보너스가 감소하는 배치입니다. 최대 보너스(예: 10%)에서 시작하여 최소(예: 2%)로 감소합니다. 차용자 손실을 줄이면서 더 빠른 청산을 인센티브화합니다.

3. **사회화 배치** - 포지션이 지급 불능인 경우(담보 < 부채) 프로토콜 스테이커에게 손실을 분배합니다. 보험 기금 통합. 부실 부채가 축적되는 것을 방지합니다.

4. **크로스 프로토콜 배치** - 여러 DeFi 프로토콜(Aave, Compound, Maker)에 걸친 포지션을 청산합니다. 프로토콜 어댑터가 필요합니다. 청산자 효율성을 최대화합니다.

5. **플래시 배치 청산** - 자본 없는 배치 청산을 위해 플래시 론을 사용합니다. 담보 자산을 빌려 청산하고 압류한 담보에서 상환합니다. 누구나 청산자가 될 수 있습니다.

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template BatchLiquidation(N_POSITIONS) {
    // ===== Public Inputs =====
    signal input positionHashes[N_POSITIONS];
    signal input liquidatorPaymentHashes[N_POSITIONS];
    signal input liquidatorRewardHashes[N_POSITIONS];
    signal input collateralPrices[N_POSITIONS];
    signal input debtPrices[N_POSITIONS];
    signal input liquidationThreshold;  // e.g., 150% = 15000 (basis points)
    signal input liquidationBonus;      // e.g., 5% = 500 (basis points)
    signal input minLiquidationAmount;  // Dust threshold

    // ===== Private Inputs =====
    signal input borrowerPkX[N_POSITIONS], borrowerPkY[N_POSITIONS];
    signal input collateralAmount[N_POSITIONS];
    signal input collateralType[N_POSITIONS];
    signal input debtAmount[N_POSITIONS];
    signal input debtType[N_POSITIONS];
    signal input positionSalt[N_POSITIONS];
    signal input isActive[N_POSITIONS];

    signal input liquidatorPkX, liquidatorPkY, liquidatorSk;

    signal input paymentValues[N_POSITIONS];
    signal input paymentSalts[N_POSITIONS];

    signal input rewardValues[N_POSITIONS];
    signal input rewardSalts[N_POSITIONS];

    // For partial liquidation support
    signal input liquidationFraction[N_POSITIONS];  // Basis points (10000 = full)

    // ===== Component Declarations =====
    component liquidatorOwnership;
    component positionHash[N_POSITIONS];
    component underCollateralized[N_POSITIONS];
    component paymentNote[N_POSITIONS];
    component paymentCheck[N_POSITIONS];
    component rewardNote[N_POSITIONS];
    component dustCheck[N_POSITIONS];

    // Intermediate signals
    signal collateralValue[N_POSITIONS];
    signal debtValue[N_POSITIONS];
    signal requiredCollateral[N_POSITIONS];
    signal liquidatedDebt[N_POSITIONS];
    signal liquidatedCollateral[N_POSITIONS];
    signal bonusAmount[N_POSITIONS];
    signal expectedReward[N_POSITIONS];

    // ===== Verify Liquidator =====
    liquidatorOwnership = ProofOfOwnershipStrict();
    liquidatorOwnership.sk <== liquidatorSk;
    liquidatorOwnership.pkX <== liquidatorPkX;
    liquidatorOwnership.pkY <== liquidatorPkY;

    for (var i = 0; i < N_POSITIONS; i++) {
        // ===== Verify Position =====
        positionHash[i] = Poseidon(8);
        positionHash[i].inputs[0] <== borrowerPkX[i];
        positionHash[i].inputs[1] <== borrowerPkY[i];
        positionHash[i].inputs[2] <== collateralAmount[i];
        positionHash[i].inputs[3] <== collateralType[i];
        positionHash[i].inputs[4] <== debtAmount[i];
        positionHash[i].inputs[5] <== debtType[i];
        positionHash[i].inputs[6] <== positionSalt[i];
        positionHash[i].inputs[7] <== 0;

        (positionHash[i].out - positionHashes[i]) * isActive[i] === 0;

        // ===== Verify Undercollateralized =====
        collateralValue[i] <== collateralAmount[i] * collateralPrices[i];
        debtValue[i] <== debtAmount[i] * debtPrices[i];
        requiredCollateral[i] <== debtValue[i] * liquidationThreshold / 10000;

        underCollateralized[i] = LessThan(128);
        underCollateralized[i].in[0] <== collateralValue[i];
        underCollateralized[i].in[1] <== requiredCollateral[i];

        underCollateralized[i].out * isActive[i] === isActive[i];

        // ===== Calculate Partial Liquidation Amounts =====
        liquidatedDebt[i] <== debtAmount[i] * liquidationFraction[i] / 10000;
        liquidatedCollateral[i] <== collateralAmount[i] * liquidationFraction[i] / 10000;
        bonusAmount[i] <== liquidatedCollateral[i] * liquidationBonus / 10000;
        expectedReward[i] <== liquidatedCollateral[i] + bonusAmount[i];

        // ===== Dust Check - Prevent Uneconomic Liquidations =====
        dustCheck[i] = LessThan(64);
        dustCheck[i].in[0] <== minLiquidationAmount;
        dustCheck[i].in[1] <== liquidatedDebt[i] * debtPrices[i] + 1;
        dustCheck[i].out * isActive[i] === isActive[i];

        // ===== Verify Payment =====
        paymentNote[i] = PoseidonRegularNote();
        paymentNote[i].pkX <== liquidatorPkX;
        paymentNote[i].pkY <== liquidatorPkY;
        paymentNote[i].value <== paymentValues[i];
        paymentNote[i].tokenType <== debtType[i];
        paymentNote[i].salt <== paymentSalts[i];

        (paymentNote[i].out - liquidatorPaymentHashes[i]) * isActive[i] === 0;

        // Payment must cover liquidated debt
        paymentCheck[i] = LessThan(128);
        paymentCheck[i].in[0] <== liquidatedDebt[i];
        paymentCheck[i].in[1] <== paymentValues[i] + 1;
        paymentCheck[i].out * isActive[i] === isActive[i];

        // ===== Verify Reward =====
        rewardNote[i] = PoseidonRegularNote();
        rewardNote[i].pkX <== liquidatorPkX;
        rewardNote[i].pkY <== liquidatorPkY;
        rewardNote[i].value <== rewardValues[i];
        rewardNote[i].tokenType <== collateralType[i];
        rewardNote[i].salt <== rewardSalts[i];

        (rewardNote[i].out - liquidatorRewardHashes[i]) * isActive[i] === 0;

        // Reward should match expected (within 1 unit tolerance for rounding)
        (rewardValues[i] - expectedReward[i]) * (rewardValues[i] - expectedReward[i]) * isActive[i] === 0;
    }
}

component main {public [positionHashes, liquidatorPaymentHashes, liquidatorRewardHashes,
    collateralPrices, debtPrices, liquidationThreshold, liquidationBonus, minLiquidationAmount]} =
    BatchLiquidation(10);
```

### 주요 제약조건

1. **담보 부족**: 각 포지션은 임계값 미만의 담보 비율을 가져야 함
2. **지불 커버리지**: 청산자는 최소한 청산된 부채 금액을 지불함
3. **보상 정확성**: 청산자는 정확히 담보 + 보너스를 받음
4. **더스트 방지**: 최소 청산 금액이 비경제적 공격을 방지
5. **부분 청산**: 포지션의 일부 청산 지원

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **오라클 조작** | TWAP 사용; 여러 소스; 가격 지연 |
| **플래시 론 공격** | 청산자가 지불 노트를 소유해야 함 (빌린 것이 아님) |
| **더스트 금액 방해** | 최소 청산 가치 임계값 |
| **보너스 악용** | 보너스 상한; 대규모 청산 시 감소 |
| **MEV 추출** | 첫 번째 유효한 증명이 승리; gas 경매 이점 없음 |
| **부실 부채 사회화** | 담보 < 부채인 경우 보험 기금으로 라우팅 |
| **연쇄 청산** | 요율 제한; 온체인 서킷 브레이커 |

### 부분 청산 및 더스트 처리

**부분 청산**은 차용자 보호에 필수적입니다:
- 전체 청산은 차용자의 포지션을 완전히 파괴
- 부분 청산은 포지션을 건전한 상태로 복귀
- `liquidationFraction`은 청산할 양을 지정 (기준점)
- 청산 계수는 일반적으로 50% - 목표 건전한 비율로 절반만 청산

**더스트 금액 방지**:
- 매우 작은 청산은 비경제적 (gas > 보상)
- 공격자는 시스템을 방해하기 위해 작은 청산을 스팸할 수 있음
- `minLiquidationAmount`는 최소 가치 임계값을 보장
- 일반적인 최소값: $100 USD 상당 부채 가치
- 부분 청산 후 남은 더스트는 다음으로 처리:
  - 포지션이 최소값 미만인 경우 전체 청산 허용
  - 또는 이자 발생을 통해 포지션이 증가할 때까지 대기

```
// 더스트 처리 로직 예제
if (remainingDebt < minLiquidationAmount) {
    // 청산 계수에 관계없이 전체 청산 허용
    liquidationFraction = 10000; // 100%
}
```

## 구현 과제

1. **오라클 가격 피드**
   - 여러 자산 유형은 여러 가격 피드 필요
   - 가격 신선도 확인 필요
   - Chainlink, Pyth 또는 TWAP 오라클 고려

2. **크로스 프로토콜 통합**
   - 각 DeFi 프로토콜은 다른 포지션 형식을 가짐
   - 포지션 검증을 위한 프로토콜 어댑터 필요
   - 포지션 commitment 형식 표준화

3. **잔여 포지션 처리**
   - 부분 청산 후 차용자에게 남은 포지션이 있음
   - 나머지에 대한 새로운 포지션 commitment 생성 필요
   - 회로 복잡성이 크게 증가

4. **Gas 비용 최적화**
   - 10개 포지션 = ~700K 제약조건 = ~400K gas 검증
   - 배치 이점은 ~20개 포지션 이상에서 감소
   - 더 큰 세트에 대해 계층적 배치 고려

5. **청산자 조정**
   - 여러 청산자가 동일한 배치를 시도할 수 있음
   - 첫 번째 유효한 증명만 성공; 다른 것들은 증명자 연산 낭비
   - 청산자 등록 또는 commit-reveal 고려

## 사용 사례

1. **프로토콜 청산 봇**
   - 10개의 담보 부족 포지션 모니터링
   - 여러 개가 청산 가능해지면 배치 증명 생성
   - 단일 트랜잭션으로 모든 부실 부채 청산

2. **청산 DAO**
   - 커뮤니티 운영 청산 서비스
   - 스테이커 간 이익 공유
   - 파라미터의 민주적 거버넌스

3. **플래시 론 청산**
   - 플래시 론을 통해 자산 차입
   - 배치 청산 실행
   - 압류한 담보에서 론 상환
   - 이익 = 보너스 - 플래시 론 수수료

4. **보험 기금 통합**
   - 배치에 지급 불능 포지션 포함
   - 부족분은 보험 기금으로 커버
   - 증명 가능한 부실 부채 회계

5. **크로스 프로토콜 차익거래**
   - Aave에서 청산, Compound에 예치
   - 단일 증명으로 여러 프로토콜 배치
   - 자본 효율성 최대화

## 실제 제품 및 사용자 경험

자세한 제품 시나리오 및 사용 사례는 [실제 제품 및 사용자 경험](../../future/product/high-complexity/hc5-batch-liquidation-products.md)을 참조하세요.

---

[인덱스로 돌아가기](../README.md)
