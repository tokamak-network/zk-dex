# I7. Futarchy Markets

Prediction market-based governance infrastructure where market prices inform protocol decisions while maintaining voter privacy.

**Requirements**: Conditional token framework | Market making | Decision oracle | Private voting integration

---

## Background

Traditional governance suffers from significant limitations:

- **Information Aggregation**: Token voting doesn't efficiently aggregate knowledge
- **Voter Apathy**: Low participation in governance votes
- **Plutocracy**: Large holders dominate decisions regardless of expertise
- **Gaming**: Vote buying and strategic voting distort outcomes

Futarchy addresses these by using prediction markets:
- Markets aggregate dispersed information efficiently
- Financial incentives attract informed participants
- Anyone can influence outcomes proportional to conviction
- Market manipulation is expensive and self-correcting

For ZK-DEX, futarchy enables evidence-based governance with privacy-preserved participation.

## Technical Specification

### Architecture Overview

```
Proposal                      Futarchy Markets                   Decision
+------------+                +-----------------------+          +----------+
|            |                |                       |          |          |
| Governance |  Create        |  Conditional Market A |          | Execute  |
| Proposal   |--------------->|  "Price if YES"       |--------->| or       |
|            |                |                       |          | Reject   |
+------------+                |  Conditional Market B |          +----------+
                              |  "Price if NO"        |
                              |                       |
                              +-----------------------+
                                       |
                                       v
                              +-----------------------+
                              |  Price Comparison     |
                              |  YES price > NO price |
                              |  = Execute proposal   |
                              +-----------------------+
```

### Component List

| Component | Description |
|-----------|-------------|
| **Proposal Contract** | Defines decision and creates markets |
| **Conditional Tokens** | Tokens that settle based on decision outcome |
| **Market Maker** | Provides liquidity for price discovery |
| **Price Oracle** | Determines final settlement prices |
| **Decision Engine** | Executes based on market consensus |
| **Privacy Layer** | ZK proofs for private market participation |

### Data Flows

1. **Proposal Creation**
   - Governance proposal submitted
   - Two conditional markets created:
     - Market A: Token price assuming proposal passes
     - Market B: Token price assuming proposal fails

2. **Market Trading**
   - Participants trade based on beliefs
   - Informed traders profit; uninformed lose
   - Prices converge to true expected values

3. **Decision Execution**
   - After trading period, compare prices
   - If Price(YES) > Price(NO): execute proposal
   - Markets settle accordingly

### Futarchy Market Circuit

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/comparators.circom";

template FutarchyTrade() {
    // Public inputs
    signal input marketId;           // Which market (YES or NO)
    signal input tradeCommitment;    // Commitment to trade details
    signal input priceCommitment;    // Commitment to execution price
    signal input nullifier;

    // Private inputs
    signal input trader;             // Trader identity (hidden)
    signal input amount;             // Trade size (hidden)
    signal input price;              // Execution price
    signal input direction;          // Buy(1) or Sell(0)
    signal input salt;

    // Verify trade commitment
    component tradeHash = Poseidon(5);
    tradeHash.inputs[0] <== marketId;
    tradeHash.inputs[1] <== trader;
    tradeHash.inputs[2] <== amount;
    tradeHash.inputs[3] <== direction;
    tradeHash.inputs[4] <== salt;
    tradeHash.out === tradeCommitment;

    // Verify price commitment
    component priceHash = Poseidon(3);
    priceHash.inputs[0] <== price;
    priceHash.inputs[1] <== marketId;
    priceHash.inputs[2] <== salt;
    priceHash.out === priceCommitment;

    // Verify direction is valid
    direction * (1 - direction) === 0;
}

component main {public [marketId, tradeCommitment, priceCommitment, nullifier]} = FutarchyTrade();
```

## Effects

| Aspect | Impact |
|--------|--------|
| **Information Quality** | Markets aggregate knowledge better than voting |
| **Participation** | Financial incentives increase engagement |
| **Manipulation Resistance** | Manipulation is expensive; markets self-correct |
| **Decision Quality** | Evidence-based decisions; skin in the game |
| **Voter Privacy** | ZK proofs hide individual positions |
| **Expertise Weighting** | Knowledgeable participants naturally weighted |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Market Manipulation** | Cost of manipulation exceeds benefit |
| **Thin Markets** | Minimum liquidity requirements; subsidized market making |
| **Oracle Manipulation** | Decentralized oracle network; TWAP pricing |
| **Proposal Spam** | Proposal bonds; curation markets |
| **Short-Term Thinking** | Long evaluation periods; delayed settlement |
| **Collusion** | Private trading; unpredictable matching |

## Implementation Challenges

1. **Liquidity Bootstrapping**
   - New markets have low liquidity
   - Wide spreads discourage participation
   - Need market maker subsidies initially

2. **Decision Metric Definition**
   - What price measures "success"?
   - Protocol token price? TVL? User count?
   - Clear metrics essential for market clarity

3. **Time Horizon**
   - Short markets may not reflect long-term value
   - Long markets tie up capital
   - Optimal duration depends on decision type

4. **Conditional Settlement**
   - Markets only settle for winning scenario
   - Losing scenario tokens worthless
   - Clear settlement rules needed

5. **Reflexivity**
   - Market outcome affects decision affects market
   - Can create unstable feedback loops
   - Need careful mechanism design

## Derivatives

1. **Conditional Markets** - Tokens that pay out based on proposal outcome. YES tokens pay if proposal passes. NO tokens pay if proposal fails.

2. **Policy Markets** - Predict outcome of specific policies. Compare expected results of alternatives. Data-driven policy selection.

3. **Information Markets** - Markets for verifiable future facts. Incentivize information revelation. Connect to decision markets.

4. **Decision Markets** - Markets specifically for governance decisions. Standardized framework for proposals. Automated execution on outcome.

5. **Meta-Governance Markets** - Markets on governance process itself. Should we use futarchy? Self-referential improvement.

## Use Cases

1. **Protocol Parameter Change**
   - Proposal: Increase fee from 0.3% to 0.5%
   - Markets predict protocol token price under each scenario
   - Higher expected price wins
   - Data-driven fee optimization

2. **Treasury Allocation**
   - Proposal: Spend $1M on marketing vs. development
   - Markets predict impact on protocol metrics
   - Allocation based on predicted ROI
   - Informed capital deployment

3. **Partnership Decision**
   - Proposal: Integrate with Protocol X
   - Markets predict value of integration
   - Compare to status quo prediction
   - Evidence-based partnership selection

4. **Emergency Response**
   - Security vulnerability discovered
   - Markets quickly aggregate expert opinion
   - Fast decision with informed participants
   - Rapid response with market validation


## Real-World Products & User Experience

See: [../../product/i-off-chain/i7-futarchy-products.md](../../product/i-off-chain/i7-futarchy-products.md)

---

[Back to Index](../../README.md)
