# D2. Quadratic Voting

Votes cost quadratically increasing credits, enabling preference intensity expression while limiting plutocratic influence.

**Constraints**: ~140K | **Complexity**: Low

---

## Background

Quadratic voting addresses fundamental governance challenges:

- **Preference Intensity**: One-token-one-vote cannot distinguish between mild preferences and strong convictions
- **Plutocracy Prevention**: Linear voting gives whales disproportionate power over collective decisions
- **Minority Protection**: Small groups with intense preferences deserve voice against apathetic majorities
- **Economic Efficiency**: QV approximates optimal allocation of collective decision-making influence

Traditional voting treats all preferences equally, regardless of intensity. Quadratic voting (where cost = votes^2) allows expressing conviction strength while ensuring diminishing returns for concentrated power. This mechanism has strong theoretical backing from mechanism design literature.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `voteCommitment` | field | Commitment to choice, votes, and credits spent |
| `proposalId` | uint | Identifier of the proposal being voted on |
| `creditsSpent` | uint | Voice credits consumed (revealed for accounting) |
| `creditRoot` | field | Merkle root of credit allocations |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | Voter's public key |
| `sk` | field | Secret key proving ownership |
| `totalCredits` | uint | Voter's available credit balance |
| `numVotes` | uint | Number of votes to cast (cost = numVotes^2) |
| `choice` | uint | Vote direction (0 = against, 1 = for) |
| `voteSalt` | field | Randomness for vote commitment |
| `creditNoteHash` | field | Hash of credit allocation note |
| `creditSalt` | field | Credit note randomness |
| `merklePath[20]` | field[] | Merkle proof of credit allocation |
| `merkleIndex` | uint | Position in credit tree |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template QuadraticVoting(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input voteCommitment;
    signal input proposalId;
    signal input creditsSpent;
    signal input creditRoot;

    // ===== Private Inputs =====
    signal input pkX, pkY, sk;
    signal input totalCredits;
    signal input numVotes;
    signal input choice;
    signal input voteSalt;
    signal input creditNoteHash;
    signal input creditSalt;
    signal input merklePath[TREE_DEPTH];
    signal input merkleIndex;

    // ===== 1. Verify Credit Allocation Note =====
    component creditNote = Poseidon(4);
    creditNote.inputs[0] <== pkX;
    creditNote.inputs[1] <== pkY;
    creditNote.inputs[2] <== totalCredits;
    creditNote.inputs[3] <== creditSalt;
    creditNote.out === creditNoteHash;

    // ===== 2. Verify Credit Inclusion in Tree =====
    component merkle = MerkleProof(TREE_DEPTH);
    merkle.leaf <== creditNoteHash;
    merkle.root <== creditRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path[i] <== merklePath[i];
    }
    merkle.index <== merkleIndex;

    // ===== 3. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sk;
    ownership.pkX <== pkX;
    ownership.pkY <== pkY;

    // ===== 4. Quadratic Cost Calculation =====
    signal voteCost;
    voteCost <== numVotes * numVotes;

    // ===== 5. Verify Sufficient Credits =====
    component costCheck = LessEqThan(64);
    costCheck.in[0] <== voteCost;
    costCheck.in[1] <== totalCredits;
    costCheck.out === 1;

    // ===== 6. Credits Spent Matches Cost =====
    creditsSpent === voteCost;

    // ===== 7. Validate Choice (0 or 1) =====
    choice * (1 - choice) === 0;

    // ===== 8. Validate numVotes is Positive =====
    component votesPositive = GreaterThan(64);
    votesPositive.in[0] <== numVotes;
    votesPositive.in[1] <== 0;
    votesPositive.out === 1;

    // ===== 9. Create Vote Commitment =====
    component commit = Poseidon(5);
    commit.inputs[0] <== choice;
    commit.inputs[1] <== numVotes;
    commit.inputs[2] <== creditsSpent;
    commit.inputs[3] <== proposalId;
    commit.inputs[4] <== voteSalt;
    commit.out === voteCommitment;
}

component main {public [voteCommitment, proposalId, creditsSpent, creditRoot]} =
    QuadraticVoting(20);
```

### Key Constraints

1. **Credit Ownership**: Voter must own credited voice credits proven via merkle inclusion
2. **Quadratic Cost**: Vote cost equals numVotes squared exactly
3. **Sufficient Balance**: Credits spent cannot exceed available credits
4. **Binary Choice**: Choice must be 0 (against) or 1 (for)
5. **Positive Votes**: Must cast at least one vote

## Effects

| Aspect | Impact |
|--------|--------|
| **Preference Intensity** | Voters can signal conviction strength through credit allocation |
| **Anti-Plutocracy** | Diminishing returns prevent whale domination of outcomes |
| **Minority Voice** | Intense minorities can outweigh apathetic majorities on key issues |
| **Strategic Depth** | Voters must budget credits across multiple proposals |
| **Economic Efficiency** | Approaches optimal collective decision-making in mechanism design |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Credit Farming** | Credits tied to identity/membership duration, not transferable tokens |
| **Sybil Attacks** | Identity verification or minimum stake required for credit allocation |
| **Credit Overflow** | Use 64-bit arithmetic; cap maximum credits per period |
| **Vote Splitting** | Nullifier per identity per proposal prevents splitting across accounts |
| **Collusion Rings** | Private voting prevents coordination on specific vote counts |
| **Credit Manipulation** | Credits allocated at snapshot; cannot be modified mid-vote |

## Implementation Challenges

1. **Credit Distribution**
   - How are voice credits initially allocated? (equal, stake-weighted, reputation-based)
   - Credit refresh rate for ongoing governance
   - Cross-proposal credit budgeting complexity

2. **Identity Requirements**
   - Pure QV requires Sybil resistance
   - Options: proof-of-humanity, social vouching, stake-based identity
   - Privacy vs. Sybil resistance tradeoffs

3. **UX Complexity**
   - Users must understand quadratic cost structure
   - Need clear UI showing cost/benefit of additional votes
   - Credit budget tracking across active proposals

4. **Credit Accounting**
   - Track credits spent vs. remaining
   - Handle proposal cancellation (credit refunds)
   - Prevent double-spending of credits

## Derivatives

1. **Private Quadratic Voting** - Extends QV with commit-reveal scheme to hide both choice and vote count until reveal phase. Prevents strategic coordination based on observing others' conviction levels.

2. **Budget-Capped QV** - Each voter receives fixed credit budget per voting period (e.g., 100 credits/month). Forces prioritization across proposals. Unspent credits may roll over or expire.

3. **QV for Fund Allocation** - Allocate treasury funds across competing proposals using QV. Vote counts determine proportional funding. Enables efficient public goods funding similar to Gitcoin grants.

4. **Cross-Proposal QV** - Credits are shared across simultaneous proposals. Voting on one reduces available credits for others. Reveals relative priority among competing initiatives.

5. **Conviction-Weighted QV** - Initial credit allocation based on governance participation history. Active community members receive more credits. Rewards long-term engagement over recent token purchases.

## Use Cases

1. **Protocol Upgrade Prioritization**
   - DAO has five proposed upgrades, resources for two
   - Members allocate credits across proposals
   - Those with strong preferences on security upgrade can concentrate votes
   - Outcome reflects both breadth and depth of support

2. **Grant Committee Allocation**
   - Quarterly grant budget of $500K
   - 20 project applications submitted
   - Committee members use QV to allocate across projects
   - Funding proportional to QV vote totals

3. **Feature Request Prioritization**
   - DeFi protocol collects feature requests
   - Users receive credits based on TVL contribution
   - QV determines development roadmap priority
   - Power users can signal critical needs without dominating

4. **Contentious Binary Decision**
   - Community split on controversial change
   - QV reveals intensity of opposition vs. mild majority
   - Small passionate group can prevent change they consider existential
   - Better reflects true community preference distribution

## Real-World Products & User Experience

See: [Quadratic Voting Products & UX](../../../product/d-governance/d2-quadratic-products.md)

---

[Back to Index](../../README.md)
