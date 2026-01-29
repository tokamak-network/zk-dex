# E10. Leverage Position

Open and manage leveraged trading positions with hidden leverage ratios, sizes, and liquidation levels.

**Constraints**: ~300K | **Complexity**: High

---

## Background

Leveraged positions are prime targets for exploitation:

- **Liquidation Hunting**: Visible liquidation levels enable targeted price manipulation
- **Position Size Exposure**: Known leverage reveals risk tolerance and potential impact
- **Margin Call Visibility**: Public margin requirements expose vulnerability windows
- **Cascade Risk**: Visible leverage distribution enables coordinated attacks

Current lending protocols like Aave and Compound expose all leverage parameters. Private leverage hides position details while proving compliance with margin requirements through ZK proofs.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `positionNoteHash` | field | Hash of the leveraged position note |
| `collateralNoteHash` | field | Hash of collateral deposit note |
| `borrowNoteHash` | field | Hash of borrowed asset note |
| `marketId` | uint | Identifier for the leverage market |
| `oraclePrice` | uint | Current asset price from oracle |
| `maxLeverage` | uint | Maximum allowed leverage for market |
| `nullifier` | field | Prevents position double-spend |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `traderPkX, traderPkY` | field | Trader's public key |
| `traderSk` | field | Trader's secret key |
| `collateralAmount` | uint | Collateral deposited (hidden) |
| `borrowAmount` | uint | Amount borrowed (hidden) |
| `leverage` | uint | Effective leverage ratio (hidden) |
| `liquidationPrice` | uint | Price triggering liquidation (hidden) |
| `positionSalt` | field | Position note randomness |
| `collateralSalt` | field | Collateral note randomness |
| `borrowSalt` | field | Borrow note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template LeverageOpen() {
    // ===== Public Inputs =====
    signal input positionNoteHash;
    signal input collateralNoteHash;
    signal input borrowNoteHash;
    signal input marketId;
    signal input oraclePrice;
    signal input maxLeverage;           // e.g., 10 for 10x max
    signal input maintenanceMargin;     // e.g., 5 for 5%
    signal input nullifier;

    // ===== Private Inputs =====
    signal input traderPkX, traderPkY, traderSk;
    signal input collateralAmount;
    signal input collateralTokenType;
    signal input borrowAmount;
    signal input borrowTokenType;
    signal input leverage;
    signal input liquidationPrice;
    signal input positionSalt, collateralSalt, borrowSalt;

    // ===== 1. Verify Trader Ownership =====
    component traderOwnership = ProofOfOwnershipStrict();
    traderOwnership.sk <== traderSk;
    traderOwnership.pkX <== traderPkX;
    traderOwnership.pkY <== traderPkY;

    // ===== 2. Verify Leverage Within Limit =====
    component leverageCheck = LessEqThan(16);
    leverageCheck.in[0] <== leverage;
    leverageCheck.in[1] <== maxLeverage;
    leverageCheck.out === 1;

    // Minimum leverage is 1
    component minLeverageCheck = GreaterEqThan(16);
    minLeverageCheck.in[0] <== leverage;
    minLeverageCheck.in[1] <== 1;
    minLeverageCheck.out === 1;

    // ===== 3. Verify Collateral Covers Margin =====
    // Required margin = borrowAmount * oraclePrice / leverage
    signal positionValue;
    positionValue <== borrowAmount * oraclePrice;

    signal requiredMargin;
    requiredMargin <== positionValue / leverage;

    component marginCheck = GreaterEqThan(128);
    marginCheck.in[0] <== collateralAmount;
    marginCheck.in[1] <== requiredMargin;
    marginCheck.out === 1;

    // ===== 4. Verify Leverage Calculation =====
    // leverage = positionValue / collateralAmount
    signal calculatedLeverage;
    calculatedLeverage <== positionValue / collateralAmount;

    // Allow small tolerance for rounding
    signal leverageDiff;
    component leverageGt = GreaterThan(16);
    leverageGt.in[0] <== leverage;
    leverageGt.in[1] <== calculatedLeverage;

    signal diffIfGt;
    signal diffIfLt;
    diffIfGt <== leverage - calculatedLeverage;
    diffIfLt <== calculatedLeverage - leverage;
    leverageDiff <== leverageGt.out * diffIfGt + (1 - leverageGt.out) * diffIfLt;

    component leverageToleranceCheck = LessEqThan(16);
    leverageToleranceCheck.in[0] <== leverageDiff;
    leverageToleranceCheck.in[1] <== 1;  // Allow 1x tolerance for rounding
    leverageToleranceCheck.out === 1;

    // ===== 5. Verify Liquidation Price =====
    // For long: liquidationPrice = entryPrice * (1 - 1/leverage + maintenanceMargin/100)
    // Simplified: liquidationPrice should be below entry by appropriate margin
    signal maintenanceBuffer;
    maintenanceBuffer <== oraclePrice * maintenanceMargin / 100;

    signal leverageBuffer;
    leverageBuffer <== oraclePrice / leverage;

    signal expectedLiquidationPrice;
    expectedLiquidationPrice <== oraclePrice - leverageBuffer + maintenanceBuffer;

    // Allow 5% tolerance on liquidation price
    signal liqTolerance;
    liqTolerance <== expectedLiquidationPrice / 20;

    signal liqDiff;
    component liqGt = GreaterThan(64);
    liqGt.in[0] <== liquidationPrice;
    liqGt.in[1] <== expectedLiquidationPrice;

    signal liqDiffIfGt;
    signal liqDiffIfLt;
    liqDiffIfGt <== liquidationPrice - expectedLiquidationPrice;
    liqDiffIfLt <== expectedLiquidationPrice - liquidationPrice;
    liqDiff <== liqGt.out * liqDiffIfGt + (1 - liqGt.out) * liqDiffIfLt;

    component liqCheck = LessEqThan(64);
    liqCheck.in[0] <== liqDiff;
    liqCheck.in[1] <== liqTolerance;
    liqCheck.out === 1;

    // ===== 6. Verify Collateral Note =====
    component collateralNote = PoseidonRegularNote();
    collateralNote.pkX <== traderPkX;
    collateralNote.pkY <== traderPkY;
    collateralNote.value <== collateralAmount;
    collateralNote.tokenType <== collateralTokenType;
    collateralNote.salt <== collateralSalt;
    collateralNote.out === collateralNoteHash;

    // ===== 7. Verify Borrow Note =====
    component borrowNote = PoseidonRegularNote();
    borrowNote.pkX <== traderPkX;
    borrowNote.pkY <== traderPkY;
    borrowNote.value <== borrowAmount;
    borrowNote.tokenType <== borrowTokenType;
    borrowNote.salt <== borrowSalt;
    borrowNote.out === borrowNoteHash;

    // ===== 8. Verify Position Note =====
    component positionNote = Poseidon(8);
    positionNote.inputs[0] <== traderPkX;
    positionNote.inputs[1] <== traderPkY;
    positionNote.inputs[2] <== collateralAmount;
    positionNote.inputs[3] <== borrowAmount;
    positionNote.inputs[4] <== leverage;
    positionNote.inputs[5] <== liquidationPrice;
    positionNote.inputs[6] <== marketId;
    positionNote.inputs[7] <== positionSalt;
    positionNote.out === positionNoteHash;

    // ===== 9. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== collateralNoteHash;
    nullifierHash.inputs[1] <== traderSk;
    nullifierHash.out === nullifier;
}

template LeverageClose() {
    // ===== Public Inputs =====
    signal input positionNoteHash;
    signal input settlementNoteHash;
    signal input marketId;
    signal input currentPrice;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input traderPkX, traderPkY, traderSk;
    signal input collateralAmount;
    signal input borrowAmount;
    signal input leverage;
    signal input liquidationPrice;
    signal input positionSalt;
    signal input entryPrice;
    signal input settlementAmount;
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
    positionNote.inputs[2] <== collateralAmount;
    positionNote.inputs[3] <== borrowAmount;
    positionNote.inputs[4] <== leverage;
    positionNote.inputs[5] <== liquidationPrice;
    positionNote.inputs[6] <== marketId;
    positionNote.inputs[7] <== positionSalt;
    positionNote.out === positionNoteHash;

    // ===== 3. Verify Position Not Liquidated =====
    // Current price should be above liquidation price
    component notLiquidated = GreaterThan(64);
    notLiquidated.in[0] <== currentPrice;
    notLiquidated.in[1] <== liquidationPrice;
    notLiquidated.out === 1;

    // ===== 4. Calculate PnL =====
    // PnL = (currentPrice - entryPrice) * borrowAmount / entryPrice
    signal priceDiff;
    signal pnl;

    component priceGt = GreaterThan(64);
    priceGt.in[0] <== currentPrice;
    priceGt.in[1] <== entryPrice;

    signal positivePnl;
    signal negativePnl;
    positivePnl <== (currentPrice - entryPrice) * borrowAmount / entryPrice;
    negativePnl <== (entryPrice - currentPrice) * borrowAmount / entryPrice;

    pnl <== priceGt.out * positivePnl - (1 - priceGt.out) * negativePnl;

    // ===== 5. Calculate Settlement =====
    // Settlement = collateral + PnL - borrowAmount (repaid)
    signal expectedSettlement;
    expectedSettlement <== collateralAmount + pnl;

    // Settlement should be non-negative
    component settlementPositive = GreaterEqThan(128);
    settlementPositive.in[0] <== settlementAmount;
    settlementPositive.in[1] <== 0;
    settlementPositive.out === 1;

    // ===== 6. Verify Settlement Note =====
    component settlementNote = PoseidonRegularNote();
    settlementNote.pkX <== traderPkX;
    settlementNote.pkY <== traderPkY;
    settlementNote.value <== settlementAmount;
    settlementNote.tokenType <== 1;  // Settlement in quote currency
    settlementNote.salt <== settlementSalt;
    settlementNote.out === settlementNoteHash;

    // ===== 7. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== positionNoteHash;
    nullifierHash.inputs[1] <== traderSk;
    nullifierHash.out === nullifier;
}

template LeverageLiquidate() {
    // ===== Public Inputs =====
    signal input positionNoteHash;
    signal input liquidatorRewardHash;
    signal input remainderNoteHash;
    signal input marketId;
    signal input currentPrice;
    signal input liquidationPenalty;

    // ===== Private Inputs =====
    signal input traderPkX, traderPkY;
    signal input liquidatorPkX, liquidatorPkY, liquidatorSk;
    signal input collateralAmount;
    signal input borrowAmount;
    signal input leverage;
    signal input liquidationPrice;
    signal input positionSalt;
    signal input rewardAmount;
    signal input remainderAmount;
    signal input rewardSalt, remainderSalt;

    // ===== 1. Verify Liquidator Ownership =====
    component liquidatorOwnership = ProofOfOwnershipStrict();
    liquidatorOwnership.sk <== liquidatorSk;
    liquidatorOwnership.pkX <== liquidatorPkX;
    liquidatorOwnership.pkY <== liquidatorPkY;

    // ===== 2. Verify Position Note =====
    component positionNote = Poseidon(8);
    positionNote.inputs[0] <== traderPkX;
    positionNote.inputs[1] <== traderPkY;
    positionNote.inputs[2] <== collateralAmount;
    positionNote.inputs[3] <== borrowAmount;
    positionNote.inputs[4] <== leverage;
    positionNote.inputs[5] <== liquidationPrice;
    positionNote.inputs[6] <== marketId;
    positionNote.inputs[7] <== positionSalt;
    positionNote.out === positionNoteHash;

    // ===== 3. Verify Position is Liquidatable =====
    component isLiquidatable = LessEqThan(64);
    isLiquidatable.in[0] <== currentPrice;
    isLiquidatable.in[1] <== liquidationPrice;
    isLiquidatable.out === 1;

    // ===== 4. Calculate Liquidation Reward =====
    signal penaltyAmount;
    penaltyAmount <== collateralAmount * liquidationPenalty / 100;

    component rewardCheck = LessEqThan(128);
    rewardCheck.in[0] <== rewardAmount;
    rewardCheck.in[1] <== penaltyAmount;
    rewardCheck.out === 1;

    // ===== 5. Verify Reward Note =====
    component rewardNote = PoseidonRegularNote();
    rewardNote.pkX <== liquidatorPkX;
    rewardNote.pkY <== liquidatorPkY;
    rewardNote.value <== rewardAmount;
    rewardNote.tokenType <== 1;
    rewardNote.salt <== rewardSalt;
    rewardNote.out === liquidatorRewardHash;

    // ===== 6. Verify Remainder Note (if any) =====
    // After repaying debt and liquidation penalty, remainder goes to trader
    signal expectedRemainder;
    expectedRemainder <== collateralAmount - borrowAmount - rewardAmount;

    component remainderNote = PoseidonRegularNote();
    remainderNote.pkX <== traderPkX;
    remainderNote.pkY <== traderPkY;
    remainderNote.value <== remainderAmount;
    remainderNote.tokenType <== 1;
    remainderNote.salt <== remainderSalt;
    remainderNote.out === remainderNoteHash;
}

component main {public [positionNoteHash, collateralNoteHash, borrowNoteHash,
    marketId, oraclePrice, maxLeverage, maintenanceMargin, nullifier]} = LeverageOpen();
```

### Key Constraints

1. **Ownership Verification**: Trader proves control via secret key
2. **Leverage Limit**: Position leverage within market maximum
3. **Margin Sufficiency**: Collateral covers required margin
4. **Liquidation Price**: Calculated correctly based on leverage
5. **Position Solvency**: Current price above liquidation for close
6. **Liquidation Validity**: Position underwater for liquidation

## Effects

| Aspect | Impact |
|--------|--------|
| **Position Privacy** | Leverage and size hidden from observers |
| **Liquidation Protection** | Liquidation price not visible to hunters |
| **Strategy Confidentiality** | Risk tolerance not exposed |
| **MEV Prevention** | Cannot target specific leverage levels |
| **Fair Liquidation** | Only underwater positions liquidatable |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Oracle Manipulation** | Use TWAP and multiple oracle sources |
| **Excessive Leverage** | Maximum leverage enforced in circuit |
| **Liquidation Evasion** | Protocol can prove position underwater |
| **Flash Loan Attacks** | TWAP prices prevent instant manipulation |
| **Margin Call Gaming** | Continuous margin monitoring off-chain |
| **Cascading Liquidations** | Hidden positions prevent targeted cascades |

## Implementation Challenges

1. **Interest Accrual**
   - Borrow interest calculation
   - Variable vs fixed rates
   - Interest compounding

2. **Margin Management**
   - Adding/removing margin
   - Cross-margin vs isolated
   - Margin transfer between positions

3. **Liquidation Engine**
   - Keeper incentives
   - Partial liquidations
   - Bad debt handling

4. **Price Feed Integration**
   - Oracle reliability
   - Price staleness checks
   - Multiple source aggregation

## Derivatives

1. **Cross-Collateral Leverage** - Use multiple assets as collateral with hidden weights. Proves combined collateralization while hiding individual asset allocations.

2. **Dynamic Leverage** - Adjust leverage ratio without closing position. Proves new leverage is within limits while hiding both old and new ratios.

3. **Leverage Limits** - Protocol enforces user-specific leverage limits. Proves compliance without revealing actual leverage used.

4. **Margin Call Privacy** - Receive margin calls without public notification. Proves margin requirement while hiding position details.

5. **Position Averaging** - Add to position at different prices with hidden average. Proves average entry while hiding individual trade details.

## Use Cases

1. **Leveraged Trading**
   - Trader takes leveraged long position
   - Leverage ratio and size hidden
   - Liquidation price not visible to attackers

2. **Institutional Leverage**
   - Fund uses leverage for capital efficiency
   - Position sizes hidden from competitors
   - Risk management maintained privately

3. **Yield Farming with Leverage**
   - User leverages yield farming position
   - Collateral and debt amounts private
   - Prevents targeted unwind attacks

4. **Arbitrage with Leverage**
   - Arbitrageur amplifies returns with leverage
   - Strategy and position size confidential
   - Competitors cannot copy trades

## Real-World Products & User Experience

See: [Leverage Position - Real-World Products](../../../product/e-defi/e10-leverage-products.md)
---

[Back to Index](../../README.md)
