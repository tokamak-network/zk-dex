# A8. TWAP Order

Time-Weighted Average Price execution that splits large orders into smaller chunks over a defined period, minimizing market impact.

**Constraints**: ~200K per chunk | **Complexity**: Medium

---

## Background

TWAP is essential for executing large orders without adverse market impact:

- **Market Impact Minimization**: Large orders executed at once move prices unfavorably; spreading execution over time achieves better average prices
- **Institutional Standard**: TWAP is the most common algorithmic execution strategy in traditional finance
- **Hidden Order Size**: Total order quantity hidden from market observers who might front-run
- **Predictable Execution**: Known execution schedule allows planning around capital availability
- **Benchmark Performance**: TWAP provides clear benchmark for execution quality measurement

In traditional finance, TWAP is offered by all major brokers. In DeFi, TWAP implementations are rare and typically transparent, exposing order size and timing to MEV searchers. ZK TWAP hides both total size and execution schedule.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `orderHash` | field | Hash of the full TWAP order commitment |
| `executionHash` | field | Hash of this chunk's output |
| `newOrderHash` | field | Hash of updated order (remaining chunks) |
| `chunkIndex` | uint | Current chunk number (0-indexed) |
| `totalChunks` | uint | Total number of chunks in order |
| `currentTime` | uint | Current timestamp |
| `tokenType` | uint | Token type being executed |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `ownerPkX, ownerPkY` | field | Order owner's public key |
| `sk` | field | Secret key for ownership proof |
| `totalAmount` | uint | Total order amount (hidden) |
| `executedAmount` | uint | Amount already executed |
| `startTime` | uint | TWAP order start time |
| `endTime` | uint | TWAP order end time |
| `orderSalt` | field | Order randomness |
| `chunkAmount` | uint | This chunk's execution amount |
| `chunkPrice` | uint | Execution price for this chunk |
| `chunkSalt` | field | Chunk output randomness |
| `outPkX, outPkY` | field | Output note owner |
| `outValue` | uint | Output value (received tokens) |
| `outToken` | uint | Output token type |
| `outSalt` | field | Output note randomness |
| `newOrderSalt` | field | Updated order randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../utils/math/safe_div.circom";

template TWAPExecution() {
    // ===== Public Inputs =====
    signal input orderHash;
    signal input executionHash;
    signal input newOrderHash;
    signal input chunkIndex;
    signal input totalChunks;
    signal input currentTime;
    signal input tokenType;

    // ===== Private Inputs =====
    signal input ownerPkX, ownerPkY, sk;
    signal input totalAmount, executedAmount;
    signal input startTime, endTime, orderSalt;
    signal input chunkAmount, chunkPrice, chunkSalt;
    signal input outPkX, outPkY, outValue, outToken, outSalt;
    signal input newOrderSalt;

    // ===== 1. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sk;
    ownership.pkX <== ownerPkX;
    ownership.pkY <== ownerPkY;

    // ===== 2. Verify Order Hash =====
    component orderCommit = Poseidon(7);
    orderCommit.inputs[0] <== ownerPkX;
    orderCommit.inputs[1] <== ownerPkY;
    orderCommit.inputs[2] <== totalAmount;
    orderCommit.inputs[3] <== executedAmount;
    orderCommit.inputs[4] <== startTime;
    orderCommit.inputs[5] <== endTime;
    orderCommit.inputs[6] <== orderSalt;
    orderCommit.out === orderHash;

    // ===== 3. Time Window Validation =====
    // Calculate chunk time window
    signal duration;
    duration <== endTime - startTime;

    component chunkDuration = SafeDiv(64);
    chunkDuration.dividend <== duration;
    chunkDuration.divisor <== totalChunks;

    signal chunkStart;
    chunkStart <== startTime + chunkIndex * chunkDuration.quotient;

    signal chunkEnd;
    chunkEnd <== chunkStart + chunkDuration.quotient;

    // currentTime must be in [chunkStart, chunkEnd]
    component timeCheck1 = GreaterEqThan(64);
    timeCheck1.in[0] <== currentTime;
    timeCheck1.in[1] <== chunkStart;
    timeCheck1.out === 1;

    component timeCheck2 = LessEqThan(64);
    timeCheck2.in[0] <== currentTime;
    timeCheck2.in[1] <== chunkEnd;
    timeCheck2.out === 1;

    // ===== 4. Chunk Index Validation =====
    // chunkIndex must match executedAmount / (totalAmount / totalChunks)
    signal expectedChunksExecuted;
    component chunkSize = SafeDiv(64);
    chunkSize.dividend <== totalAmount;
    chunkSize.divisor <== totalChunks;

    component expectedIndex = SafeDiv(64);
    expectedIndex.dividend <== executedAmount;
    expectedIndex.divisor <== chunkSize.quotient;
    expectedChunksExecuted <== expectedIndex.quotient;

    chunkIndex === expectedChunksExecuted;

    // ===== 5. Chunk Amount Validation =====
    // Standard chunk size (last chunk may be smaller due to rounding)
    signal remainingAmount;
    remainingAmount <== totalAmount - executedAmount;

    // chunkAmount should be min(chunkSize, remainingAmount)
    component isLastChunk = IsZero();
    isLastChunk.in <== totalChunks - chunkIndex - 1;

    signal standardChunkAmount;
    standardChunkAmount <== chunkSize.quotient;

    // For non-last chunks, must equal standard size
    // For last chunk, must equal remaining amount
    signal expectedChunkAmount;
    expectedChunkAmount <== isLastChunk.out * remainingAmount +
                           (1 - isLastChunk.out) * standardChunkAmount;

    chunkAmount === expectedChunkAmount;

    // ===== 6. Output Value Calculation =====
    // outValue = chunkAmount * chunkPrice / PRICE_PRECISION
    signal expectedOutValue;
    expectedOutValue <== chunkAmount * chunkPrice;

    component outValueCheck = GreaterEqThan(128);
    outValueCheck.in[0] <== outValue * 1000000 + 1000000;  // With tolerance
    outValueCheck.in[1] <== expectedOutValue;
    outValueCheck.out === 1;

    // ===== 7. Create Execution Output Note =====
    component execOut = PoseidonRegularNote();
    execOut.pkX <== outPkX;
    execOut.pkY <== outPkY;
    execOut.value <== outValue;
    execOut.tokenType <== outToken;
    execOut.salt <== outSalt;
    execOut.out === executionHash;

    // ===== 8. Update Order State =====
    signal newExecutedAmount;
    newExecutedAmount <== executedAmount + chunkAmount;

    // If order complete, newOrderHash should be 0
    component isComplete = IsZero();
    isComplete.in <== totalAmount - newExecutedAmount;

    component newOrderCommit = Poseidon(7);
    newOrderCommit.inputs[0] <== ownerPkX;
    newOrderCommit.inputs[1] <== ownerPkY;
    newOrderCommit.inputs[2] <== totalAmount;
    newOrderCommit.inputs[3] <== newExecutedAmount;
    newOrderCommit.inputs[4] <== startTime;
    newOrderCommit.inputs[5] <== endTime;
    newOrderCommit.inputs[6] <== newOrderSalt;

    // If complete, hash is 0; otherwise, updated order hash
    signal expectedNewOrderHash;
    expectedNewOrderHash <== (1 - isComplete.out) * newOrderCommit.out;
    newOrderHash === expectedNewOrderHash;
}

component main {public [orderHash, executionHash, newOrderHash, chunkIndex,
    totalChunks, currentTime, tokenType]} = TWAPExecution();
```

### Key Constraints

1. **Ownership Verification**: Only order owner can execute chunks
2. **Time Window**: Each chunk can only execute in its designated time window
3. **Sequential Execution**: Chunk index must match number of executed chunks
4. **Chunk Size**: Non-final chunks have fixed size; final chunk takes remainder
5. **Value Calculation**: Output value matches chunkAmount * price
6. **State Update**: New order hash reflects updated executed amount

## Effects

| Aspect | Impact |
|--------|--------|
| **Market Impact** | Minimized price slippage from large orders |
| **Execution Quality** | Average price over period vs. single-point execution |
| **Strategy Exposure** | Hidden total order size prevents front-running |
| **Predictability** | Known execution schedule for capital planning |
| **Benchmark** | Clear metric (actual vs. TWAP) for quality measurement |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Timing Manipulation** | Block timestamps validated; reasonable bounds enforced |
| **Order Size Discovery** | Total amount hidden; only chunk size visible |
| **Chunk Skipping** | Sequential index check prevents skipping chunks |
| **Early/Late Execution** | Time window constraints enforce schedule |
| **Price Manipulation** | Each chunk executes at market price; consider TWAP oracle |
| **Order Cancellation Abuse** | Consider cancellation fee or delay |

## Implementation Challenges

1. **Division Circuit Complexity**
   - Multiple divisions for chunk timing and sizing
   - SafeDiv component needed for each division
   - Remainder handling for uneven splits

2. **State Persistence**
   - Order state must persist across multiple transactions
   - New order hash tracks execution progress
   - Consider on-chain order registry

3. **Execution Incentives**
   - Who submits chunk execution proofs?
   - Keeper network integration needed
   - Execution reward from portion of output

4. **Price Source for Chunks**
   - Each chunk needs fair execution price
   - Market orders at time of chunk window
   - Consider limit order integration per chunk

5. **Slippage Accumulation**
   - Small slippage per chunk may accumulate
   - Total slippage tolerance parameter needed
   - Consider abort mechanism if slippage excessive

## Derivatives

1. **VWAP (Volume-Weighted Average Price)** - Execution weighted by historical volume patterns. More shares during high-volume periods, fewer during low volume. Better matches natural market flow. Requires volume oracle or historical data commitment.

2. **Adaptive TWAP** - Adjusts execution rate based on market conditions. Speeds up execution when spread is tight; slows when volatile. Real-time market data integration required. Circuit includes spread/volatility check.

3. **TWAP with Price Limits** - Each chunk has maximum acceptable price. If market price exceeds limit, chunk defers to next window. Prevents execution at unfavorable prices. Adds price ceiling check per chunk.

4. **Randomized TWAP** - Chunk execution times randomized within windows. Prevents predictable execution timing. Makes front-running more difficult. Verifiable randomness integration needed.

5. **Cross-Venue TWAP** - Splits execution across multiple DEXs/liquidity sources. Better price discovery through competition. Single proof covers multi-venue routing. Complex integration with multiple protocols.

## Use Cases

1. **Institutional Accumulation**
   - Fund wants to buy $10M worth of ETH
   - Single market order would move price 2-3%
   - TWAP over 1 week: 168 hourly chunks
   - Each chunk ~$60K has minimal impact
   - Total execution at near-market average price

2. **Treasury Diversification**
   - Protocol treasury holds 1M governance tokens
   - Needs to diversify into stables over quarter
   - TWAP sells ~11K tokens daily
   - Market absorbs sales without panic
   - No signal of "treasury dumping"

3. **Vesting Schedule Execution**
   - Employee has 4-year token vest
   - Wants to sell as tokens unlock
   - TWAP aligned with vesting schedule
   - Automatic execution as tokens vest
   - No need to monitor unlock dates

4. **Portfolio Rebalancing**
   - Investment fund quarterly rebalance
   - Needs to shift 20% from ETH to BTC
   - TWAP executes both sides over week
   - Buys and sells spread across time
   - Minimizes impact on both assets

## Real-World Products & User Experience

See dedicated product documentation: [Product Applications](../../product/a-core-trading/a8-twap-products.md)

---

[Back to Index](../../README.md)
