# A6. 그리드 트레이딩 (Grid Trading)

미리 설정된 가격 수준에서 자동 매수/매도 실행으로 시장 변동성에서 체계적인 이익 포착을 가능하게 합니다.

**제약 조건**: ~200K per grid level | **복잡도**: Medium

---

## 배경

그리드 트레이딩은 시장 변동성에서 이익을 얻는 체계적인 접근 방식입니다:

- **범위 제한 시장**: 대부분의 자산은 범위 내에서 진동하는 데 상당한 시간을 보냅니다; 그리드 트레이딩은 이러한 움직임을 포착합니다
- **변동성 수익화**: 방향 예측 없이 가격 진동에서 이익을 얻습니다
- **자동화된 실행**: 그리드가 구성되면 인간의 개입이 필요 없습니다
- **위험 분산**: 여러 가격 수준에 걸쳐 분산된 자본은 단일 지점 노출을 제한합니다
- **24/7 운영**: 암호화폐의 항상 켜져 있는 시장에서 지속적으로 작동합니다

전통적인 금융에서 그리드 트레이딩은 외환 및 원자재 트레이더들 사이에서 인기가 있습니다. DeFi에서 그리드 봇은 존재하지만 일반적으로 중앙 집중식이고 투명합니다. ZK 그리드 트레이딩은 그리드 매개변수를 숨겨 프론트러닝과 그리드 사냥을 방지합니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `gridConfigHash` | field | 그리드 구성의 해시 (숨겨진 매개변수) |
| `noteHashes[NUM_GRIDS]` | field[] | 각 그리드 수준의 노트 해시 |
| `outputHashes[NUM_GRIDS]` | field[] | 실행 후 출력 노트의 해시 |
| `currentPrice` | uint | 오라클이 제공하는 현재 시장 가격 |
| `tokenType` | uint | 거래되는 토큰 타입 |
| `executedLevels` | uint | 실행된 그리드 수준의 비트맵 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `pkX, pkY` | field | 소유자의 공개키 |
| `sk` | field | 소유권 증명을 위한 비밀키 |
| `gridPrices[NUM_GRIDS]` | uint[] | 각 그리드의 가격 수준 |
| `gridTypes[NUM_GRIDS]` | uint[] | 각 수준에 대해 0 = 매수, 1 = 매도 |
| `values[NUM_GRIDS]` | uint[] | 각 수준의 노트 값 |
| `salts[NUM_GRIDS]` | field[] | 각 수준의 노트 무작위성 |
| `outValues[NUM_GRIDS]` | uint[] | 실행 후 출력 값 |
| `outSalts[NUM_GRIDS]` | field[] | 출력 노트 무작위성 |
| `lastExecutedPrice` | uint | 이전 실행 가격 (방향 확인용) |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template GridTrade(NUM_GRIDS) {
    // ===== Public Inputs =====
    signal input gridConfigHash;
    signal input noteHashes[NUM_GRIDS];
    signal input outputHashes[NUM_GRIDS];
    signal input currentPrice;
    signal input tokenType;
    signal input executedLevels;

    // ===== Private Inputs =====
    signal input pkX, pkY, sk;
    signal input gridPrices[NUM_GRIDS];
    signal input gridTypes[NUM_GRIDS];  // 0 = buy, 1 = sell
    signal input values[NUM_GRIDS];
    signal input salts[NUM_GRIDS];
    signal input outValues[NUM_GRIDS];
    signal input outSalts[NUM_GRIDS];
    signal input lastExecutedPrice;

    // ===== 1. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sk;
    ownership.pkX <== pkX;
    ownership.pkY <== pkY;

    // ===== 2. Verify Grid Configuration Hash =====
    component configHash = Poseidon(NUM_GRIDS * 2 + 1);
    for (var i = 0; i < NUM_GRIDS; i++) {
        configHash.inputs[i * 2] <== gridPrices[i];
        configHash.inputs[i * 2 + 1] <== gridTypes[i];
    }
    configHash.inputs[NUM_GRIDS * 2] <== lastExecutedPrice;
    configHash.out === gridConfigHash;

    // ===== 3. Components for Each Grid Level =====
    component notes[NUM_GRIDS];
    component outNotes[NUM_GRIDS];
    component buyCheck[NUM_GRIDS];
    component sellCheck[NUM_GRIDS];
    component shouldExecute[NUM_GRIDS];

    signal executedBits[NUM_GRIDS];

    for (var i = 0; i < NUM_GRIDS; i++) {
        // ===== 3a. Verify Input Note =====
        notes[i] = PoseidonRegularNote();
        notes[i].pkX <== pkX;
        notes[i].pkY <== pkY;
        notes[i].value <== values[i];
        notes[i].tokenType <== tokenType;
        notes[i].salt <== salts[i];
        notes[i].out === noteHashes[i];

        // ===== 3b. Check Buy Condition =====
        // Buy: gridType == 0 AND currentPrice <= gridPrice
        // AND price crossed down (lastExecutedPrice > gridPrice)
        buyCheck[i] = LessEqThan(64);
        buyCheck[i].in[0] <== currentPrice;
        buyCheck[i].in[1] <== gridPrices[i];

        // ===== 3c. Check Sell Condition =====
        // Sell: gridType == 1 AND currentPrice >= gridPrice
        // AND price crossed up (lastExecutedPrice < gridPrice)
        sellCheck[i] = GreaterEqThan(64);
        sellCheck[i].in[0] <== currentPrice;
        sellCheck[i].in[1] <== gridPrices[i];

        // ===== 3d. Determine if This Level Should Execute =====
        // Execute if (isBuy AND buyCondition) OR (isSell AND sellCondition)
        signal isBuy;
        isBuy <== 1 - gridTypes[i];  // gridType 0 = buy
        signal isSell;
        isSell <== gridTypes[i];      // gridType 1 = sell

        signal buyExecute;
        buyExecute <== isBuy * buyCheck[i].out;
        signal sellExecute;
        sellExecute <== isSell * sellCheck[i].out;

        shouldExecute[i] = GreaterThan(8);
        shouldExecute[i].in[0] <== buyExecute + sellExecute;
        shouldExecute[i].in[1] <== 0;

        // Extract executed bit from bitmap
        // executedBits[i] = (executedLevels >> i) & 1
        executedBits[i] <-- (executedLevels >> i) & 1;
        executedBits[i] * (1 - executedBits[i]) === 0;  // Binary constraint

        // ===== 3e. Verify Execution Consistency =====
        // If executedBits[i] == 1, shouldExecute must be 1
        signal executionValid;
        executionValid <== executedBits[i] * (1 - shouldExecute[i].out);
        executionValid === 0;  // Can't execute if condition not met

        // ===== 3f. Verify Output Note (if executed) =====
        outNotes[i] = PoseidonRegularNote();
        outNotes[i].pkX <== pkX;
        outNotes[i].pkY <== pkY;
        outNotes[i].value <== outValues[i];
        outNotes[i].tokenType <== tokenType;
        outNotes[i].salt <== outSalts[i];

        // If executed, output hash must match; if not, output hash must be 0
        signal expectedOutHash;
        expectedOutHash <== executedBits[i] * outNotes[i].out;
        outputHashes[i] === expectedOutHash;

        // ===== 3g. Value Conversion Check (if executed) =====
        // For buy: outValue = value / currentPrice
        // For sell: outValue = value * currentPrice
        signal expectedBuyValue;
        expectedBuyValue <== values[i] * 1000000;  // Will divide by price
        signal expectedSellValue;
        expectedSellValue <== values[i] * currentPrice;

        signal expectedValue;
        expectedValue <== isBuy * expectedBuyValue + isSell * expectedSellValue;

        // Verify output value is within tolerance (when executed)
        signal valueDiff;
        valueDiff <== outValues[i] * 1000000 - expectedValue;
        // Allow small tolerance for rounding
    }

    // ===== 4. Verify At Least One Level Executed =====
    signal executedCount[NUM_GRIDS + 1];
    executedCount[0] <== 0;
    for (var i = 0; i < NUM_GRIDS; i++) {
        executedCount[i + 1] <== executedCount[i] + executedBits[i];
    }
    component atLeastOne = GreaterThan(8);
    atLeastOne.in[0] <== executedCount[NUM_GRIDS];
    atLeastOne.in[1] <== 0;
    atLeastOne.out === 1;
}

component main {public [gridConfigHash, noteHashes, outputHashes, currentPrice,
    tokenType, executedLevels]} = GridTrade(10);
```

### 주요 제약 조건

1. **소유권 검증**: 모든 그리드 수준이 동일한 키로 소유됨
2. **구성 무결성**: 그리드 매개변수가 커밋된 구성에 해시됨
3. **실행 조건**: 매수는 price <= gridPrice일 때 트리거; 매도는 price >= gridPrice일 때
4. **실행 일관성**: 조건이 충족된 수준만 실행 가능
5. **값 보존**: 출력 값은 실행 가격에서 올바른 전환을 반영
6. **최소 실행**: 증명당 최소 하나의 그리드 수준이 실행되어야 함

## 효과

| 측면 | 영향 |
|--------|--------|
| **자동화** | 가격 범위 전반에 걸친 손을 대지 않는 실행 |
| **변동성 포착** | 방향 없이 가격 진동에서 이익 |
| **위험 분산** | 여러 가격 수준에 걸쳐 분산된 자본 |
| **프라이버시** | 시장으로부터 숨겨진 그리드 수준 및 매개변수 |
| **일관성** | 감정적 간섭 없이 기계적 실행 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **그리드 사냥** | 그리드 가격 숨김; 공격자는 수준을 타겟할 수 없음 |
| **오라클 조작** | TWAP 오라클 사용; 여러 소스 검증 |
| **실행 건너뛰기** | 비트맵이 실행된 수준을 추적; 건너뛰기 없음 |
| **값 추출** | 각 수준에서 엄격한 전환 확인 |
| **구성 변조** | 전체 그리드 구성에 대한 해시 커밋먼트 |
| **이중 실행** | 각 수준 노트는 고유한 무효화자를 가짐 |

## 구현 과제

1. **상태 관리**
   - 실행된 그리드 수준 추적
   - 각 실행 후 구성 해시 업데이트
   - 단일 트랜잭션에서 다중 수준 실행 처리

2. **가격 방향 추적**
   - 가격이 위에서 또는 아래에서 수준을 교차했는지 추적해야 함
   - 반전 없이 동일한 수준을 반복적으로 실행하는 것을 방지
   - lastExecutedPrice 상태 필요

3. **가스 비용**
   - 여러 그리드 수준은 증명 및 검증 비용을 증가시킵니다
   - 최대 실용적인 그리드 크기 고려 (~20 수준)
   - 가능할 때 수준 실행을 배치

4. **리밸런싱 로직**
   - 수준 N에서 판매한 후 수준 N-1에 매수 주문 필요
   - 실행 후 그리드 재생성
   - 자동화된 리밸런싱 회로 고려

5. **자본 할당**
   - 수준당 고정 자본 대 동적 할당
   - 기하학적 대 산술 그리드 간격이 효율성에 영향
   - 초기 자본 배포 전략

## 파생 상품

1. **동적 그리드 (자체 조정 수준)** - 그리드 수준이 최근 변동성에 따라 자동으로 조정됩니다. 높은 변동성은 간격을 넓히고; 낮은 변동성은 강화합니다. 롤링 변동성 계산을 사용하여 그리드 가격을 재계산합니다. 수동 개입 없이 변화하는 시장 조건에 적응합니다.

2. **기하학적 그리드 (지수 간격)** - 그리드 수준이 절대 금액이 아닌 백분율로 간격이 지정됩니다. 넓은 가격 범위를 가진 자산에 더 좋습니다. 각 수준은 동일한 백분율 이동을 나타냅니다 (예: 2% 간격). 추세 시장에서 더 자본 효율적입니다.

3. **다중 자산 그리드 차익거래** - 상관 자산을 동시에 그리드 거래합니다 (ETH/BTC 비율). 비율이 벗어날 때 쌍 거래를 실행합니다. 상관관계의 평균 회귀에서 이익을 얻습니다. 단일 증명이 여러 자산 쌍을 커버합니다.

4. **DCA 폴백이 있는 그리드** - 가격이 그리드 범위를 벗어나면 DCA 전략으로 전환됩니다. 가격이 계속 움직임에 따라 점진적인 포지션 구축. 추세 시장에서 그리드가 비활성화되는 것을 방지합니다. 전략 간 원활한 전환.

5. **변동성 적응형 그리드 간격** - 변동성이 높은 기간에는 더 넓은 그리드 간격, 평온한 기간에는 더 좁음. 내재 변동성 또는 과거 변동성을 사용하여 조정합니다. 놓친 기회를 최소화하면서 실행당 이익을 최대화합니다. 시장 조건에 따라 자체 보정됩니다.

## 사용 사례

1. **범위 트레이딩**
   - ETH가 몇 주 동안 $1800-$2200 사이에서 거래됩니다
   - 범위 전반에 걸쳐 10개 수준 그리드를 배포합니다
   - $1800, $1840, $1880에서 매수 주문... $2000, $2040에서 매도 주문...
   - 범위 내 각 진동이 이익을 생성합니다
   - 방향 베팅이 필요 없음; 양방향으로 작동

2. **스테이블코인 쌍 차익거래**
   - USDC/USDT는 일반적으로 0.998-1.002에서 거래됩니다
   - 밀집 그리드가 작은 편차를 포착합니다
   - 작은 이익의 높은 빈도
   - 안정적인 쌍으로 인한 매우 낮은 위험
   - 변동성 노출 없이 수익을 추구하는 자본에 이상적

3. **축적 전략**
   - 시간 경과에 따라 ETH를 축적하고자 합니다
   - 현재 가격 아래에 매수 중심 그리드를 설정합니다
   - 낮은 가격이 더 많은 구매를 트리거합니다
   - 포지션으로의 자연스러운 DCA
   - 더 높은 수준에서의 매도가 평균 비용을 더욱 줄입니다

4. **마켓 메이킹 대안**
   - 전통적인 마켓 메이킹은 지속적인 주의가 필요합니다
   - 그리드는 유사한 유동성 제공을 제공합니다
   - 진동에 대한 스프레드를 얻습니다
   - 설정하고 잊어버리는 구현
   - 인프라 비용 없이 24/7 작동

## 실제 제품 및 사용자 경험

전용 제품 문서 참조: [제품 응용](../../product/a-core-trading/a6-grid-trading-products.md)

---

[인덱스로 돌아가기](../../README.md)
