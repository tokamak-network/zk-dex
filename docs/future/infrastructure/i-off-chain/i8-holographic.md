# I8. Holographic Consensus

Governance mechanism using staked predictions on proposal outcomes to boost attention and participation on important decisions.

**Requirements**: Prediction staking | Attention signals | Boosting mechanism | Reputation tracking

---

## Background

DAO governance suffers from chronic low participation:

- **Voter Fatigue**: Too many proposals; not enough attention
- **Information Asymmetry**: Most voters uninformed about technical details
- **Low Stakes**: Individual votes rarely decisive
- **Plutocracy Concerns**: Large holders disproportionately influential

Holographic consensus addresses these by:
- Using prediction stakes to signal proposal importance
- Boosting attention to proposals predicted to pass
- Creating financial incentives for governance participation
- Enabling small stakeholders to escalate important issues

For ZK-DEX, this ensures important governance decisions receive appropriate attention.

## Technical Specification

### Architecture Overview

```
Predictors                    Holographic Layer                  Governance
+-----------+                 +------------------------+         +-----------+
|           |  Stake          |                        |         |           |
| Predictor |---------------->|  Prediction Pool       |         | Voting    |
| (YES)     |                 |  (for proposal X)      |-------->| Contract  |
+-----------+                 |                        |         |           |
|           |  Stake          |  +----------------+    |         +-----------+
| Predictor |---------------->|  | Boost         |    |              |
| (NO)      |                 |  | Threshold     |    |              v
+-----------+                 |  +----------------+    |         +-----------+
                              |         |              |         | Proposal  |
                              |         v              |         | Execution |
                              |  If boosted:          |         +-----------+
                              |  - Lower quorum       |
                              |  - Shorter voting     |
                              |  - Higher visibility  |
                              +------------------------+
```

### Component List

| Component | Description |
|-----------|-------------|
| **Prediction Pool** | Collects stakes predicting proposal outcomes |
| **Boost Calculator** | Determines if proposal reaches boost threshold |
| **Reputation System** | Tracks predictor accuracy over time |
| **Attention Signal** | Surfaces boosted proposals prominently |
| **Settlement Engine** | Distributes stakes based on actual outcome |
| **Governance Adapter** | Connects holographic layer to voting |

### Data Flows

1. **Prediction Phase**
   - Proposal submitted to governance
   - Predictors stake on expected outcome (pass/fail)
   - Stakes accumulate in prediction pool

2. **Boost Evaluation**
   - If YES stakes exceed threshold, proposal boosted
   - Boosted proposals get expedited voting
   - Lower quorum requirements for boosted proposals

3. **Settlement**
   - After vote concludes, outcome known
   - Correct predictors receive losing stakes
   - Reputation updated based on accuracy

### Holographic Staking Circuit

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/comparators.circom";

template HolographicStake() {
    // Public inputs
    signal input proposalId;          // Which proposal
    signal input stakeCommitment;     // Commitment to stake
    signal input prediction;          // 1 = YES, 0 = NO (public for aggregation)
    signal input nullifier;

    // Private inputs
    signal input amount;              // Stake amount (hidden)
    signal input staker;              // Staker identity (hidden)
    signal input reputation;          // Current reputation score
    signal input salt;

    // Verify stake commitment
    component stakeHash = Poseidon(5);
    stakeHash.inputs[0] <== proposalId;
    stakeHash.inputs[1] <== amount;
    stakeHash.inputs[2] <== prediction;
    stakeHash.inputs[3] <== staker;
    stakeHash.inputs[4] <== salt;
    stakeHash.out === stakeCommitment;

    // Verify prediction is valid (0 or 1)
    prediction * (1 - prediction) === 0;

    // Verify minimum stake based on reputation
    // Higher reputation allows smaller minimum stakes
    component minStake = LessThan(64);
    signal minRequired;
    minRequired <== 1000 - reputation * 10;  // Simplified
    minStake.in[0] <== minRequired;
    minStake.in[1] <== amount + 1;
    minStake.out === 1;
}

component main {public [proposalId, stakeCommitment, prediction, nullifier]} = HolographicStake();
```

## Effects

| Aspect | Impact |
|--------|--------|
| **Attention Allocation** | Important proposals surface automatically |
| **Participation Incentive** | Financial rewards for governance engagement |
| **Information Revelation** | Prediction markets reveal private information |
| **Small Stakeholder Voice** | Can boost proposals without large holdings |
| **Efficiency** | Non-controversial proposals pass quickly |
| **Quality Filtering** | Bad proposals not boosted; save governance attention |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Stake Manipulation** | Minimum stake periods; gradual unlocking |
| **Griefing Attacks** | Stake costs exceed griefing benefit |
| **Prediction Collusion** | Private staking; distributed timing |
| **Flash Loan Attacks** | Stake lock-up periods |
| **Spam Proposals** | Proposal bonds; curation through predictions |
| **Reputation Gaming** | Long-term reputation; decay over time |

## Implementation Challenges

1. **Boost Threshold Calibration**
   - Too low: everything boosted; defeats purpose
   - Too high: important proposals don't get attention
   - Need adaptive thresholds based on activity

2. **Prediction Accuracy Incentives**
   - Must reward accurate predictions
   - Avoid rewarding obvious predictions
   - Consider confidence-weighted rewards

3. **Quorum Requirements**
   - Boosted proposals need lower quorum
   - How low is safe?
   - Balance efficiency vs. security

4. **Stake Lock-up**
   - Stakes locked until proposal resolves
   - Long proposals tie up capital
   - Consider stake markets for liquidity

5. **Integration with Voting**
   - Holographic layer must integrate with existing governance
   - Backwards compatibility with current proposals
   - Clear handoff between prediction and voting phases

## Derivatives

1. **Attention Mining** - Rewards for surfacing important proposals. Stakers earn reputation and tokens. Creates market for governance attention.

2. **Prediction Staking** - Stake tokens on expected governance outcomes. Correct predictions earn returns. Wrong predictions lose stake.

3. **Consensus Boosting** - Proposals with sufficient positive stakes get boosted. Lower quorum and faster voting. Efficient handling of consensus proposals.

4. **Signal Aggregation** - Combine multiple weak signals for boost decision. Stake amount, predictor reputation, community sentiment. Robust boost criteria.

5. **Reputation Systems** - Track predictor accuracy over time. Higher reputation = lower stake requirements. Meritocratic influence on governance.

## Use Cases

1. **Emergency Security Fix**
   - Critical vulnerability discovered
   - Security researcher stakes heavily on YES
   - Proposal boosted immediately
   - Fast-track voting enables quick fix

2. **Controversial Proposal Filtering**
   - Divisive proposal submitted
   - Predictions split 50/50
   - Not boosted; requires full quorum
   - Controversial decisions get full deliberation

3. **Technical Upgrade**
   - Routine technical improvement proposed
   - Experts stake YES; no significant NO stakes
   - Boosted for expedited approval
   - Efficient handling of non-controversial upgrades

4. **Community Proposal Escalation**
   - Small stakeholder identifies important issue
   - Stakes entire holding on YES prediction
   - Larger holders add stakes, boosting proposal
   - Community voice amplified despite small holdings


## Real-World Products & User Experience

See: [../../product/i-off-chain/i8-holographic-products.md](../../product/i-off-chain/i8-holographic-products.md)

---

[Back to Index](../../README.md)
