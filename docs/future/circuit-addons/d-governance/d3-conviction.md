# D3. Conviction Voting

Votes accumulate power over time, rewarding long-term commitment and preventing flash-loan governance attacks.

**Constraints**: ~130K | **Complexity**: Low

---

## Background

Conviction voting aligns governance with long-term stakeholders:

- **Time Commitment Matters**: Snapshot voting treats day-traders and long-term holders equally
- **Flash-Loan Resistance**: Borrowed tokens for single-block attacks cannot accumulate conviction
- **Continuous Signaling**: Preferences can be updated anytime without discrete voting periods
- **Patient Capital Alignment**: Rewards sustained engagement over opportunistic participation

Traditional governance uses point-in-time snapshots, enabling manipulation through temporary token accumulation. Conviction voting accumulates voting power over staking duration, making votes from persistent supporters more valuable than drive-by participants.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `stakeHash` | field | Hash commitment to stake details |
| `proposalId` | uint | Identifier of the proposal being supported |
| `convictionPower` | uint | Calculated conviction (amount * time) |
| `currentTime` | uint | Current timestamp for time calculation |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | Staker's public key |
| `sk` | field | Secret key proving ownership |
| `stakeAmount` | uint | Amount of tokens staked |
| `stakeTime` | uint | Timestamp when stake was created |
| `stakeSalt` | field | Stake note randomness |
| `proposalStartTime` | uint | When proposal voting began |
| `maxConviction` | uint | Cap on conviction accumulation |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template ConvictionVoting() {
    // ===== Public Inputs =====
    signal input stakeHash;
    signal input proposalId;
    signal input convictionPower;
    signal input currentTime;

    // ===== Private Inputs =====
    signal input pkX, pkY, sk;
    signal input stakeAmount;
    signal input stakeTime;
    signal input stakeSalt;
    signal input proposalStartTime;
    signal input maxConviction;

    // ===== 1. Verify Stake Commitment =====
    component stake = Poseidon(5);
    stake.inputs[0] <== pkX;
    stake.inputs[1] <== pkY;
    stake.inputs[2] <== stakeAmount;
    stake.inputs[3] <== stakeTime;
    stake.inputs[4] <== stakeSalt;
    stake.out === stakeHash;

    // ===== 2. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sk;
    ownership.pkX <== pkX;
    ownership.pkY <== pkY;

    // ===== 3. Stake Must Predate Current Time =====
    component timeCheck = LessThan(64);
    timeCheck.in[0] <== stakeTime;
    timeCheck.in[1] <== currentTime;
    timeCheck.out === 1;

    // ===== 4. Calculate Effective Stake Duration =====
    // Duration counts from max(stakeTime, proposalStartTime)
    signal effectiveStartTime;
    component startTimeSelector = GreaterThan(64);
    startTimeSelector.in[0] <== stakeTime;
    startTimeSelector.in[1] <== proposalStartTime;

    // If stakeTime > proposalStartTime, use stakeTime; else use proposalStartTime
    effectiveStartTime <== stakeTime * startTimeSelector.out +
                           proposalStartTime * (1 - startTimeSelector.out);

    signal timeStaked;
    timeStaked <== currentTime - effectiveStartTime;

    // ===== 5. Calculate Raw Conviction =====
    signal rawConviction;
    rawConviction <== stakeAmount * timeStaked;

    // ===== 6. Apply Conviction Cap =====
    component capCheck = LessThan(128);
    capCheck.in[0] <== rawConviction;
    capCheck.in[1] <== maxConviction + 1;

    // If raw < max, use raw; else use max
    signal cappedConviction;
    cappedConviction <== rawConviction * capCheck.out +
                         maxConviction * (1 - capCheck.out);

    // ===== 7. Verify Conviction Power =====
    convictionPower === cappedConviction;

    // ===== 8. Ensure Positive Values =====
    component amountPositive = GreaterThan(64);
    amountPositive.in[0] <== stakeAmount;
    amountPositive.in[1] <== 0;
    amountPositive.out === 1;
}

component main {public [stakeHash, proposalId, convictionPower, currentTime]} =
    ConvictionVoting();
```

### Key Constraints

1. **Stake Authenticity**: Stake hash computed from owner keys, amount, time, and salt
2. **Ownership Verification**: Secret key proves stake ownership
3. **Temporal Validity**: Stake must exist before current time
4. **Conviction Calculation**: Power = amount * time with optional cap
5. **Duration Fairness**: Only counts time from proposal start (prevents pre-staking advantage)

## Effects

| Aspect | Impact |
|--------|--------|
| **Long-Term Alignment** | Rewards sustained commitment over token accumulation |
| **Flash-Loan Immunity** | Single-block attacks have zero conviction |
| **Continuous Governance** | No discrete voting periods; conviction accumulates continuously |
| **Sybil Resistance** | Splitting tokens across accounts doesn't increase total conviction |
| **Attack Cost Increase** | Maintaining attack position requires sustained capital lock |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Timestamp Manipulation** | Use block timestamp from on-chain source; multi-block average |
| **Pre-Staking Attacks** | Conviction only counts from proposal creation time |
| **Conviction Overflow** | Cap maximum conviction per stake; use 128-bit arithmetic |
| **Stake Splitting** | Total conviction same regardless of split (linear function) |
| **Rapid Unstake** | Implement cooldown period; conviction decays gradually |
| **Old Stake Dominance** | Consider conviction decay or periodic reset mechanisms |

## Implementation Challenges

1. **Continuous Conviction Tracking**
   - Off-chain indexer computes current conviction for each stake
   - On-chain verification of conviction at proof submission time
   - Need efficient data structures for conviction queries

2. **Decay Mechanisms**
   - Simple linear accumulation may over-reward ancient stakes
   - Consider logarithmic growth or periodic decay
   - Balance between long-term rewards and governance responsiveness

3. **Proposal Lifecycle**
   - Continuous voting means proposals need explicit end conditions
   - Threshold-based execution when conviction exceeds quorum
   - Handle proposal cancellation and stake release

4. **Stake Liquidity**
   - Staked tokens may need to remain locked for conviction
   - Consider conviction-preserving transfers or delegation
   - Balance between commitment and capital efficiency

## Derivatives

1. **Decay-Adjusted Conviction** - Conviction grows with diminishing returns using logarithmic or square root functions. Prevents ancient stakes from dominating while still rewarding long-term commitment. Implements formula like: conviction = amount * sqrt(time).

2. **Multi-Asset Conviction** - Accumulate conviction across multiple tokens (governance token, LP tokens, staked derivatives). Weights different asset types differently. Rewards diverse protocol engagement beyond single-token holding.

3. **Conviction Lending** - Delegate conviction power to others while retaining stake ownership. Enables conviction markets where active governance participants can borrow conviction from passive holders.

4. **Conviction-Weighted Rewards** - Protocol rewards (fee shares, emissions) distributed proportionally to conviction rather than token balance. Creates compound incentive for long-term staking and governance participation.

5. **Threshold Conviction** - Proposals execute automatically when accumulated conviction crosses threshold. No discrete voting periods needed. Conviction can be withdrawn, reducing proposal support. Creates continuous, real-time governance.

## Use Cases

1. **Continuous Funding Proposals**
   - Project requests ongoing treasury funding
   - Community members stake tokens toward proposal
   - When conviction threshold reached, funding activates
   - If support wanes, conviction drops and funding pauses
   - Creates dynamic, responsive resource allocation

2. **Protocol Parameter Tuning**
   - Community wants to adjust fee from 0.3% to 0.25%
   - Parameter change proposal created
   - Long-term holders accumulate conviction over weeks
   - Change executes when conviction sufficient
   - Flash-loan attacks impossible due to time requirement

3. **Grant Committee Elections**
   - Multiple candidates for committee seats
   - Conviction-based voting over month-long period
   - Candidates with sustained community support win
   - Prevents last-minute vote buying or manipulation
   - Rewards candidates with long-term supporter bases

4. **Emergency vs. Standard Proposals**
   - Standard proposals require high conviction threshold
   - Emergency proposals have lower threshold but require guardian co-signature
   - Time-based conviction prevents rushed malicious proposals
   - Balance between security and governance responsiveness

## Real-World Products & User Experience

See: [Conviction Voting Products & UX](../../../product/d-governance/d3-conviction-products.md)

---

[Back to Index](../../README.md)
