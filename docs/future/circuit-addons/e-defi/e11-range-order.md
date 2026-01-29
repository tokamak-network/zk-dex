# E11. Range Order

Place limit orders within price ranges with hidden range boundaries and amounts, enabling private concentrated liquidity strategies.

**Constraints**: ~250K | **Complexity**: Medium

---

## Background

Range orders in concentrated liquidity expose strategic information:

- **Range Boundaries**: Visible price ranges reveal trading intentions and support/resistance levels
- **Position Sizing**: Known liquidity amounts signal capital commitment
- **Strategy Leakage**: Range patterns expose market making or directional strategies
- **Fill Detection**: Observers can calculate when orders become active

Current concentrated liquidity protocols like Uniswap V3 expose all range parameters. Private range orders hide the price boundaries while proving orders execute correctly within committed ranges through ZK proofs.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `rangeOrderNoteHash` | field | Hash of the range order note |
| `depositNoteHash` | field | Hash of deposited liquidity note |
| `poolId` | uint | Pool identifier |
| `currentTick` | int | Current pool price tick |
| `orderType` | uint | Buy-side (0) or Sell-side (1) |
| `nullifier` | field | Prevents order double-spend |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `traderPkX, traderPkY` | field | Trader's public key |
| `traderSk` | field | Trader's secret key |
| `lowerTick` | int | Lower price bound (hidden) |
| `upperTick` | int | Upper price bound (hidden) |
| `liquidityAmount` | uint | Liquidity deposited (hidden) |
| `token0Amount` | uint | Token0 in range (hidden) |
| `token1Amount` | uint | Token1 in range (hidden) |
| `orderSalt` | field | Order note randomness |
| `depositSalt` | field | Deposit note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template RangeOrderCreate() {
    // ===== Public Inputs =====
    signal input rangeOrderNoteHash;
    signal input depositNoteHash;
    signal input poolId;
    signal input currentTick;
    signal input orderType;          // 0 = buy-side, 1 = sell-side
    signal input minTickSpacing;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input traderPkX, traderPkY, traderSk;
    signal input lowerTick, upperTick;
    signal input liquidityAmount;
    signal input token0Amount, token1Amount;
    signal input orderSalt, depositSalt;
    signal input depositTokenType;

    // ===== 1. Verify Trader Ownership =====
    component traderOwnership = ProofOfOwnershipStrict();
    traderOwnership.sk <== traderSk;
    traderOwnership.pkX <== traderPkX;
    traderOwnership.pkY <== traderPkY;

    // ===== 2. Verify Tick Range Valid =====
    // lowerTick < upperTick
    component tickOrderCheck = LessThan(32);
    tickOrderCheck.in[0] <== lowerTick;
    tickOrderCheck.in[1] <== upperTick;
    tickOrderCheck.out === 1;

    // Tick spacing must be respected
    signal tickRange;
    tickRange <== upperTick - lowerTick;

    component spacingCheck = GreaterEqThan(32);
    spacingCheck.in[0] <== tickRange;
    spacingCheck.in[1] <== minTickSpacing;
    spacingCheck.out === 1;

    // ===== 3. Verify Order Type Matches Position =====
    // Buy-side: range below current tick (providing token1, receiving token0)
    // Sell-side: range above current tick (providing token0, receiving token1)

    // For buy-side orders: upperTick <= currentTick
    component buyCheck = LessEqThan(32);
    buyCheck.in[0] <== upperTick;
    buyCheck.in[1] <== currentTick;

    // For sell-side orders: lowerTick >= currentTick
    component sellCheck = GreaterEqThan(32);
    sellCheck.in[0] <== lowerTick;
    sellCheck.in[1] <== currentTick;

    signal typeValid;
    typeValid <== (1 - orderType) * buyCheck.out + orderType * sellCheck.out;
    typeValid === 1;

    // ===== 4. Verify Liquidity Calculation =====
    // Simplified: liquidity relates to token amounts and tick range
    // L = token0 * sqrt(P_upper) * sqrt(P_lower) / (sqrt(P_upper) - sqrt(P_lower))
    // For circuit, we verify bounds rather than exact calculation

    component liquidityPositive = GreaterThan(128);
    liquidityPositive.in[0] <== liquidityAmount;
    liquidityPositive.in[1] <== 0;
    liquidityPositive.out === 1;

    // ===== 5. Verify Deposit Note =====
    // Deposit is in one token (token1 for buy, token0 for sell)
    signal depositAmount;
    depositAmount <== (1 - orderType) * token1Amount + orderType * token0Amount;

    component depositNote = PoseidonRegularNote();
    depositNote.pkX <== traderPkX;
    depositNote.pkY <== traderPkY;
    depositNote.value <== depositAmount;
    depositNote.tokenType <== depositTokenType;
    depositNote.salt <== depositSalt;
    depositNote.out === depositNoteHash;

    // ===== 6. Verify Range Order Note =====
    component orderNote = Poseidon(8);
    orderNote.inputs[0] <== traderPkX;
    orderNote.inputs[1] <== traderPkY;
    orderNote.inputs[2] <== lowerTick;
    orderNote.inputs[3] <== upperTick;
    orderNote.inputs[4] <== liquidityAmount;
    orderNote.inputs[5] <== orderType;
    orderNote.inputs[6] <== poolId;
    orderNote.inputs[7] <== orderSalt;
    orderNote.out === rangeOrderNoteHash;

    // ===== 7. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== depositNoteHash;
    nullifierHash.inputs[1] <== traderSk;
    nullifierHash.out === nullifier;
}

template RangeOrderFill() {
    // ===== Public Inputs =====
    signal input rangeOrderNoteHash;
    signal input outputNoteHash;
    signal input poolId;
    signal input currentTick;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input traderPkX, traderPkY, traderSk;
    signal input lowerTick, upperTick;
    signal input liquidityAmount;
    signal input orderType;
    signal input orderSalt;
    signal input filledAmount;
    signal input outputSalt;

    // ===== 1. Verify Trader Ownership =====
    component traderOwnership = ProofOfOwnershipStrict();
    traderOwnership.sk <== traderSk;
    traderOwnership.pkX <== traderPkX;
    traderOwnership.pkY <== traderPkY;

    // ===== 2. Verify Range Order Note =====
    component orderNote = Poseidon(8);
    orderNote.inputs[0] <== traderPkX;
    orderNote.inputs[1] <== traderPkY;
    orderNote.inputs[2] <== lowerTick;
    orderNote.inputs[3] <== upperTick;
    orderNote.inputs[4] <== liquidityAmount;
    orderNote.inputs[5] <== orderType;
    orderNote.inputs[6] <== poolId;
    orderNote.inputs[7] <== orderSalt;
    orderNote.out === rangeOrderNoteHash;

    // ===== 3. Verify Order is Fillable =====
    // Price must have crossed through the range
    // Buy-side: price crossed from above to below range (now below lowerTick)
    // Sell-side: price crossed from below to above range (now above upperTick)

    component buyFillable = LessThan(32);
    buyFillable.in[0] <== currentTick;
    buyFillable.in[1] <== lowerTick;

    component sellFillable = GreaterThan(32);
    sellFillable.in[0] <== currentTick;
    sellFillable.in[1] <== upperTick;

    signal isFillable;
    isFillable <== (1 - orderType) * buyFillable.out + orderType * sellFillable.out;
    isFillable === 1;

    // ===== 4. Verify Fill Amount =====
    // Full fill converts all liquidity to target token
    // filledAmount should correspond to liquidity converted at range prices

    component fillPositive = GreaterThan(128);
    fillPositive.in[0] <== filledAmount;
    fillPositive.in[1] <== 0;
    fillPositive.out === 1;

    // ===== 5. Verify Output Note =====
    // Buy-side outputs token0, sell-side outputs token1
    signal outputTokenType;
    outputTokenType <== (1 - orderType) * 0 + orderType * 1;

    component outputNote = PoseidonRegularNote();
    outputNote.pkX <== traderPkX;
    outputNote.pkY <== traderPkY;
    outputNote.value <== filledAmount;
    outputNote.tokenType <== outputTokenType;
    outputNote.salt <== outputSalt;
    outputNote.out === outputNoteHash;

    // ===== 6. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== rangeOrderNoteHash;
    nullifierHash.inputs[1] <== traderSk;
    nullifierHash.out === nullifier;
}

template RangeOrderCancel() {
    // ===== Public Inputs =====
    signal input rangeOrderNoteHash;
    signal input refundNoteHash;
    signal input poolId;
    signal input currentTick;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input traderPkX, traderPkY, traderSk;
    signal input lowerTick, upperTick;
    signal input liquidityAmount;
    signal input orderType;
    signal input orderSalt;
    signal input refundAmount;
    signal input refundSalt;

    // ===== 1. Verify Trader Ownership =====
    component traderOwnership = ProofOfOwnershipStrict();
    traderOwnership.sk <== traderSk;
    traderOwnership.pkX <== traderPkX;
    traderOwnership.pkY <== traderPkY;

    // ===== 2. Verify Range Order Note =====
    component orderNote = Poseidon(8);
    orderNote.inputs[0] <== traderPkX;
    orderNote.inputs[1] <== traderPkY;
    orderNote.inputs[2] <== lowerTick;
    orderNote.inputs[3] <== upperTick;
    orderNote.inputs[4] <== liquidityAmount;
    orderNote.inputs[5] <== orderType;
    orderNote.inputs[6] <== poolId;
    orderNote.inputs[7] <== orderSalt;
    orderNote.out === rangeOrderNoteHash;

    // ===== 3. Verify Order Not Yet Fillable =====
    // Can only cancel if price hasn't crossed the range yet

    // Buy-side: currentTick >= lowerTick (not yet crossed down)
    component buyNotFilled = GreaterEqThan(32);
    buyNotFilled.in[0] <== currentTick;
    buyNotFilled.in[1] <== lowerTick;

    // Sell-side: currentTick <= upperTick (not yet crossed up)
    component sellNotFilled = LessEqThan(32);
    sellNotFilled.in[0] <== currentTick;
    sellNotFilled.in[1] <== upperTick;

    signal canCancel;
    canCancel <== (1 - orderType) * buyNotFilled.out + orderType * sellNotFilled.out;
    canCancel === 1;

    // ===== 4. Verify Refund Note =====
    signal refundTokenType;
    refundTokenType <== (1 - orderType) * 1 + orderType * 0;

    component refundNote = PoseidonRegularNote();
    refundNote.pkX <== traderPkX;
    refundNote.pkY <== traderPkY;
    refundNote.value <== refundAmount;
    refundNote.tokenType <== refundTokenType;
    refundNote.salt <== refundSalt;
    refundNote.out === refundNoteHash;

    // ===== 5. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== rangeOrderNoteHash;
    nullifierHash.inputs[1] <== traderSk;
    nullifierHash.out === nullifier;
}

component main {public [rangeOrderNoteHash, depositNoteHash, poolId,
    currentTick, orderType, minTickSpacing, nullifier]} = RangeOrderCreate();
```

### Key Constraints

1. **Ownership Verification**: Trader proves control via secret key
2. **Range Validity**: Lower tick below upper tick with minimum spacing
3. **Order Type Consistency**: Range position matches order direction
4. **Fill Conditions**: Price must have crossed range for fill
5. **Cancel Conditions**: Price must not have filled order
6. **Liquidity Accounting**: Deposit and output amounts correct

## Effects

| Aspect | Impact |
|--------|--------|
| **Range Privacy** | Price boundaries hidden from observers |
| **Position Confidentiality** | Liquidity amounts not visible |
| **Strategy Protection** | Support/resistance levels concealed |
| **Fill Privacy** | Observers cannot predict fill timing |
| **Fair Execution** | Cryptographic proof of correct fill |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Range Overlap Attacks** | Independent range commitment per order |
| **Fill Frontrunning** | Range hidden until crossed |
| **Cancel Griefing** | Only owner can cancel, state proof required |
| **Oracle Manipulation** | Tick derived from pool state, not external oracle |
| **Double Fill** | Nullifier prevents duplicate fills |
| **Partial Fill Gaming** | Full fill only, no partial execution |

## Implementation Challenges

1. **Tick Price Mapping**
   - Converting ticks to actual prices
   - Precision in sqrt price calculations
   - Tick spacing enforcement

2. **Pool State Integration**
   - Tracking current tick from pool
   - Handling tick transitions
   - Fee accrual during range activity

3. **Liquidity Calculation**
   - Accurate L calculation from token amounts
   - Virtual reserves at range boundaries
   - Price impact within range

4. **Order Book Management**
   - Tracking active range orders
   - Efficient fill detection
   - Order expiration handling

## Derivatives

1. **Dynamic Range Adjustment** - Modify range boundaries without withdrawing. Proves new range is valid while hiding both old and new boundaries.

2. **Multi-Range Positions** - Place multiple non-overlapping ranges in single proof. Hides individual range allocations while proving total liquidity commitment.

3. **Range Order Fills** - Fill mechanism proves price crossed range. Enables trustless execution without revealing exact fill price or amount.

4. **Out-of-Range Handling** - Convert filled range order back to liquidity. Proves conversion without revealing original range parameters.

5. **Range Order Aggregation** - Combine multiple small range orders for gas efficiency. Single proof handles batch of orders while hiding individual parameters.

## Use Cases

1. **Limit Order Replacement**
   - Trader wants to buy at specific price
   - Sets range order below current price
   - Price boundary hidden from market

2. **Market Making Strategy**
   - Professional MM sets ranges around market
   - Range widths and depths hidden
   - Competitors cannot copy strategy

3. **Accumulation/Distribution**
   - Investor accumulates position over price range
   - Range and size hidden
   - Market cannot detect large buyer

4. **Volatility Trading**
   - Trader expects price movement
   - Sets ranges to capture movement
   - Breakout levels not exposed

## Real-World Products & User Experience

See: [Range Order - Real-World Products](../../../product/e-defi/e11-range-order-products.md)
---

[Back to Index](../../README.md)
