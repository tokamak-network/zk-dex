# E3. 무기한 선물 포지션 개설/청산

숨겨진 레버리지, 규모 및 청산 수준으로 무기한 선물 포지션을 개설하고 청산하여 경쟁력 있는 파생상품 거래를 가능하게 합니다.

**제약 조건**: ~350K | **복잡도**: 높음

---

## 배경

무기한 선물은 암호화폐에서 가장 많이 거래되는 파생상품으로, 포지션 프라이버시가 필요합니다:

- **청산 헌팅**: 가시적인 청산 가격은 포지션을 연쇄적으로 청산시키는 표적 공격을 허용합니다
- **포지션 규모 노출**: 대형 포지션은 역거래와 조작을 유도합니다
- **레버리지 감지**: 알려진 레버리지는 정확한 청산 계산을 가능하게 합니다
- **전략 유출**: 포지션 방향은 트레이더의 확신과 전략을 드러냅니다

Binance 및 dYdX와 같은 중앙화 거래소는 무기한 선물을 제공하지만 운영자에게 포지션 데이터를 노출합니다. 프라이빗 무기한 선물은 ZK 증명을 통해 레버리지 한도 및 마진 요구사항 준수를 증명하면서 포지션 매개변수를 숨깁니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `positionNoteHash` | field | 무기한 포지션 노트의 해시 |
| `marginNoteHash` | field | 마진 담보 노트의 해시 |
| `marketId` | uint | 무기한 시장 식별자 |
| `direction` | uint | 롱 (0) 또는 숏 (1) |
| `currentPrice` | uint | 오라클의 현재 마크 가격 |
| `fundingTimestamp` | uint | 마지막 펀딩 지급 타임스탬프 |
| `nullifier` | field | 포지션 이중 지출 방지 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `traderPkX, traderPkY` | field | 트레이더의 공개키 |
| `traderSk` | field | 트레이더의 비밀키 |
| `positionSize` | uint | 포지션 크기 (숨김) |
| `entryPrice` | uint | 포지션 진입 가격 (숨김) |
| `leverage` | uint | 포지션 레버리지 (숨김) |
| `marginValue` | uint | 마진 담보 금액 |
| `liquidationPrice` | uint | 포지션이 청산되는 가격 |
| `positionSalt` | field | 포지션 노트 무작위성 |
| `marginSalt` | field | 마진 노트 무작위성 |
| `accumulatedFunding` | int | 누적 펀딩 지급 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template PerpetualOpen() {
    // ===== Public Inputs =====
    signal input positionNoteHash;
    signal input marginNoteHash;
    signal input marketId;
    signal input direction;         // 0 = Long, 1 = Short
    signal input currentPrice;
    signal input maxLeverage;       // Market-specific max leverage
    signal input nullifier;

    // ===== Private Inputs =====
    signal input traderPkX, traderPkY, traderSk;
    signal input positionSize;
    signal input entryPrice;
    signal input leverage;
    signal input marginValue;
    signal input liquidationPrice;
    signal input positionSalt, marginSalt;

    // ===== 1. Verify Trader Ownership =====
    component traderOwnership = ProofOfOwnershipStrict();
    traderOwnership.sk <== traderSk;
    traderOwnership.pkX <== traderPkX;
    traderOwnership.pkY <== traderPkY;

    // ===== 2. Verify Leverage Limit =====
    component leverageCheck = LessEqThan(16);
    leverageCheck.in[0] <== leverage;
    leverageCheck.in[1] <== maxLeverage;
    leverageCheck.out === 1;

    // Ensure leverage is at least 1
    component minLeverage = GreaterEqThan(16);
    minLeverage.in[0] <== leverage;
    minLeverage.in[1] <== 1;
    minLeverage.out === 1;

    // ===== 3. Verify Margin Sufficiency =====
    // Required margin = positionSize * entryPrice / leverage
    signal notionalValue;
    notionalValue <== positionSize * entryPrice;

    signal requiredMargin;
    requiredMargin <== notionalValue / leverage;

    component marginCheck = GreaterEqThan(128);
    marginCheck.in[0] <== marginValue;
    marginCheck.in[1] <== requiredMargin;
    marginCheck.out === 1;

    // ===== 4. Verify Entry Price Near Current =====
    // Entry price must be within 1% of current price (slippage protection)
    signal priceDiff;
    signal absPriceDiff;

    component priceGt = GreaterThan(64);
    priceGt.in[0] <== entryPrice;
    priceGt.in[1] <== currentPrice;

    // Calculate absolute difference
    signal diffIfGreater;
    signal diffIfLess;
    diffIfGreater <== entryPrice - currentPrice;
    diffIfLess <== currentPrice - entryPrice;
    absPriceDiff <== priceGt.out * diffIfGreater + (1 - priceGt.out) * diffIfLess;

    // Max slippage: 1% of current price
    signal maxSlippage;
    maxSlippage <== currentPrice / 100;

    component slippageCheck = LessEqThan(64);
    slippageCheck.in[0] <== absPriceDiff;
    slippageCheck.in[1] <== maxSlippage;
    slippageCheck.out === 1;

    // ===== 5. Verify Liquidation Price =====
    // Long: liquidationPrice = entryPrice * (1 - 1/leverage + maintenanceMargin)
    // Short: liquidationPrice = entryPrice * (1 + 1/leverage - maintenanceMargin)
    // Simplified: check liquidation is correct distance from entry
    signal liquidationDistance;
    liquidationDistance <== entryPrice / leverage;

    // For longs: entryPrice - liquidationPrice ~= liquidationDistance
    // For shorts: liquidationPrice - entryPrice ~= liquidationDistance
    signal expectedLiqLong;
    signal expectedLiqShort;
    expectedLiqLong <== entryPrice - liquidationDistance;
    expectedLiqShort <== entryPrice + liquidationDistance;

    signal expectedLiq;
    expectedLiq <== (1 - direction) * expectedLiqLong + direction * expectedLiqShort;

    // Allow 5% tolerance for maintenance margin
    signal liqTolerance;
    liqTolerance <== expectedLiq / 20;

    signal liqDiff;
    component liqGt = GreaterThan(64);
    liqGt.in[0] <== liquidationPrice;
    liqGt.in[1] <== expectedLiq;

    signal liqDiffIfGreater;
    signal liqDiffIfLess;
    liqDiffIfGreater <== liquidationPrice - expectedLiq;
    liqDiffIfLess <== expectedLiq - liquidationPrice;
    liqDiff <== liqGt.out * liqDiffIfGreater + (1 - liqGt.out) * liqDiffIfLess;

    component liqCheck = LessEqThan(64);
    liqCheck.in[0] <== liqDiff;
    liqCheck.in[1] <== liqTolerance;
    liqCheck.out === 1;

    // ===== 6. Verify Position Note =====
    component positionNote = Poseidon(8);
    positionNote.inputs[0] <== traderPkX;
    positionNote.inputs[1] <== traderPkY;
    positionNote.inputs[2] <== marketId;
    positionNote.inputs[3] <== direction;
    positionNote.inputs[4] <== positionSize;
    positionNote.inputs[5] <== entryPrice;
    positionNote.inputs[6] <== leverage;
    positionNote.inputs[7] <== positionSalt;
    positionNote.out === positionNoteHash;

    // ===== 7. Verify Margin Note =====
    component marginNote = PoseidonRegularNote();
    marginNote.pkX <== traderPkX;
    marginNote.pkY <== traderPkY;
    marginNote.value <== marginValue;
    marginNote.tokenType <== 1;  // Margin in quote currency (USDC)
    marginNote.salt <== marginSalt;
    marginNote.out === marginNoteHash;

    // ===== 8. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== marginNoteHash;
    nullifierHash.inputs[1] <== traderSk;
    nullifierHash.out === nullifier;
}

template PerpetualClose() {
    // ===== Public Inputs =====
    signal input positionNoteHash;
    signal input settlementNoteHash;
    signal input marketId;
    signal input currentPrice;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input traderPkX, traderPkY, traderSk;
    signal input direction;
    signal input positionSize;
    signal input entryPrice;
    signal input leverage;
    signal input positionSalt;
    signal input marginValue;
    signal input pnl;
    signal input settlementValue;
    signal input settlementSalt;

    // ===== 1. Verify Trader Ownership =====
    component traderOwnership = ProofOfOwnershipStrict();
    traderOwnership.sk <== traderSk;
    traderOwnership.pkX <== traderPkX;
    traderOwnership.pkY <== traderPkY;

    // ===== 2. Verify Position Note =====
    component positionNote = Poseidon(8);
    positionNote.inputs[0] <== traderPkX;
    positionNote.inputs[1] <== traderPkY;
    positionNote.inputs[2] <== marketId;
    positionNote.inputs[3] <== direction;
    positionNote.inputs[4] <== positionSize;
    positionNote.inputs[5] <== entryPrice;
    positionNote.inputs[6] <== leverage;
    positionNote.inputs[7] <== positionSalt;
    positionNote.out === positionNoteHash;

    // ===== 3. Calculate PnL =====
    // Long PnL: (currentPrice - entryPrice) * positionSize
    // Short PnL: (entryPrice - currentPrice) * positionSize
    signal longPnl;
    signal shortPnl;
    longPnl <== (currentPrice - entryPrice) * positionSize;
    shortPnl <== (entryPrice - currentPrice) * positionSize;

    signal expectedPnl;
    expectedPnl <== (1 - direction) * longPnl + direction * shortPnl;

    // Verify claimed PnL matches calculation
    pnl === expectedPnl;

    // ===== 4. Calculate Settlement =====
    // Settlement = margin + PnL (capped at 0 for negative PnL > margin)
    signal rawSettlement;
    rawSettlement <== marginValue + pnl;

    // Ensure settlement is non-negative
    component settlementPositive = GreaterEqThan(128);
    settlementPositive.in[0] <== settlementValue;
    settlementPositive.in[1] <== 0;
    settlementPositive.out === 1;

    // ===== 5. Verify Settlement Note =====
    component settlementNote = PoseidonRegularNote();
    settlementNote.pkX <== traderPkX;
    settlementNote.pkY <== traderPkY;
    settlementNote.value <== settlementValue;
    settlementNote.tokenType <== 1;
    settlementNote.salt <== settlementSalt;
    settlementNote.out === settlementNoteHash;

    // ===== 6. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== positionNoteHash;
    nullifierHash.inputs[1] <== traderSk;
    nullifierHash.out === nullifier;
}

component main {public [positionNoteHash, marginNoteHash, marketId,
    direction, currentPrice, maxLeverage, nullifier]} = PerpetualOpen();
```

### 주요 제약 조건

1. **소유권 검증**: 트레이더가 비밀키를 통해 제어를 증명
2. **레버리지 한도**: 포지션 레버리지가 시장 정의 최대값 이내
3. **마진 충분성**: 초기 마진이 포지션 명목가치 / 레버리지를 커버
4. **진입 가격 검증**: 진입 가격이 마크 가격의 슬리피지 허용 범위 내
5. **청산 가격 정확성**: 청산 수준이 레버리지 및 방향과 일치
6. **PnL 계산**: 정산이 올바른 손익 계산을 반영

## 효과

| 측면 | 영향 |
|--------|--------|
| **포지션 프라이버시** | 크기와 레버리지가 관찰자로부터 숨겨짐 |
| **청산 보호** | 청산 가격이 헌터에게 보이지 않음 |
| **전략 기밀성** | 거래 방향은 알려지지만 크기는 숨겨짐 |
| **MEV 방지** | 청산을 위해 포지션을 정확하게 표적화할 수 없음 |
| **공정한 정산** | 증명 가능한 올바른 PnL 계산 |

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **오라클 조작** | 펀딩 비율 TWAP 사용; 다중 오라클 소스 |
| **청산 회피** | 프로토콜이 마크 가격을 사용하여 포지션 수중 증명 가능 |
| **레버리지 남용** | 회로에 하드코딩된 최대 레버리지 |
| **펀딩 비율 게이밍** | 즉각적이 아닌 시간 창에 걸쳐 계산된 펀딩 |
| **보험 기금 고갈** | 보험 소진 시 손실 사회화 |
| **플래시 크래시 청산** | 프로토콜 수준의 가격 밴드 및 서킷 브레이커 |

## 구현 과제

1. **펀딩 비율 메커니즘**
   - 롱과 숏 사이의 지속적인 펀딩
   - 프라이빗 포지션은 총 OI 계산을 복잡하게 만듦
   - 총 OI에 대한 커밋먼트 스키마 고려

2. **청산 엔진**
   - 세부 정보를 드러내지 않고 포지션이 청산 가능함을 증명해야 함
   - 프라이빗 청산을 위한 키퍼 인센티브 구조
   - 부분 청산 지원

3. **마크 가격 계산**
   - 여러 거래소의 인덱스 가격
   - 주문장 깊이의 임팩트 가격
   - 조작 저항을 위한 TWAP 스무딩

4. **크로스 마진 vs 격리**
   - 격리 마진이 더 간단함 (위에 표시)
   - 크로스 마진은 포트폴리오 수준 증명 필요
   - 상당한 추가 복잡성

## 파생 상품

1. **프라이빗 펀딩 비율** - 총 흐름의 균형을 증명하면서 개별 펀딩 지급을 숨김. 개별 금액을 드러내지 않고 포지션 전체에 펀딩을 합산하기 위해 동형 커밋먼트 사용.

2. **크로스 마진 포지션** - 여러 포지션이 숨겨진 할당으로 마진 풀을 공유. 단일 증명이 개별 포지션 세부 정보를 숨기면서 총 마진이 결합된 포지션 위험을 커버함을 검증.

3. **무기한 스프레드** - 스프레드를 포착하기 위해 한 무기한선물은 롱, 다른 하나는 숏으로 동시에 거래. 단일 증명이 균형 잡힌 노출을 증명하면서 숨겨진 크기로 두 포지션을 관리.

4. **자동 디레버리지 시스템** - 상대방이 손실을 커버할 수 없을 때 수익성 있는 포지션이 자동 디레버리지됨. 포지션 세부 정보를 드러내지 않고 디레버리지할 포지션의 공정한 선택을 증명.

5. **보험 기금 통합** - 보험 기금에 비공개로 기여하고 청구. 손실을 야기한 포지션을 드러내지 않고 보험 지급 자격을 증명.

## 사용 사례

1. **고빈도 거래**
   - HFT 회사가 숨겨진 포지션 크기로 무기한선물 거래
   - 경쟁사가 전략을 선행 거래하거나 복사할 수 없음
   - 청산 수준이 조작으로부터 보호됨

2. **현물 보유 헤징**
   - 투자자가 숏 무기한선물로 대형 현물 포지션 헤징
   - 헤지 크기가 정보 유출을 방지하기 위해 숨겨짐
   - 전략적 유연성 유지

3. **베이시스 트레이딩**
   - 트레이더가 펀딩 비율 차이 포착
   - 포지션 크기가 다른 베이시스 트레이더로부터 숨겨짐
   - 전략이 더 오래 수익성 유지

4. **레버리지 투기**
   - 리테일 트레이더가 레버리지 방향성 베팅
   - 정확한 레버리지와 크기 비공개
   - 표적 청산 위험 감소

## 실제 제품 및 사용자 경험

참조: [무기한 포지션 개설/청산 - 실제 제품](../../../product/e-defi/e3-perpetuals-products.md)
---

[색인으로 돌아가기](../../README.md)
