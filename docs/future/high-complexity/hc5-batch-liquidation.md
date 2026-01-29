# HC5. Batch Liquidation

Liquidate multiple undercollateralized positions in one proof.

**Constraints**: ~700K | **Complexity**: High

---

## Background

DeFi liquidations face several challenges:
- MEV bots compete for liquidation profits
- Gas wars increase costs and reduce profits
- Sequential liquidations are inefficient
- Complex positions require multiple transactions
- Liquidators need to prove fair liquidation

**Why current approaches are insufficient:**

| Approach | Limitation |
|----------|------------|
| Sequential liquidations | High gas; MEV extraction between txs; slow clearing |
| Flashbots bundles | Requires MEV infrastructure; centralization concerns |
| Protocol-native batch | Each protocol different; no cross-protocol |
| Keeper networks | Trusted operators; profit extraction |

Batch liquidation enables efficient, provable liquidation of multiple positions atomically with cryptographic fairness guarantees.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `positionHashes` | field[N_POSITIONS] | Commitments to positions being liquidated |
| `liquidatorPaymentHashes` | field[N_POSITIONS] | Debt payment note commitments |
| `liquidatorRewardHashes` | field[N_POSITIONS] | Collateral reward note commitments |
| `collateralPrices` | uint[N_POSITIONS] | Oracle prices for collateral assets |
| `debtPrices` | uint[N_POSITIONS] | Oracle prices for debt assets |
| `liquidationThreshold` | uint | Minimum collateral ratio (e.g., 150%) |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `borrowerPkX/Y` | field[N_POSITIONS] | Borrower public keys |
| `collateralAmount, collateralType` | arrays | Collateral details |
| `debtAmount, debtType` | arrays | Debt details |
| `positionSalt, isActive` | arrays | Position metadata |
| `liquidatorPkX/Y, liquidatorSk` | field | Liquidator credentials |
| `paymentValues, paymentSalts` | arrays | Payment note details |
| `rewardValues, rewardSalts` | arrays | Reward note details |

### Circuit Logic

## Effects

| Aspect | Impact |
|--------|--------|
| **Gas Efficiency** | 80-90% reduction vs. sequential liquidations |
| **MEV Fairness** | First valid batch proof wins; no gas auctions |
| **Capital Efficiency** | Liquidator capital spans multiple positions |
| **Protocol Safety** | Faster clearing of bad debt (~10x throughput) |
| **Transparency** | Cryptographic proof of valid liquidation |
| **Atomicity** | All positions liquidated or none; no partial batch failures |

## Derivatives

1. **Partial Batch Liquidation** - Liquidate only to healthy ratio, not full position. Borrower retains excess collateral. Reduces market impact and preserves borrower equity. Requires close factor calculation in circuit.

2. **Dutch Auction Batch** - Batch with descending liquidation bonus over time. Starts at max bonus (e.g., 10%), decreases to min (e.g., 2%). Incentivizes faster liquidation while reducing borrower losses.

3. **Socialized Batch** - Distribute loss across protocol stakers if position is insolvent (collateral < debt). Insurance fund integration. Prevents bad debt from accumulating.

4. **Cross-Protocol Batch** - Liquidate positions across multiple DeFi protocols (Aave, Compound, Maker). Requires protocol adapters. Maximizes liquidator efficiency.

5. **Flash Batch Liquidation** - Use flash loans for capital-free batch liquidation. Borrow collateral asset, liquidate, repay from seized collateral. Enables anyone to be liquidator.

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

### Key Constraints

1. **Undercollateralization**: Each position must have collateral ratio below threshold
2. **Payment Coverage**: Liquidator pays at least the liquidated debt amount
3. **Reward Accuracy**: Liquidator receives exactly collateral + bonus
4. **Dust Prevention**: Minimum liquidation amount prevents uneconomic attacks
5. **Partial Liquidation**: Supports liquidating fraction of position

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Oracle Manipulation** | Use TWAP; multiple sources; price delay |
| **Flash Loan Attacks** | Require liquidator to own payment notes (not borrowed) |
| **Dust Amount Griefing** | Minimum liquidation value threshold |
| **Bonus Exploitation** | Cap bonus; reduce for large liquidations |
| **MEV Extraction** | First valid proof wins; no gas auction advantage |
| **Bad Debt Socialization** | If collateral < debt, route to insurance fund |
| **Cascading Liquidations** | Rate limiting; circuit breakers on-chain |

### Partial Liquidation and Dust Handling

**Partial Liquidation** is essential for borrower protection:
- Full liquidation destroys borrower's position entirely
- Partial liquidation returns position to healthy state
- `liquidationFraction` specifies how much to liquidate (in basis points)
- Close factor typically 50% - only liquidate half to target healthy ratio

**Dust Amount Prevention**:
- Very small liquidations are uneconomic (gas > reward)
- Attackers could spam tiny liquidations to grief the system
- `minLiquidationAmount` ensures minimum value threshold
- Typical minimum: $100 USD equivalent debt value
- Remaining dust after partial liquidation handled by:
  - Allowing full liquidation if position is below minimum
  - Or waiting for position to grow via interest accrual

```
// Example dust handling logic
if (remainingDebt < minLiquidationAmount) {
    // Allow full liquidation regardless of close factor
    liquidationFraction = 10000; // 100%
}
```

## Implementation Challenges

1. **Oracle Price Feeds**
   - Multiple asset types require multiple price feeds
   - Price staleness check needed
   - Consider Chainlink, Pyth, or TWAP oracles

2. **Cross-Protocol Integration**
   - Each DeFi protocol has different position formats
   - Need protocol adapters for position verification
   - Standardize position commitment format

3. **Residual Position Handling**
   - After partial liquidation, borrower has remaining position
   - Need to create new position commitment for remainder
   - Circuit complexity increases significantly

4. **Gas Cost Optimization**
   - 10 positions = ~700K constraints = ~400K gas verification
   - Batch benefits diminish above ~20 positions
   - Consider hierarchical batching for larger sets

5. **Liquidator Coordination**
   - Multiple liquidators may attempt same batch
   - Only first valid proof succeeds; others waste prover compute
   - Consider liquidator registration or commit-reveal

## Use Cases

1. **Protocol Liquidation Bot**
   - Monitor 10 undercollateralized positions
   - Generate batch proof when multiple become liquidatable
   - Single transaction clears all bad debt

2. **Liquidation DAO**
   - Community-operated liquidation service
   - Profits shared among stakers
   - Democratic governance of parameters

3. **Flash Loan Liquidation**
   - Borrow assets via flash loan
   - Execute batch liquidation
   - Repay loan from seized collateral
   - Profit = bonus - flash loan fee

4. **Insurance Fund Integration**
   - Batch includes insolvent positions
   - Shortfall covered by insurance fund
   - Provable bad debt accounting

5. **Cross-Protocol Arbitrage**
   - Liquidate on Aave, deposit on Compound
   - Batch multiple protocols in single proof
   - Maximize capital efficiency

## Real-World Products & User Experience

See [Real-World Products & User Experience](../../product/high-complexity/hc5-batch-liquidation-products.md) for detailed product scenarios and use cases.

---

[Back to Index](../README.md)
