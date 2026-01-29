# B3. Conditional Payment (Oracle)

Execute payments when oracle-verified conditions are met, enabling private prediction markets and automated triggers with hidden terms.

**Constraints**: ~250K | **Complexity**: Medium

---

## Background

Conditional payments enable sophisticated financial agreements:

- **Automated Execution**: Payments triggered by real-world events without manual intervention
- **Prediction Markets**: Bets on outcomes (price targets, election results, sports) require trusted resolution
- **Privacy Problem**: Current conditional payment systems expose all terms publicly, enabling front-running
- **Oracle Dependency**: Trustless execution requires reliable external data sources

Smart contracts can enforce conditions but expose all terms publicly. Adversaries see trigger conditions, amounts, and parties involved. ZK conditional payments hide the condition type, threshold, and parties while still enabling trustless execution when oracle data confirms the condition.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `noteHash` | field | Hash of the conditional payment note |
| `outputHash` | field | Hash of the output note to recipient |
| `conditionType` | uint | Type: 0=PRICE_ABOVE, 1=PRICE_BELOW, 2=TIME_AFTER |
| `threshold` | uint | Condition threshold (price or timestamp) |
| `oracleValue` | uint | Current value from oracle |
| `currentTime` | uint | Current block.timestamp |
| `expiryTime` | uint | Payment expiry timestamp |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `senderPkX, senderPkY` | field | Sender's public key |
| `recipientPkX, recipientPkY` | field | Recipient's public key |
| `value` | uint | Payment amount (hidden) |
| `tokenType` | uint | Token type identifier |
| `salt` | field | Note randomness |
| `sk` | field | Sender's secret key for authorization |
| `outSalt` | field | Output note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/comparators.circom";
include "../utils/mux.circom";

template ConditionalPayment() {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input outputHash;
    signal input conditionType;      // 0=PRICE_ABOVE, 1=PRICE_BELOW, 2=TIME_AFTER
    signal input threshold;
    signal input oracleValue;        // Current value from oracle
    signal input currentTime;
    signal input expiryTime;

    // ===== Private Inputs =====
    signal input senderPkX, senderPkY;
    signal input recipientPkX, recipientPkY;
    signal input value, tokenType, salt, sk;
    signal input outSalt;

    // ===== 1. Verify Conditional Note =====
    component note = Poseidon(10);
    note.inputs[0] <== senderPkX;
    note.inputs[1] <== senderPkY;
    note.inputs[2] <== recipientPkX;
    note.inputs[3] <== recipientPkY;
    note.inputs[4] <== value;
    note.inputs[5] <== tokenType;
    note.inputs[6] <== conditionType;
    note.inputs[7] <== threshold;
    note.inputs[8] <== expiryTime;
    note.inputs[9] <== salt;
    note.out === noteHash;

    // ===== 2. Check Not Expired =====
    component notExpired = LessThan(64);
    notExpired.in[0] <== currentTime;
    notExpired.in[1] <== expiryTime;
    notExpired.out === 1;

    // ===== 3. Evaluate Conditions =====
    // Condition 0: PRICE_ABOVE (oracleValue > threshold)
    component priceAbove = GreaterThan(252);
    priceAbove.in[0] <== oracleValue;
    priceAbove.in[1] <== threshold;

    // Condition 1: PRICE_BELOW (oracleValue < threshold)
    component priceBelow = LessThan(252);
    priceBelow.in[0] <== oracleValue;
    priceBelow.in[1] <== threshold;

    // Condition 2: TIME_AFTER (currentTime > threshold)
    component timeAfter = GreaterThan(64);
    timeAfter.in[0] <== currentTime;
    timeAfter.in[1] <== threshold;

    // ===== 4. Select Condition Based on Type =====
    // conditionType must be 0, 1, or 2
    component isType0 = IsEqual();
    isType0.in[0] <== conditionType;
    isType0.in[1] <== 0;

    component isType1 = IsEqual();
    isType1.in[0] <== conditionType;
    isType1.in[1] <== 1;

    component isType2 = IsEqual();
    isType2.in[0] <== conditionType;
    isType2.in[1] <== 2;

    // Validate conditionType is one of the valid types
    signal validType;
    validType <== isType0.out + isType1.out + isType2.out;
    validType === 1;

    // Select the appropriate condition result
    signal conditionMet;
    conditionMet <== isType0.out * priceAbove.out
                   + isType1.out * priceBelow.out
                   + isType2.out * timeAfter.out;
    conditionMet === 1;

    // ===== 5. Output Note to Recipient =====
    component outNote = PoseidonRegularNote();
    outNote.pkX <== recipientPkX;
    outNote.pkY <== recipientPkY;
    outNote.value <== value;
    outNote.tokenType <== tokenType;
    outNote.salt <== outSalt;
    outNote.out === outputHash;
}

component main {public [noteHash, outputHash, conditionType, threshold,
    oracleValue, currentTime, expiryTime]} = ConditionalPayment();
```

### Key Constraints

1. **Note Format Verification**: Conditional note includes sender, recipient, condition type, threshold, and expiry
2. **Expiry Check**: Payment must be claimed before expiry timestamp
3. **Condition Evaluation**: Oracle value must satisfy the specified condition type
4. **Type Validation**: Condition type must be exactly 0, 1, or 2
5. **Recipient Correctness**: Output note transfers to committed recipient

## Effects

| Aspect | Impact |
|--------|--------|
| **Automation** | Trustless execution without manual intervention |
| **Privacy** | Condition terms hidden until triggered |
| **Flexibility** | Multiple condition types supported in single circuit |
| **Composability** | Can combine with other circuits for complex logic |
| **MEV Protection** | Hidden thresholds prevent front-running |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Oracle Manipulation** | Use decentralized oracles (Chainlink); require multiple sources |
| **Stale Data** | Include freshness check on oracle timestamp |
| **Expiry Attacks** | Ensure sufficient time buffer; consider grace periods |
| **Front-running Resolution** | Commit-reveal scheme for oracle updates |
| **Griefing** | Require bond from executor; forfeit on invalid execution |
| **Condition Gaming** | Use TWAP for price conditions; avoid point-in-time prices |

## Implementation Challenges

1. **Oracle Integration**
   - Need standardized interface for price/event oracles
   - Consider Chainlink, UMA, or custom oracle solutions
   - Price precision and decimal handling must be consistent

2. **Condition Extensibility**
   - Current design supports 3 condition types
   - Adding new types requires circuit update
   - Consider plugin architecture for custom conditions

3. **Expiry Handling**
   - What happens to funds after expiry?
   - Need separate circuit for refund to sender
   - Consider automatic refund mechanism

4. **Multi-Condition Logic**
   - Current design is single condition
   - Complex agreements need AND/OR combinations
   - Consider nested conditional notes

## Derivatives

1. **Private Binary Options** - Bet on whether price will be above or below threshold at expiry. Loser's deposit goes to winner. Both parties commit funds; oracle determines outcome. Enables derivatives trading without revealing positions.

2. **Conditional NFT Transfers** - NFT transfer that executes only when condition met (e.g., payment received, milestone achieved). Useful for atomic swaps and trustless trades without exposing trade terms until execution.

3. **Oracle-Free Conditionals** - Replace trusted oracle with cryptographic proof of external state. Use zkBridge or similar to verify Ethereum state. Enables cross-chain conditional payments without oracle trust assumptions.

4. **Cascading Conditionals** - Chain of conditional payments where one triggers the next. If condition A met, pay B, which enables condition for C. Enables complex multi-party agreements with sequential dependencies.

5. **Conditional Payment Networks** - Lightning-like payment channels with conditional routing. Payments route through intermediaries with conditions. Enables instant conditional settlements without on-chain transaction per payment.

## Use Cases

1. **Private Prediction Markets**
   - Two parties bet on BTC price at year end
   - Each commits 1 ETH to conditional payment
   - If BTC > $100K, Alice wins; otherwise Bob wins
   - Privacy: Market cannot see positions, reducing manipulation

2. **Insurance Payouts**
   - Smart crop insurance with weather oracle
   - Farmer pays premium; receives payout if rainfall below threshold
   - Automatic claim processing on condition met
   - Privacy: Farmer's coverage amount hidden from competitors

3. **Milestone-Based Contracts**
   - Freelancer receives payment when project milestone verified
   - Client funds conditional payment; oracle confirms delivery
   - Automatic release on milestone completion
   - Privacy: Contract terms confidential between parties

4. **Trading Strategy Automation**
   - Trader sets conditional payment: if ETH > $5000, execute swap
   - Funds locked until price condition met
   - No need to monitor prices constantly
   - Privacy: Target price hidden from market participants

## Real-World Products & User Experience

See [Conditional Payment (Oracle) - Products & User Experience](../../../product/b-time-conditions/b3-conditional-products.md) for detailed product scenarios and user stories.

---

[Back to Index](../../README.md)
