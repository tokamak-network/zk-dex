# D1. Private Voting

Commit-reveal voting with hidden choices, preventing vote buying and coercion while maintaining verifiable voting power.

**Constraints**: ~150K | **Complexity**: Low

---

## Background

Private voting is essential for legitimate governance:

- **Anti-Coercion**: Public votes enable vote buying, bribery, and social pressure; hidden ballots protect voter autonomy
- **Honest Preference Expression**: Voters reveal true preferences when choices cannot be observed or punished
- **Governance Integrity**: Prevents last-minute vote manipulation based on observing others' choices
- **Democratic Standards**: Secret ballot is a fundamental principle in democratic elections worldwide

In traditional governance systems, secret ballots are standard practice. On-chain governance typically exposes all votes publicly, enabling sophisticated vote buying schemes. ZK private voting achieves the privacy properties of physical ballot boxes with the verifiability of blockchain systems.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `voteCommitment` | field | Hash commitment to vote choice and salt |
| `proposalId` | uint | Identifier of the proposal being voted on |
| `votingPower` | uint | Voting power being exercised (revealed) |
| `merkleRoot` | field | Snapshot merkle root of eligible voters |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | Voter's public key |
| `sk` | field | Secret key proving ownership |
| `noteHash` | field | Hash of governance token note |
| `noteValue` | uint | Token balance (must equal votingPower) |
| `noteSalt` | field | Note randomness |
| `choice` | uint | Vote choice (0 = against, 1 = for, 2 = abstain) |
| `voteSalt` | field | Randomness for vote commitment |
| `merklePath[20]` | field[] | Merkle proof of note inclusion |
| `merkleIndex` | uint | Position in merkle tree |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template PrivateVoting(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input voteCommitment;
    signal input proposalId;
    signal input votingPower;
    signal input merkleRoot;

    // ===== Private Inputs =====
    signal input pkX, pkY, sk;
    signal input noteHash, noteValue, noteSalt;
    signal input choice, voteSalt;
    signal input merklePath[TREE_DEPTH];
    signal input merkleIndex;

    // ===== 1. Verify Governance Token Note =====
    component note = PoseidonRegularNote();
    note.pkX <== pkX;
    note.pkY <== pkY;
    note.value <== noteValue;
    note.tokenType <== 0;  // Governance token type
    note.salt <== noteSalt;
    note.out === noteHash;

    // ===== 2. Verify Note Inclusion in Snapshot =====
    component merkle = MerkleProof(TREE_DEPTH);
    merkle.leaf <== noteHash;
    merkle.root <== merkleRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path[i] <== merklePath[i];
    }
    merkle.index <== merkleIndex;

    // ===== 3. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sk;
    ownership.pkX <== pkX;
    ownership.pkY <== pkY;

    // ===== 4. Voting Power Equals Note Value =====
    votingPower === noteValue;

    // ===== 5. Validate Choice (0, 1, or 2) =====
    component choiceValid = LessThan(8);
    choiceValid.in[0] <== choice;
    choiceValid.in[1] <== 3;
    choiceValid.out === 1;

    // ===== 6. Create Vote Commitment =====
    // Commitment includes proposalId to prevent cross-proposal replay
    component commit = Poseidon(4);
    commit.inputs[0] <== choice;
    commit.inputs[1] <== votingPower;
    commit.inputs[2] <== proposalId;
    commit.inputs[3] <== voteSalt;
    commit.out === voteCommitment;
}

component main {public [voteCommitment, proposalId, votingPower, merkleRoot]} =
    PrivateVoting(20);
```

### Key Constraints

1. **Token Ownership**: Voter must own governance tokens proven via note hash and merkle inclusion
2. **Snapshot Validity**: Note must exist in the historical merkle tree at snapshot time
3. **Voting Power Accuracy**: Declared voting power must exactly match note value
4. **Valid Choice**: Vote choice must be within allowed range (0, 1, or 2)
5. **Commitment Binding**: Vote commitment cryptographically binds choice to voter and proposal

## Effects

| Aspect | Impact |
|--------|--------|
| **Vote Privacy** | Choice hidden until reveal phase; observers cannot determine individual votes |
| **Anti-Coercion** | Voters cannot prove their vote to potential bribers or coercers |
| **Governance Integrity** | Prevents strategic voting based on observing others' choices |
| **Verifiable Participation** | Voting power publicly verifiable without revealing choice |
| **Double-Vote Prevention** | Nullifier system prevents same tokens from voting twice |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Vote Buying via Receipts** | Commitment scheme ensures voters cannot prove their choice to buyers |
| **Double Voting** | Nullifier derived from note + proposalId prevents reuse |
| **Reveal Phase Manipulation** | Time-locked reveal phase; unrevealed votes can be defaulted |
| **Snapshot Manipulation** | Use block hash from distant past; merkle root committed on-chain |
| **Coerced Key Disclosure** | Consider supporting decoy votes or key rotation mechanisms |
| **Front-running Reveals** | Batch reveal in single transaction or commit-reveal on reveal too |

## Implementation Challenges

1. **Reveal Coordination**
   - All voters must reveal within time window for tally
   - Unrevealed votes complicate final counts
   - Consider economic incentives for timely reveals (deposit returned on reveal)

2. **Snapshot Infrastructure**
   - Need reliable historical merkle tree construction
   - Storage of historical roots on-chain
   - Efficient proof generation for users with many notes

3. **Nullifier Management**
   - Unique nullifier per voter per proposal
   - Nullifier = hash(sk, proposalId) to prevent linkage across proposals
   - Nullifier registry must be checked efficiently

4. **Vote Tallying**
   - Reveal phase collects all votes for counting
   - Need secure aggregation mechanism
   - Consider on-chain vs. off-chain tallying tradeoffs

## Derivatives

1. **Shielded Vote Tallying** - Aggregate votes are computed without revealing individual choices using homomorphic commitments or MPC. Final tally is proven correct via ZK proof over all commitments. Enables privacy even after voting ends.

2. **Anti-Bribery Voting** - Extended scheme where voters can generate fake receipts that are indistinguishable from real ones. Potential bribers cannot verify payment, making bribery economically irrational.

3. **Multi-Round Voting** - Sequential voting rounds where results from earlier rounds inform later choices. Each round uses fresh commitments. Useful for runoff elections or iterative consensus building.

4. **Emergency Voting** - Shortened commit-reveal cycle for time-sensitive proposals. Higher quorum requirements compensate for reduced deliberation time. Automatic reveal after emergency period.

5. **Weighted Private Voting** - Voting power derived from multiple factors (tokens, reputation, tenure) computed privately. ZK proof demonstrates correct weight calculation without revealing component values.

## Use Cases

1. **Protocol Parameter Changes**
   - DAO proposes fee adjustment from 0.3% to 0.25%
   - Token holders vote privately over 7-day period
   - Whales cannot signal to influence smaller holders
   - Reveal phase aggregates votes for transparent final count

2. **Treasury Grant Allocation**
   - Multiple project proposals compete for funding
   - Private voting prevents coordination attacks
   - Projects cannot see vote counts until reveal
   - Fairer evaluation without bandwagon effects

3. **Contentious Governance Decisions**
   - Community debates controversial protocol change
   - Vocal minority cannot identify and pressure opposing voters
   - True community sentiment emerges without social pressure
   - Results legitimized by verified participation

4. **Board Elections**
   - DAO elects council members from candidate pool
   - Private voting prevents vote trading between candidates
   - Each token holder votes for preferred candidates
   - Winners determined after simultaneous reveal

## Real-World Products & User Experience

See: [Private Voting Products & UX](../../product/d-governance/d1-private-voting-products.md)

---

[Back to Index](../../README.md)
