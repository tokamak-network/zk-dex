# D4. Delegated Voting

Transfer voting power to trusted delegates while maintaining privacy of delegation relationships.

**Constraints**: ~160K | **Complexity**: Low

---

## Background

Delegated voting enables effective governance participation:

- **Expertise Scaling**: Most token holders lack time or knowledge to evaluate every proposal
- **Participation Without Engagement**: Passive holders can contribute through active delegates
- **Representative Democracy**: Delegates specialize in governance, improving decision quality
- **Privacy Preservation**: Delegation relationships can be hidden to prevent influence trading

In DAOs, voter participation is typically low (often <10%). Delegation allows passive holders to empower knowledgeable community members. Privacy-preserving delegation hides who delegated to whom, preventing social pressure and delegation markets.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `delegationHash` | field | Hash commitment to delegation details |
| `voteCommitment` | field | Commitment to vote choice |
| `proposalId` | uint | Identifier of the proposal being voted on |
| `votingPower` | uint | Voting power being exercised |
| `delegationRoot` | field | Merkle root of valid delegations |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `delegatorPkX, delegatorPkY` | field | Original token holder's public key |
| `delegatePkX, delegatePkY` | field | Delegate's public key |
| `delegateSk` | field | Delegate's secret key (proves delegate identity) |
| `delegatedPower` | uint | Amount of voting power delegated |
| `expiry` | uint | Delegation expiration timestamp |
| `delegationSalt` | field | Delegation note randomness |
| `choice` | uint | Vote choice (0 = against, 1 = for) |
| `voteSalt` | field | Vote commitment randomness |
| `currentTime` | uint | Current timestamp for expiry check |
| `merklePath[20]` | field[] | Merkle proof of delegation |
| `merkleIndex` | uint | Position in delegation tree |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template DelegatedVoting(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input delegationHash;
    signal input voteCommitment;
    signal input proposalId;
    signal input votingPower;
    signal input delegationRoot;

    // ===== Private Inputs =====
    signal input delegatorPkX, delegatorPkY;
    signal input delegatePkX, delegatePkY, delegateSk;
    signal input delegatedPower;
    signal input expiry;
    signal input delegationSalt;
    signal input choice, voteSalt;
    signal input currentTime;
    signal input merklePath[TREE_DEPTH];
    signal input merkleIndex;

    // ===== 1. Verify Delegation Commitment =====
    component delegation = Poseidon(7);
    delegation.inputs[0] <== delegatorPkX;
    delegation.inputs[1] <== delegatorPkY;
    delegation.inputs[2] <== delegatePkX;
    delegation.inputs[3] <== delegatePkY;
    delegation.inputs[4] <== delegatedPower;
    delegation.inputs[5] <== expiry;
    delegation.inputs[6] <== delegationSalt;
    delegation.out === delegationHash;

    // ===== 2. Verify Delegation Inclusion in Tree =====
    component merkle = MerkleProof(TREE_DEPTH);
    merkle.leaf <== delegationHash;
    merkle.root <== delegationRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path[i] <== merklePath[i];
    }
    merkle.index <== merkleIndex;

    // ===== 3. Verify Delegate Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== delegateSk;
    ownership.pkX <== delegatePkX;
    ownership.pkY <== delegatePkY;

    // ===== 4. Verify Delegation Not Expired =====
    component expiryCheck = LessThan(64);
    expiryCheck.in[0] <== currentTime;
    expiryCheck.in[1] <== expiry;
    expiryCheck.out === 1;

    // ===== 5. Voting Power Matches Delegation =====
    votingPower === delegatedPower;

    // ===== 6. Validate Choice (0 or 1) =====
    choice * (1 - choice) === 0;

    // ===== 7. Create Vote Commitment =====
    component commit = Poseidon(4);
    commit.inputs[0] <== choice;
    commit.inputs[1] <== votingPower;
    commit.inputs[2] <== proposalId;
    commit.inputs[3] <== voteSalt;
    commit.out === voteCommitment;
}

component main {public [delegationHash, voteCommitment, proposalId, votingPower, delegationRoot]} =
    DelegatedVoting(20);
```

### Key Constraints

1. **Delegation Authenticity**: Delegation hash binds delegator, delegate, power, and expiry
2. **Delegation Validity**: Must exist in merkle tree of active delegations
3. **Delegate Authorization**: Only delegate's secret key can exercise the delegation
4. **Temporal Validity**: Delegation must not be expired
5. **Power Accuracy**: Voting power exactly matches delegated amount

## Effects

| Aspect | Impact |
|--------|--------|
| **Participation Rate** | Passive holders contribute through active delegates |
| **Decision Quality** | Specialized delegates improve governance outcomes |
| **Delegation Privacy** | Relationships hidden; prevents influence trading |
| **Flexibility** | Delegations can be changed between proposals |
| **Accountability** | Delegates build reputations through voting records |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Delegation Selling** | Privacy prevents proving delegation; economic incentives unclear |
| **Delegate Collusion** | Limit maximum delegation per delegate; diversity requirements |
| **Expiry Manipulation** | Expiry timestamp must be in the future at delegation creation |
| **Revocation Delay** | Consider instant revocation via nullifier set |
| **Stale Delegations** | Require periodic renewal; automatic expiry |
| **Double Voting** | Nullifier per (delegator, proposal) prevents delegator and delegate both voting |

## Implementation Challenges

1. **Delegation Creation**
   - Delegator signs delegation commitment off-chain
   - Delegation added to on-chain merkle tree
   - Need efficient delegation tree updates

2. **Revocation Mechanism**
   - Delegator should be able to revoke anytime
   - Add nullifier to invalidate delegation
   - Handle in-flight votes during revocation

3. **Multiple Delegations**
   - User may want to split power across delegates
   - Or delegate for different proposal types
   - Need sum-check to prevent over-delegation

4. **Delegate Discovery**
   - How do delegators find qualified delegates?
   - Delegate registry with voting history
   - Reputation systems for delegate quality

## Derivatives

1. **Liquid Democracy** - Delegates can re-delegate to other delegates, creating delegation chains. Power flows transitively through the network. Enables expertise hierarchies while maintaining final accountability.

2. **Partial Delegation** - Split voting power across multiple delegates (e.g., 50% to delegate A, 30% to B, 20% retained). ZK proof shows total delegation doesn't exceed available power. Enables portfolio approach to governance.

3. **Topic-Specific Delegation** - Different delegates for different proposal categories (treasury, technical, partnerships). Circuit checks proposal type matches delegation scope. Enables specialized representation.

4. **Time-Limited Delegation** - Delegations auto-expire after specified period (e.g., 30 days). Requires periodic renewal to maintain. Prevents zombie delegations and ensures ongoing delegator consent.

5. **Revocable Instant Delegation** - Delegator can revoke delegation at any time, even mid-voting period. Revocation adds nullifier that invalidates any pending votes. Balances delegate autonomy with delegator control.

## Use Cases

1. **Technical Governance**
   - Protocol upgrade proposals require deep technical expertise
   - Average token holder delegates to respected developers
   - Developer delegates vote on technical merits
   - Delegation privacy prevents influence campaigns targeting delegates

2. **Institutional Delegation**
   - Fund holds governance tokens across many protocols
   - Delegates to specialized governance service providers
   - Provider votes according to fund's policy guidelines
   - Delegation relationship remains confidential

3. **Community Representative**
   - Geographic or linguistic community pools delegation
   - Community leader represents shared interests
   - Delegation tracked privately to prevent targeting
   - Leader's voting record publicly auditable

4. **Expertise-Based Voting**
   - Security researcher known for protocol analysis
   - Community members delegate for security proposals
   - Researcher evaluates and votes on audit-related decisions
   - Reputation built through consistent quality voting

## Real-World Products & User Experience

See: [Delegated Voting Products & UX](../../product/d-governance/d4-delegated-products.md)

---

[Back to Index](../../README.md)
