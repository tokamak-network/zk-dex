# I9. Optimistic Governance

Governance mechanism where proposals execute automatically unless challenged, reducing overhead for uncontroversial decisions.

**Requirements**: Challenge mechanism | Time-lock windows | Guardian system | Escalation procedures

---

## Background

Traditional governance has significant friction:

- **Voting Overhead**: Every proposal requires active participation
- **Decision Latency**: Waiting for quorum delays routine changes
- **Voter Fatigue**: Constant voting leads to disengagement
- **Opportunity Cost**: Time spent voting on obvious decisions

Optimistic governance addresses these by:
- Assuming proposals pass unless challenged
- Requiring active opposition rather than active approval
- Enabling fast execution of uncontroversial changes
- Preserving full deliberation for contested decisions

For ZK-DEX, this enables efficient governance while maintaining security through challenge mechanisms.

## Technical Specification

### Architecture Overview

```
Proposal                      Challenge Window                   Execution
+-----------+                 +------------------------+         +-----------+
|           |                 |                        |         |           |
| Submit    |  Start Timer    |  No Challenge          |         | Execute   |
| Proposal  |---------------->|  (7 days)              |-------->| Proposal  |
|           |                 |                        |         |           |
+-----------+                 +------------------------+         +-----------+
                                       |
                                       | Challenge!
                                       v
                              +------------------------+
                              |                        |
                              |  Full Governance Vote  |
                              |  (standard process)    |
                              |                        |
                              +------------------------+
                                       |
                              +--------+--------+
                              |                 |
                              v                 v
                        +---------+       +---------+
                        | Execute |       | Reject  |
                        +---------+       +---------+
```

### Component List

| Component | Description |
|-----------|-------------|
| **Proposal Queue** | Holds proposals during challenge window |
| **Challenge Contract** | Accepts and validates challenges |
| **Timer Oracle** | Tracks challenge window expiration |
| **Escalation Engine** | Routes challenged proposals to full vote |
| **Guardian System** | Authorized challengers for security issues |
| **Execution Module** | Executes passed proposals automatically |

### Data Flows

1. **Proposal Submission**
   - Proposer submits with bond
   - Challenge window begins (e.g., 7 days)
   - Proposal visible to all stakeholders

2. **Challenge Window**
   - If no challenge: proposal queued for execution
   - If challenged: escalates to full governance vote
   - Challenger must stake bond

3. **Resolution**
   - Unchallenged: auto-execute after window
   - Challenged + passes vote: execute; slash challenger
   - Challenged + fails vote: reject; slash proposer

### Optimistic Governance Circuit

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/comparators.circom";

template OptimisticChallenge() {
    // Public inputs
    signal input proposalHash;        // Hash of proposal
    signal input challengeCommitment; // Commitment to challenge
    signal input windowEnd;           // Challenge window end time
    signal input currentTime;         // Current timestamp

    // Private inputs
    signal input challenger;          // Challenger identity (hidden)
    signal input challengeBond;       // Bond amount
    signal input reason;              // Challenge reason code
    signal input salt;

    // Verify challenge commitment
    component chalHash = Poseidon(5);
    chalHash.inputs[0] <== proposalHash;
    chalHash.inputs[1] <== challenger;
    chalHash.inputs[2] <== challengeBond;
    chalHash.inputs[3] <== reason;
    chalHash.inputs[4] <== salt;
    chalHash.out === challengeCommitment;

    // Verify challenge within window
    component timeCheck = LessThan(64);
    timeCheck.in[0] <== currentTime;
    timeCheck.in[1] <== windowEnd;
    timeCheck.out === 1;

    // Verify minimum bond
    component bondCheck = GreaterEqThan(64);
    bondCheck.in[0] <== challengeBond;
    bondCheck.in[1] <== 1000;  // Minimum bond
    bondCheck.out === 1;
}

component main {public [proposalHash, challengeCommitment, windowEnd, currentTime]} = OptimisticChallenge();
```

## Effects

| Aspect | Impact |
|--------|--------|
| **Efficiency** | Uncontroversial proposals execute without voting |
| **Latency** | Faster execution for routine changes |
| **Participation** | Only contested issues require active voting |
| **Security** | Challenge mechanism prevents bad proposals |
| **Cost Reduction** | Less gas spent on routine governance |
| **Attention Allocation** | Focus on proposals that matter |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Malicious Proposals** | Bond requirements; guardian oversight |
| **Challenge Griefing** | Challenger bonds; slashing for frivolous challenges |
| **Time Zone Attacks** | Long challenge windows; global notification |
| **Collusion** | Multiple guardian classes; community oversight |
| **Emergency Bypass** | Emergency pause capability; security council |
| **Proposal Spam** | Increasing bonds for frequent proposers |

## Implementation Challenges

1. **Window Duration**
   - Too short: insufficient review time
   - Too long: unnecessary delays
   - Consider proposal-type-specific windows

2. **Bond Calibration**
   - Too low: spam and griefing
   - Too high: barriers to participation
   - Dynamic bonds based on proposal impact

3. **Guardian Selection**
   - Who can challenge?
   - Balance between access and spam prevention
   - Consider tiered challenge rights

4. **Notification Systems**
   - Stakeholders must learn of proposals
   - Can't challenge what you don't know
   - Multi-channel notification essential

5. **Emergency Procedures**
   - Some decisions can't wait for window
   - Need emergency fast-track with safeguards
   - Clear criteria for emergency status

## Derivatives

1. **Challenge Period** - Configurable window for different proposal types. Security changes: 14 days. Parameter tweaks: 3 days. Urgency-based acceleration.

2. **Guardian Systems** - Designated entities with enhanced challenge rights. Security council, core team, elected representatives. Multiple guardian classes for different concerns.

3. **Escalation Procedures** - Clear path from challenge to resolution. Defined timelines for each stage. Automatic progression if no action.

4. **Time-Locked Execution** - Even after window, execution delayed. Additional safety buffer. Allows last-resort intervention.

5. **Emergency Vetoes** - Fast-track rejection for critical issues. Requires high-reputation challenger. Immediate pause; vote to confirm.

## Use Cases

1. **Routine Parameter Update**
   - Proposal: Update oracle address to new version
   - Low risk, well-understood change
   - No challenges during window
   - Auto-executes after 7 days

2. **Controversial Treasury Spend**
   - Proposal: Large marketing expenditure
   - Community member challenges
   - Full governance vote triggered
   - Deliberation on contested issue

3. **Emergency Security Patch**
   - Critical vulnerability discovered
   - Guardian invokes emergency track
   - Shortened window (24 hours)
   - Fast execution with oversight

4. **Malicious Proposal Blocked**
   - Attacker submits harmful proposal
   - Guardian immediately challenges
   - Full vote rejects proposal
   - Proposer bond slashed


## Real-World Products & User Experience

See: [../../../product/i-off-chain/i9-optimistic-gov-products.md](../../../product/i-off-chain/i9-optimistic-gov-products.md)

---

[Back to Index](../../README.md)
