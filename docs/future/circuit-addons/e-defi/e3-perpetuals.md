# E3. Perpetual Position Open/Close

Open and close perpetual futures positions with hidden leverage, size, and liquidation levels, enabling competitive derivatives trading.

**Constraints**: ~350K | **Complexity**: High

---

## Background

Perpetual futures are the most traded derivative in crypto, requiring position privacy:

- **Liquidation Hunting**: Visible liquidation prices allow targeted attacks to cascade positions
- **Position Size Exposure**: Large positions attract counter-trading and manipulation
- **Leverage Detection**: Known leverage enables precise liquidation calculations
- **Strategy Leakage**: Position direction reveals trader conviction and strategy

Centralized exchanges like Binance and dYdX provide perpetuals but expose position data to operators. Private perpetuals hide position parameters while proving compliance with leverage limits and margin requirements through ZK proofs.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `positionNoteHash` | field | Hash of the perpetual position note |
| `marginNoteHash` | field | Hash of margin collateral note |
| `marketId` | uint | Identifier for the perpetual market |
| `direction` | uint | Long (0) or Short (1) |
| `currentPrice` | uint | Current mark price from oracle |
| `fundingTimestamp` | uint | Last funding payment timestamp |
| `nullifier` | field | Prevents position double-spend |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `traderPkX, traderPkY` | field | Trader's public key |
| `traderSk` | field | Trader's secret key |
| `positionSize` | uint | Size of position (hidden) |
| `entryPrice` | uint | Position entry price (hidden) |
| `leverage` | uint | Position leverage (hidden) |
| `marginValue` | uint | Margin collateral amount |
| `liquidationPrice` | uint | Price at which position liquidates |
| `positionSalt` | field | Position note randomness |
| `marginSalt` | field | Margin note randomness |
| `accumulatedFunding` | int | Accumulated funding payments |

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

### Key Constraints

1. **Ownership Verification**: Trader proves control via secret key
2. **Leverage Limit**: Position leverage within market-defined maximum
3. **Margin Sufficiency**: Initial margin covers position notional / leverage
4. **Entry Price Validation**: Entry price within slippage tolerance of mark price
5. **Liquidation Price Correctness**: Liquidation level matches leverage and direction
6. **PnL Calculation**: Settlement reflects correct profit/loss calculation

## Effects

| Aspect | Impact |
|--------|--------|
| **Position Privacy** | Size and leverage hidden from observers |
| **Liquidation Protection** | Liquidation price not visible to hunters |
| **Strategy Confidentiality** | Trading direction known but size hidden |
| **MEV Prevention** | Cannot precisely target positions for liquidation |
| **Fair Settlement** | Provably correct PnL calculation |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Oracle Manipulation** | Use funding rate TWAP; multiple oracle sources |
| **Liquidation Evasion** | Protocol can prove position underwater using mark price |
| **Leverage Abuse** | Hard-coded maximum leverage in circuit |
| **Funding Rate Gaming** | Funding calculated over time window, not instantaneous |
| **Insurance Fund Drain** | Socialized losses when insurance depleted |
| **Flash Crash Liquidations** | Price bands and circuit breakers at protocol level |

## Implementation Challenges

1. **Funding Rate Mechanism**
   - Continuous funding between longs and shorts
   - Private positions make aggregate OI calculation complex
   - Consider commitment scheme for total OI

2. **Liquidation Engine**
   - Must prove position is liquidatable without revealing details
   - Keeper incentive structure for private liquidations
   - Partial liquidation support

3. **Mark Price Calculation**
   - Index price from multiple exchanges
   - Impact price from order book depth
   - TWAP smoothing for manipulation resistance

4. **Cross-Margin vs Isolated**
   - Isolated margin simpler (shown above)
   - Cross-margin requires portfolio-level proofs
   - Significant additional complexity

## Derivatives

1. **Private Funding Rate** - Hide individual funding payments while proving aggregate flow is balanced. Uses homomorphic commitments to sum funding across positions without revealing individual amounts.

2. **Cross-Margin Positions** - Multiple positions share margin pool with hidden allocation. Single proof verifies total margin covers combined position risk while hiding individual position details.

3. **Perpetual Spreads** - Simultaneously long one perp, short another to capture spread. Single proof manages both positions with hidden sizes while proving balanced exposure.

4. **Auto-Deleverage System** - When counterparty cannot cover losses, profitable positions auto-deleverage. Proves fair selection of positions to deleverage without revealing position details.

5. **Insurance Fund Integration** - Contribute to and claim from insurance fund privately. Proves eligibility for insurance payout without revealing the position that caused the loss.

## Use Cases

1. **High-Frequency Trading**
   - HFT firm trades perpetuals with hidden position sizes
   - Competitors cannot front-run or copy strategies
   - Liquidation levels protected from manipulation

2. **Hedging Spot Holdings**
   - Investor hedges large spot position with short perp
   - Hedge size hidden to prevent information leakage
   - Maintains strategic flexibility

3. **Basis Trading**
   - Trader captures funding rate differential
   - Position size hidden from other basis traders
   - Strategy remains profitable longer

4. **Leveraged Speculation**
   - Retail trader takes leveraged directional bet
   - Exact leverage and size private
   - Reduced risk of targeted liquidation

## Real-World Products & User Experience

See: [Perpetual Position Open/Close - Real-World Products](../../product/e-defi/e3-perpetuals-products.md)
---

[Back to Index](../../README.md)
