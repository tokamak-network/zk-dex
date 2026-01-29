# D7. Snapshot Voting

Vote based on token balance at specific historical block, preventing last-minute vote manipulation.

**Constraints**: ~200K | **Complexity**: Medium

---

## Background

Snapshot voting ensures fair voting power calculation:

- **Manipulation Prevention**: Voting based on current balance enables last-minute token purchases to sway outcomes
- **Flash-Loan Resistance**: Historical snapshots cannot be affected by single-block token borrowing
- **Predictable Voting Power**: Voters know their power in advance; no gaming during voting period
- **Fair Baseline**: All voters measured at same point in time

Current-balance voting is vulnerable to whales buying tokens just before close, voting, then selling. Snapshot voting fixes the voting power at proposal creation, eliminating these manipulation vectors while providing a fair and predictable governance process.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `voteCommitment` | field | Commitment to vote choice |
| `proposalId` | uint | Identifier of the proposal |
| `snapshotBlock` | uint | Block number for balance snapshot |
| `historicalRoot` | field | Merkle root of notes at snapshot block |
| `voteNullifier` | field | Nullifier to prevent double-voting |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | Voter's public key |
| `sk` | field | Secret key proving ownership |
| `noteHash` | field | Hash of governance token note |
| `noteValue` | uint | Token balance at snapshot |
| `noteSalt` | field | Note randomness |
| `choice` | uint | Vote choice (0 = against, 1 = for) |
| `voteSalt` | field | Vote commitment randomness |
| `merklePath[20]` | field[] | Merkle proof in historical tree |
| `merkleIndex` | uint | Position in historical tree |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template SnapshotVoting(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input voteCommitment;
    signal input proposalId;
    signal input snapshotBlock;
    signal input historicalRoot;
    signal input voteNullifier;

    // ===== Private Inputs =====
    signal input pkX, pkY, sk;
    signal input noteHash;
    signal input noteValue;
    signal input noteSalt;
    signal input choice;
    signal input voteSalt;
    signal input merklePath[TREE_DEPTH];
    signal input merkleIndex;

    // ===== 1. Verify Governance Token Note =====
    component note = PoseidonRegularNote();
    note.pkX <== pkX;
    note.pkY <== pkY;
    note.value <== noteValue;
    note.tokenType <== 0;  // Governance token
    note.salt <== noteSalt;
    note.out === noteHash;

    // ===== 2. Verify Note in Historical Merkle Tree =====
    component merkle = MerkleProof(TREE_DEPTH);
    merkle.leaf <== noteHash;
    merkle.root <== historicalRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path[i] <== merklePath[i];
    }
    merkle.index <== merkleIndex;

    // ===== 3. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sk;
    ownership.pkX <== pkX;
    ownership.pkY <== pkY;

    // ===== 4. Compute Vote Nullifier =====
    // Prevents double-voting: unique per (voter, proposal)
    component nullifier = Poseidon(3);
    nullifier.inputs[0] <== sk;
    nullifier.inputs[1] <== proposalId;
    nullifier.inputs[2] <== snapshotBlock;
    nullifier.out === voteNullifier;

    // ===== 5. Validate Choice =====
    choice * (1 - choice) === 0;

    // ===== 6. Validate Positive Balance =====
    component balancePositive = GreaterThan(64);
    balancePositive.in[0] <== noteValue;
    balancePositive.in[1] <== 0;
    balancePositive.out === 1;

    // ===== 7. Create Vote Commitment =====
    component commit = Poseidon(4);
    commit.inputs[0] <== choice;
    commit.inputs[1] <== noteValue;  // Voting power
    commit.inputs[2] <== proposalId;
    commit.inputs[3] <== voteSalt;
    commit.out === voteCommitment;
}

component main {public [voteCommitment, proposalId, snapshotBlock, historicalRoot, voteNullifier]} =
    SnapshotVoting(20);
```

### Key Constraints

1. **Note Authenticity**: Note hash computed from voter keys, value, and salt
2. **Historical Inclusion**: Note must exist in merkle tree at snapshot block
3. **Ownership Verification**: Secret key proves note ownership
4. **Double-Vote Prevention**: Nullifier unique per voter and proposal
5. **Valid Choice**: Binary vote (0 or 1)

## Effects

| Aspect | Impact |
|--------|--------|
| **Manipulation Resistance** | Cannot buy votes after snapshot |
| **Flash-Loan Immunity** | Single-block borrows have no effect |
| **Predictable Power** | Voting power known before voting begins |
| **Fair Measurement** | All voters measured at identical time |
| **Historical Proof** | Cryptographic verification of past state |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Snapshot Timing Attack** | Snapshot block should be in past when proposal created |
| **Historical Root Forgery** | Root must be committed on-chain at snapshot block |
| **Block Reorg** | Use sufficiently deep snapshot (50+ confirmations) |
| **Multi-Note Voting** | Each note has separate nullifier; aggregate power correctly |
| **Stale Voting Power** | Consider snapshot age limits for long voting periods |
| **Root Storage Cost** | Archive historical roots efficiently; prune old data |

## Implementation Challenges

1. **Historical State Storage**
   - Need merkle roots for every block (or periodic snapshots)
   - Storage costs for long history
   - Consider epoch-based snapshots (every N blocks)

2. **Snapshot Selection**
   - When is snapshot block chosen? (proposal creation, delay period)
   - Balance between manipulation resistance and voter convenience
   - Handle block reorgs affecting snapshot

3. **Multi-Note Aggregation**
   - Users with multiple notes need multiple proofs
   - Aggregate voting power across all owned notes
   - Gas costs scale with note count

4. **Cross-Chain Snapshots**
   - Tokens may exist on multiple chains
   - Need unified snapshot across all deployments
   - Bridge message latency complicates synchronization

## Derivatives

1. **Rolling Snapshots** - Multiple snapshots over time period, voting power is average of balances. Smooths out manipulation attempts. Requires storing multiple historical roots and aggregating proofs.

2. **Time-Weighted Snapshots** - Balance weighted by holding duration at snapshot. Recent acquisitions count less than long-held tokens. Rewards long-term holders without full conviction voting complexity.

3. **Multi-Block Average** - Snapshot is average balance across N blocks before proposal. Single-block manipulation ineffective. More manipulation resistant but higher proof complexity.

4. **Cross-Chain Snapshots** - Unified voting power from tokens on multiple chains. Merkle roots from each chain aggregated. Enables governance across fragmented token supply.

5. **Snapshot Dispute Resolution** - Challenge mechanism for incorrect snapshots. Challenger posts bond; if snapshot wrong, receives reward. Adds economic security to snapshot integrity.

## Use Cases

1. **DAO Governance Proposal**
   - Proposal created at block 1,000,000
   - Snapshot taken at block 999,900 (100 blocks prior)
   - Voting opens for 7 days
   - Token purchases after block 999,900 have no voting effect
   - Final tally reflects committed community members

2. **Token Migration Vote**
   - Community votes on token upgrade
   - Snapshot ensures only existing holders vote
   - New buyers during voting period cannot influence outcome
   - Migration decision made by pre-existing stakeholders

3. **Emergency Protocol Action**
   - Security issue discovered
   - Expedited proposal with recent snapshot
   - Shorter delay acceptable for emergencies
   - Still protected against flash-loan attacks
   - Quick response without sacrificing security

4. **Airdrop Eligibility**
   - New token launching with governance
   - Snapshot of existing protocol users
   - Voting power based on historical participation
   - Cannot game eligibility after announcement
   - Fair distribution to genuine users

## Real-World Products & User Experience

See: [Snapshot Voting Products & UX](../../product/d-governance/d7-snapshot-products.md)

---

[Back to Index](../../README.md)
