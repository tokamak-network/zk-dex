# D5. Rage Quit

Exit DAO with proportional share of treasury, protecting minority members from majority tyranny.

**Constraints**: ~250K | **Complexity**: Medium

---

## Background

Rage quit protects minority rights in collective governance:

- **Exit Rights**: Members should never be trapped in organizations they fundamentally oppose
- **Majority Accountability**: Knowing members can exit constrains majority from value extraction
- **Proportional Fairness**: Exiting members deserve their fair share of collective assets
- **Governance Legitimacy**: Voluntary association requires viable exit options

In traditional organizations, minority shareholders have limited recourse against majority decisions. DAOs can implement rage quit to allow proportional treasury redemption. This creates accountability pressure on governance while preserving individual autonomy.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `membershipNullifier` | field | Nullifier to prevent double-exit |
| `outputHashes[N]` | field[] | Hashes of output notes (tokens received) |
| `treasuryRoot` | field | Merkle root of treasury balances |
| `membershipRoot` | field | Merkle root of member shares |
| `totalShares` | uint | Total outstanding membership shares |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | Member's public key |
| `sk` | field | Secret key proving membership |
| `shareAmount` | uint | Member's share count |
| `membershipSalt` | field | Membership note randomness |
| `memberMerklePath[20]` | field[] | Proof of membership |
| `memberMerkleIndex` | uint | Position in membership tree |
| `treasuryBalances[N]` | uint | Treasury balance for each token |
| `treasuryMerklePaths[N][20]` | field[][] | Proofs of treasury balances |
| `exitAmounts[N]` | uint | Amounts to withdraw per token |
| `outputSalts[N]` | field | Randomness for output notes |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template RageQuit(NUM_TOKENS, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input membershipNullifier;
    signal input outputHashes[NUM_TOKENS];
    signal input treasuryRoot;
    signal input membershipRoot;
    signal input totalShares;

    // ===== Private Inputs =====
    signal input pkX, pkY, sk;
    signal input shareAmount;
    signal input membershipSalt;
    signal input memberMerklePath[TREE_DEPTH];
    signal input memberMerkleIndex;
    signal input treasuryBalances[NUM_TOKENS];
    signal input tokenTypes[NUM_TOKENS];
    signal input treasuryMerklePaths[NUM_TOKENS][TREE_DEPTH];
    signal input treasuryMerkleIndexes[NUM_TOKENS];
    signal input exitAmounts[NUM_TOKENS];
    signal input outputSalts[NUM_TOKENS];

    // ===== 1. Verify Membership =====
    component membership = Poseidon(4);
    membership.inputs[0] <== pkX;
    membership.inputs[1] <== pkY;
    membership.inputs[2] <== shareAmount;
    membership.inputs[3] <== membershipSalt;

    component memberMerkle = MerkleProof(TREE_DEPTH);
    memberMerkle.leaf <== membership.out;
    memberMerkle.root <== membershipRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        memberMerkle.path[i] <== memberMerklePath[i];
    }
    memberMerkle.index <== memberMerkleIndex;

    // ===== 2. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sk;
    ownership.pkX <== pkX;
    ownership.pkY <== pkY;

    // ===== 3. Compute Nullifier =====
    component nullifier = Poseidon(2);
    nullifier.inputs[0] <== sk;
    nullifier.inputs[1] <== membershipRoot;  // Binds to specific membership state
    nullifier.out === membershipNullifier;

    // ===== 4. Verify Proportional Exit for Each Token =====
    component treasuryProofs[NUM_TOKENS];
    component treasuryNotes[NUM_TOKENS];
    component proportionChecks[NUM_TOKENS];
    component outputNotes[NUM_TOKENS];

    for (var i = 0; i < NUM_TOKENS; i++) {
        // 4a. Verify treasury balance for this token
        treasuryNotes[i] = Poseidon(2);
        treasuryNotes[i].inputs[0] <== tokenTypes[i];
        treasuryNotes[i].inputs[1] <== treasuryBalances[i];

        treasuryProofs[i] = MerkleProof(TREE_DEPTH);
        treasuryProofs[i].leaf <== treasuryNotes[i].out;
        treasuryProofs[i].root <== treasuryRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            treasuryProofs[i].path[j] <== treasuryMerklePaths[i][j];
        }
        treasuryProofs[i].index <== treasuryMerkleIndexes[i];

        // 4b. Verify proportional exit amount
        // exitAmount * totalShares <= treasuryBalance * shareAmount
        // (allows for rounding down)
        signal leftSide;
        signal rightSide;
        leftSide <== exitAmounts[i] * totalShares;
        rightSide <== treasuryBalances[i] * shareAmount;

        proportionChecks[i] = LessEqThan(128);
        proportionChecks[i].in[0] <== leftSide;
        proportionChecks[i].in[1] <== rightSide;
        proportionChecks[i].out === 1;

        // 4c. Verify output note
        outputNotes[i] = PoseidonRegularNote();
        outputNotes[i].pkX <== pkX;
        outputNotes[i].pkY <== pkY;
        outputNotes[i].value <== exitAmounts[i];
        outputNotes[i].tokenType <== tokenTypes[i];
        outputNotes[i].salt <== outputSalts[i];
        outputNotes[i].out === outputHashes[i];
    }

    // ===== 5. Ensure Positive Shares =====
    component sharesPositive = GreaterThan(64);
    sharesPositive.in[0] <== shareAmount;
    sharesPositive.in[1] <== 0;
    sharesPositive.out === 1;

    // ===== 6. Ensure totalShares >= shareAmount =====
    component totalCheck = GreaterEqThan(64);
    totalCheck.in[0] <== totalShares;
    totalCheck.in[1] <== shareAmount;
    totalCheck.out === 1;
}

component main {public [membershipNullifier, outputHashes, treasuryRoot, membershipRoot, totalShares]} =
    RageQuit(5, 20);
```

### Key Constraints

1. **Membership Validity**: Member must exist in membership merkle tree
2. **Ownership Proof**: Secret key proves membership ownership
3. **Nullifier Uniqueness**: Prevents double-exit with same membership
4. **Proportional Calculation**: Exit amount <= (treasury * shares) / totalShares
5. **Treasury Verification**: All treasury balances proven via merkle proofs

## Effects

| Aspect | Impact |
|--------|--------|
| **Exit Rights** | Members can leave with proportional assets anytime |
| **Minority Protection** | Cannot be trapped by adverse majority decisions |
| **Governance Discipline** | Majority knows exit option constrains exploitative behavior |
| **Fair Valuation** | Proportional share calculation ensures equitable distribution |
| **Treasury Impact** | Calculated redemption prevents run-on-treasury panic |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Double Exit** | Nullifier derived from membership prevents reuse |
| **Rounding Exploitation** | Round down exit amounts; dust remains in treasury |
| **Treasury State Race** | Treasury root must match on-chain state at execution |
| **Flash-Loan Membership** | Membership requires vesting period before rage quit |
| **Coordinated Drain** | Optional rate limiting on total daily/weekly exits |
| **Sandwich Attacks** | Lock treasury during rage quit execution window |

## Implementation Challenges

1. **Treasury Tracking**
   - Multi-token treasury requires efficient balance tracking
   - Merkle tree of (token, balance) pairs
   - Updates on every treasury transaction

2. **Share Accounting**
   - Membership shares may change over time (minting, burning)
   - Total shares updated on each membership change
   - Historical snapshots for rage quit calculations

3. **Execution Atomicity**
   - Rage quit must be atomic across all treasury tokens
   - Cannot partially fail leaving inconsistent state
   - Gas limits may restrict number of tokens per exit

4. **Grace Periods**
   - Consider delay between rage quit initiation and execution
   - Allows governance to respond to mass exit scenarios
   - Balance between protection and member rights

## Derivatives

1. **Delayed Rage Quit** - Mandatory waiting period (e.g., 7 days) between rage quit declaration and execution. Allows DAO to negotiate or make counter-proposals. Member's shares locked during waiting period to prevent exit arbitrage.

2. **Partial Rage Quit** - Exit with portion of shares while retaining membership. Enables gradual exit without full commitment departure. Useful for members who want to reduce exposure but maintain participation.

3. **Rage Quit with Penalty** - Small fee (e.g., 2%) on rage quit to discourage strategic exits and fund remaining members. Penalty can be waived for long-term members or in specific circumstances defined by governance.

4. **Rage Quit Threshold** - Rage quit only available when governance decisions cross member-defined threshold. Member pre-commits to exit conditions (e.g., "if fee > 1%"). Automated exit protects against specific adverse outcomes.

5. **Coordinated Rage Quit** - Multiple members can combine rage quits for gas efficiency. Single proof covers multiple exits proportionally. Enables collective action while maintaining individual privacy.

## Use Cases

1. **Contentious Protocol Change**
   - DAO votes to implement controversial tokenomics change
   - Minority strongly opposes the direction
   - Dissenting members rage quit with proportional treasury share
   - Exit validates strength of opposition; may prompt reconsideration

2. **Fund Dissolution**
   - Investment DAO decides to wind down operations
   - All members rage quit proportionally
   - Treasury distributed fairly without complex legal proceedings
   - Efficient and trustless fund termination

3. **Strategic Disagreement**
   - DAO pivots strategy significantly
   - Early members who joined for original vision can exit
   - Receive fair value for their contribution period
   - New direction can proceed with aligned membership

4. **Protection from Capture**
   - Whale accumulates majority stake and proposes value extraction
   - Minority members recognize capture attempt
   - Rage quit before extraction can complete
   - Whale left with worthless governance over empty treasury

## Real-World Products & User Experience

See: [Rage Quit Products & UX](../../product/d-governance/d5-rage-quit-products.md)

---

[Back to Index](../../README.md)
