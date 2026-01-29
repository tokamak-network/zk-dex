# A2. Partial Fill Orders

Execute partial amount of an order with automatic residual order creation, enabling flexible liquidity matching.

**Constraints**: ~400K | **Complexity**: Medium

---

## Background

Partial fills are essential for practical exchange functionality:

- **Liquidity Fragmentation**: Exact amount matching is impractical; orders rarely find perfect counterparties
- **Large Order Execution**: Whales need to fill large orders incrementally without moving markets
- **Market Depth Utilization**: Partial fills allow orders to consume available liquidity across price levels
- **Capital Efficiency**: Traders can deploy capital even when full order cannot be immediately matched
- **Order Book Dynamics**: Professional trading requires partial execution support for algorithmic strategies

In traditional exchanges, partial fills are standard. Current ZK-DEX implementations typically require exact matching, severely limiting liquidity utilization.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `makerNoteHash` | field | Hash of maker's order note |
| `takerStakeHash` | field | Hash of taker's commitment note |
| `makerOutputHash` | field | Hash of maker's received payment |
| `takerOutputHash` | field | Hash of taker's received goods |
| `residualHash` | field | Hash of remaining order (0 if fully filled) |
| `fillAmount` | uint | Amount being filled in this execution |
| `price` | uint | Execution price |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `makerPkX, makerPkY` | field | Maker's public key |
| `makerValue` | uint | Original order value |
| `makerToken` | uint | Token type being sold |
| `makerSalt` | field | Maker note randomness |
| `makerSk` | field | Maker's secret key |
| `takerParent` | field | Parent hash linking taker to maker |
| `takerRecipientX, takerRecipientY` | field | Taker's receiving public key |
| `takerValue` | uint | Taker's stake value |
| `takerToken` | uint | Taker's token type |
| `takerSalt` | field | Taker note randomness |
| `residualValue` | uint | Remaining order value after fill |
| `residualSalt` | field | Residual note randomness |
| `makerOutValue` | uint | Value maker receives |
| `makerOutSalt` | field | Maker output randomness |
| `takerOutValue` | uint | Value taker receives |
| `takerOutSalt` | field | Taker output randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/poseidon/poseidon_smart_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template PartialFill() {
    // ===== Public Inputs =====
    signal input makerNoteHash;
    signal input takerStakeHash;
    signal input makerOutputHash;
    signal input takerOutputHash;
    signal input residualHash;
    signal input fillAmount;
    signal input price;

    // ===== Private Inputs =====
    // Maker note
    signal input makerPkX, makerPkY, makerValue, makerToken, makerSalt, makerSk;
    // Taker stake
    signal input takerParent, takerRecipientX, takerRecipientY;
    signal input takerValue, takerToken, takerSalt;
    // Residual
    signal input residualValue, residualSalt;
    // Outputs
    signal input makerOutValue, makerOutSalt;
    signal input takerOutValue, takerOutSalt;

    // ===== 1. Verify Maker Note =====
    component makerNote = PoseidonRegularNote();
    makerNote.pkX <== makerPkX;
    makerNote.pkY <== makerPkY;
    makerNote.value <== makerValue;
    makerNote.tokenType <== makerToken;
    makerNote.salt <== makerSalt;
    makerNote.out === makerNoteHash;

    // ===== 2. Verify Maker Ownership =====
    component makerOwn = ProofOfOwnershipStrict();
    makerOwn.sk <== makerSk;
    makerOwn.pkX <== makerPkX;
    makerOwn.pkY <== makerPkY;

    // ===== 3. Verify Taker Stake Links to Maker =====
    component takerNote = PoseidonSmartNote();
    takerNote.parentHash <== takerParent;
    takerNote.recipientPkX <== takerRecipientX;
    takerNote.recipientPkY <== takerRecipientY;
    takerNote.value <== takerValue;
    takerNote.tokenType <== takerToken;
    takerNote.salt <== takerSalt;
    takerNote.out === takerStakeHash;

    // Parent must be maker's order
    takerParent === makerNoteHash;

    // ===== 4. Fill Amount Constraints =====
    // fillAmount must be <= makerValue
    component fillCheck = LessEqThan(64);
    fillCheck.in[0] <== fillAmount;
    fillCheck.in[1] <== makerValue;
    fillCheck.out === 1;

    // fillAmount must be > 0
    component fillNonZero = GreaterThan(64);
    fillNonZero.in[0] <== fillAmount;
    fillNonZero.in[1] <== 0;
    fillNonZero.out === 1;

    // ===== 5. Residual Calculation =====
    residualValue === makerValue - fillAmount;

    // ===== 6. Price Calculation =====
    // makerOutValue = fillAmount * price / PRICE_PRECISION
    signal expectedPayment;
    expectedPayment <== fillAmount * price;

    // Verify maker receives correct payment (within rounding tolerance)
    component paymentCheck = LessEqThan(128);
    paymentCheck.in[0] <== makerOutValue * 1000000;  // PRICE_PRECISION
    paymentCheck.in[1] <== expectedPayment + 1000000;  // Allow 1 unit rounding
    paymentCheck.out === 1;

    component paymentMin = GreaterEqThan(128);
    paymentMin.in[0] <== makerOutValue * 1000000;
    paymentMin.in[1] <== expectedPayment - 1000000;
    paymentMin.out === 1;

    // takerOutValue = fillAmount (taker receives the filled goods)
    takerOutValue === fillAmount;

    // ===== 7. Create Residual Note (if partial fill) =====
    component residualNote = PoseidonRegularNote();
    residualNote.pkX <== makerPkX;
    residualNote.pkY <== makerPkY;
    residualNote.value <== residualValue;
    residualNote.tokenType <== makerToken;
    residualNote.salt <== residualSalt;

    // Conditional hash check: if residualValue > 0, hash must match
    // If residualValue == 0, residualHash must be 0
    component isFullFill = IsZero();
    isFullFill.in <== residualValue;

    // residualHash = isFullFill ? 0 : residualNote.out
    signal expectedResidualHash;
    expectedResidualHash <== (1 - isFullFill.out) * residualNote.out;
    residualHash === expectedResidualHash;

    // ===== 8. Verify Maker Output Note =====
    component makerOut = PoseidonRegularNote();
    makerOut.pkX <== makerPkX;
    makerOut.pkY <== makerPkY;
    makerOut.value <== makerOutValue;
    makerOut.tokenType <== takerToken;  // Maker receives taker's token
    makerOut.salt <== makerOutSalt;
    makerOut.out === makerOutputHash;

    // ===== 9. Verify Taker Output Note =====
    component takerOut = PoseidonRegularNote();
    takerOut.pkX <== takerRecipientX;
    takerOut.pkY <== takerRecipientY;
    takerOut.value <== takerOutValue;
    takerOut.tokenType <== makerToken;  // Taker receives maker's token
    takerOut.salt <== takerOutSalt;
    takerOut.out === takerOutputHash;
}

component main {public [makerNoteHash, takerStakeHash, makerOutputHash,
    takerOutputHash, residualHash, fillAmount, price]} = PartialFill();
```

### Key Constraints

1. **Parent Linkage**: Taker's stake must reference maker's order hash
2. **Fill Bounds**: Fill amount must be positive and not exceed order size
3. **Residual Conservation**: residualValue = makerValue - fillAmount
4. **Price Accuracy**: Payment must match fillAmount * price within rounding
5. **Conditional Residual**: Non-zero residual produces valid note; zero residual produces zero hash
6. **Token Swap**: Maker receives taker's token type; taker receives maker's token type

## Effects

| Aspect | Impact |
|--------|--------|
| **Liquidity Utilization** | 2-3x improvement through flexible matching |
| **Execution Speed** | Faster fills with partial counterparty matches |
| **Order Book Depth** | Orders remain active after partial execution |
| **Capital Efficiency** | Deployed capital earns returns incrementally |
| **Market Making** | Enables professional market making strategies |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Residual Manipulation** | Circuit enforces exact residual calculation |
| **Price Deviation** | Strict price check with minimal rounding tolerance |
| **Double Fill** | Original note nullified; residual has new hash |
| **Fill Amount Inflation** | LessEqThan constraint prevents over-filling |
| **Orphaned Residuals** | Same owner public key ensures recoverability |
| **Rounding Exploitation** | Bounded tolerance prevents systematic extraction |

## Implementation Challenges

1. **State Management**
   - Contract must track original order and residual relationship
   - Nullifier for original note; new entry for residual
   - Consider order ID commitment for tracking across fills

2. **Minimum Fill Thresholds**
   - Very small fills may not be economically viable
   - Implement minimum fill size (e.g., 1% of order)
   - Dust prevention to avoid note proliferation

3. **Price Precision Handling**
   - Integer arithmetic requires careful precision management
   - Standard precision: 6 decimals (1000000)
   - Document rounding behavior for users

4. **Multi-Fill Coordination**
   - Multiple takers may attempt to fill same order
   - First valid proof wins; others receive stale error
   - Consider optimistic matching with settlement race

5. **Residual Note Management**
   - Users accumulate residual notes over time
   - Integrate with batch transfer for consolidation
   - UI should track and display residual orders

## Derivatives

1. **Streaming Order Execution** - Large orders filled in predetermined increments over time. Combines partial fill with TWAP logic to minimize market impact. Each fill creates time-locked residual that unlocks for next fill window.

2. **Order Amendment** - Modify unfilled portion of existing order (price, cancel partial). Circuit proves ownership of residual note and creates new order with updated parameters. Enables dynamic order management without full cancellation.

3. **Fill-or-Kill with Minimum** - Order specifies minimum fill threshold; execution fails if minimum cannot be met. Useful for orders where partial fill below threshold is not economically viable. Circuit adds minimum fill check.

4. **Proportional Multi-Asset Settlement** - Single order sells multiple tokens with proportional fill across all. Each partial fill reduces all token amounts proportionally. Complex residual tracking for multi-token positions.

5. **Residual Order Aggregation** - Automatically combine small residuals from same owner into single order. Background service monitors residuals and triggers aggregation when gas-efficient. Reduces note management overhead.

## Use Cases

1. **Large Institutional Order**
   - Fund needs to sell 1000 ETH without moving market
   - Places limit order; fills happen incrementally as buyers arrive
   - Each fill creates residual for remaining amount
   - Full execution may take hours/days with minimal price impact

2. **Market Making**
   - Market maker places orders on both sides of spread
   - Orders partially fill as prices move
   - Residuals automatically adjust based on inventory
   - Continuous liquidity provision with risk management

3. **DCA Selling**
   - User wants to gradually exit position
   - Sets order with high limit; accepts partial fills
   - Each fill takes profit; residual remains for future fills
   - Natural DCA exit without multiple order management

4. **Arbitrage Execution**
   - Arbitrageur spots price discrepancy between venues
   - Places large order; takes whatever liquidity available
   - Partial fill still profitable if spread exceeds costs
   - Residual can be cancelled or left for future opportunity

## Real-World Products & User Experience

See dedicated product documentation: [Product Applications](../../product/a-core-trading/a2-partial-fill-products.md)

---

[Back to Index](../../README.md)
