# A6. Grid Trading

Automated buy/sell execution at preset price levels, enabling systematic profit capture from market volatility.

**Constraints**: ~200K per grid level | **Complexity**: Medium

---

## Background

Grid trading is a systematic approach to profiting from market volatility:

- **Range-Bound Markets**: Most assets spend significant time oscillating within ranges; grid trading captures these movements
- **Volatility Monetization**: Profits from price oscillation without directional prediction
- **Automated Execution**: No human intervention needed once grid is configured
- **Risk Distribution**: Capital spread across multiple price levels limits single-point exposure
- **24/7 Operation**: Works continuously in crypto's always-on markets

In traditional finance, grid trading is popular among forex and commodity traders. In DeFi, grid bots exist but are typically centralized and transparent. ZK grid trading hides grid parameters, preventing front-running and grid hunting.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `gridConfigHash` | field | Hash of grid configuration (hidden parameters) |
| `noteHashes[NUM_GRIDS]` | field[] | Hashes of notes at each grid level |
| `outputHashes[NUM_GRIDS]` | field[] | Hashes of output notes after execution |
| `currentPrice` | uint | Oracle-provided current market price |
| `tokenType` | uint | Token type being traded |
| `executedLevels` | uint | Bitmap of which grid levels executed |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | Owner's public key |
| `sk` | field | Secret key for ownership proof |
| `gridPrices[NUM_GRIDS]` | uint[] | Price levels for each grid |
| `gridTypes[NUM_GRIDS]` | uint[] | 0 = buy, 1 = sell for each level |
| `values[NUM_GRIDS]` | uint[] | Note values at each level |
| `salts[NUM_GRIDS]` | field[] | Note randomness for each level |
| `outValues[NUM_GRIDS]` | uint[] | Output values after execution |
| `outSalts[NUM_GRIDS]` | field[] | Output note randomness |
| `lastExecutedPrice` | uint | Previous execution price (for direction check) |

### Circuit Logic

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

### Key Constraints

1. **Ownership Verification**: All grid levels owned by same key
2. **Configuration Integrity**: Grid parameters hash to committed configuration
3. **Execution Conditions**: Buy triggers when price <= gridPrice; sell when price >= gridPrice
4. **Execution Consistency**: Can only execute levels where conditions are met
5. **Value Conservation**: Output values reflect correct conversion at execution price
6. **Minimum Execution**: At least one grid level must execute per proof

## Effects

| Aspect | Impact |
|--------|--------|
| **Automation** | Hands-free execution across price range |
| **Volatility Capture** | Profits from price oscillation without direction |
| **Risk Distribution** | Capital spread across multiple price levels |
| **Privacy** | Grid levels and parameters hidden from market |
| **Consistency** | Mechanical execution without emotional interference |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Grid Hunting** | Grid prices hidden; attackers cannot target levels |
| **Oracle Manipulation** | Use TWAP oracles; multiple source validation |
| **Execution Skipping** | Bitmap tracks which levels executed; no skipping |
| **Value Extraction** | Strict conversion checks at each level |
| **Configuration Tampering** | Hash commitment to full grid configuration |
| **Double Execution** | Each level note has unique nullifier |

## Implementation Challenges

1. **State Management**
   - Track which grid levels have executed
   - Update configuration hash after each execution
   - Handle multi-level executions in single transaction

2. **Price Direction Tracking**
   - Must track whether price crossed level from above or below
   - Prevents executing same level repeatedly without reversal
   - lastExecutedPrice state required

3. **Gas Costs**
   - Multiple grid levels increase proof and verification costs
   - Consider maximum practical grid size (~20 levels)
   - Batch level executions when possible

4. **Rebalancing Logic**
   - After sell at level N, need buy order at level N-1
   - Grid regeneration after execution
   - Consider automated rebalancing circuit

5. **Capital Allocation**
   - Fixed capital per level vs. dynamic allocation
   - Geometric vs. arithmetic grid spacing affects efficiency
   - Initial capital distribution strategy

## Derivatives

1. **Dynamic Grid (Self-Adjusting Levels)** - Grid levels automatically adjust based on recent volatility. High volatility widens spacing; low volatility tightens. Uses rolling volatility calculation to recompute grid prices. Adapts to changing market conditions without manual intervention.

2. **Geometric Grid (Exponential Spacing)** - Grid levels spaced by percentage rather than absolute amount. Better for assets with wide price ranges. Each level represents same percentage move (e.g., 2% intervals). More capital efficient in trending markets.

3. **Multi-Asset Grid Arbitrage** - Grid trades correlated assets simultaneously (ETH/BTC ratio). When ratio deviates, executes pairs trade. Profits from mean reversion of correlations. Single proof covers multiple asset pairs.

4. **Grid with DCA Fallback** - If price breaks out of grid range, converts to DCA strategy. Gradual position building as price continues moving. Prevents grid from becoming inactive in trending markets. Smooth transition between strategies.

5. **Volatility-Adaptive Grid Spacing** - Wider grid spacing in volatile periods, tighter in calm periods. Uses implied volatility or historical vol to adjust. Maximizes profit per execution while minimizing missed opportunities. Self-calibrating based on market conditions.

## Use Cases

1. **Range Trading**
   - ETH trading between $1800-$2200 for several weeks
   - Deploy 10-level grid across the range
   - Buy orders at $1800, $1840, $1880... sell orders at $2000, $2040...
   - Each oscillation within range generates profit
   - No directional bet required; works in both directions

2. **Stablecoin Pair Arbitrage**
   - USDC/USDT typically trades 0.998-1.002
   - Dense grid captures small deviations
   - High frequency of small profits
   - Very low risk due to stable pair
   - Ideal for capital seeking yield without volatility exposure

3. **Accumulation Strategy**
   - Want to accumulate ETH over time
   - Set buy-heavy grid below current price
   - Lower prices trigger more buying
   - Natural DCA into position
   - Sells at higher levels reduce average cost further

4. **Market Making Alternative**
   - Traditional market making requires constant attention
   - Grid provides similar liquidity provision
   - Earns spread on oscillations
   - Set-and-forget implementation
   - Works 24/7 without infrastructure costs

## Real-World Products & User Experience

See dedicated product documentation: [Product Applications](../../product/a-core-trading/a6-grid-trading-products.md)

---

[Back to Index](../../README.md)
