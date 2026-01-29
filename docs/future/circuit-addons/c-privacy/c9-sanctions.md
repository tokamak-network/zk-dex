# C9. Sanctions Compliance

Prove transaction history contains no interactions with sanctioned addresses using non-membership proofs.

**Constraints**: ~800K (100 transactions) | **Complexity**: High

---

## Background

Global sanctions compliance is a critical requirement for legitimate financial systems:

- **OFAC Requirements**: US Treasury maintains lists of sanctioned individuals, entities, and countries
- **EU/UK Sanctions**: Additional sanctions regimes with overlapping but distinct requirements
- **Financial Institution Mandate**: Banks and exchanges must screen all transactions
- **Privacy Dilemma**: Traditional screening requires exposing full transaction history
- **Non-Membership Proofs**: ZK technology enables proving absence from sanctioned set

Sanctions compliance traditionally requires revealing all counterparties for screening. Privacy systems can use non-membership proofs to demonstrate that none of the user's counterparties appear on sanctions lists, without revealing who those counterparties actually are.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `historyRoot` | field | Merkle root of user's transaction history |
| `sanctionsListRoot` | field | Merkle root of current sanctions list |
| `complianceResult` | uint | 1 if fully compliant |
| `listVersion` | uint | Sanctions list version/timestamp |
| `numTransactions` | uint | Number of transactions being verified |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `txHashes[NUM_TXS]` | field[] | Transaction hashes in user's history |
| `counterparties[NUM_TXS]` | field[] | Counterparty address for each tx |
| `historyPaths[NUM_TXS][TREE_DEPTH]` | field[][] | Merkle proofs for history inclusion |
| `historyIndexes[NUM_TXS]` | uint[] | Positions in history tree |
| `sanctionsProofs[NUM_TXS]` | NonMembershipProof[] | Non-membership proofs for each counterparty |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/merkle/sorted_merkle_non_membership.circom";
include "../utils/comparators.circom";

template SanctionsCheck(NUM_TXS, HISTORY_DEPTH, SANCTIONS_DEPTH) {
    // ===== Public Inputs =====
    signal input historyRoot;
    signal input sanctionsListRoot;
    signal input complianceResult;
    signal input listVersion;
    signal input numTransactions;

    // ===== Private Inputs =====
    signal input txHashes[NUM_TXS];
    signal input counterparties[NUM_TXS];
    signal input historyPaths[NUM_TXS][HISTORY_DEPTH];
    signal input historyIndexes[NUM_TXS];
    // Non-membership proof components
    signal input leftNeighbors[NUM_TXS];      // Left neighbor in sorted list
    signal input rightNeighbors[NUM_TXS];     // Right neighbor in sorted list
    signal input leftPaths[NUM_TXS][SANCTIONS_DEPTH];
    signal input rightPaths[NUM_TXS][SANCTIONS_DEPTH];
    signal input leftIndexes[NUM_TXS];
    signal input rightIndexes[NUM_TXS];

    // ===== 1. Verify numTransactions is Valid =====
    component numCheck = LessEqThan(16);
    numCheck.in[0] <== numTransactions;
    numCheck.in[1] <== NUM_TXS;
    numCheck.out === 1;

    // ===== 2. Process Each Transaction =====
    component historyProof[NUM_TXS];
    component nonMembership[NUM_TXS];
    signal txActive[NUM_TXS];
    signal txCompliant[NUM_TXS];

    for (var i = 0; i < NUM_TXS; i++) {
        // Check if this tx slot is active
        component activeCheck = LessThan(16);
        activeCheck.in[0] <== i;
        activeCheck.in[1] <== numTransactions;
        txActive[i] <== activeCheck.out;

        // Verify tx is in user's history (if active)
        historyProof[i] = MerkleProof(HISTORY_DEPTH);
        historyProof[i].leaf <== txHashes[i];
        historyProof[i].root <== historyRoot;
        for (var j = 0; j < HISTORY_DEPTH; j++) {
            historyProof[i].path[j] <== historyPaths[i][j];
        }
        historyProof[i].index <== historyIndexes[i];

        // Verify counterparty NOT in sanctions list (non-membership proof)
        // Using sorted Merkle tree: prove element falls between two adjacent leaves
        nonMembership[i] = SortedMerkleNonMembership(SANCTIONS_DEPTH);
        nonMembership[i].element <== counterparties[i];
        nonMembership[i].root <== sanctionsListRoot;
        nonMembership[i].leftNeighbor <== leftNeighbors[i];
        nonMembership[i].rightNeighbor <== rightNeighbors[i];
        for (var j = 0; j < SANCTIONS_DEPTH; j++) {
            nonMembership[i].leftPath[j] <== leftPaths[i][j];
            nonMembership[i].rightPath[j] <== rightPaths[i][j];
        }
        nonMembership[i].leftIndex <== leftIndexes[i];
        nonMembership[i].rightIndex <== rightIndexes[i];

        // Compliance: either inactive slot OR passed non-membership
        // Inactive slots are always compliant (dummy data)
        txCompliant[i] <== (1 - txActive[i]) + txActive[i] * nonMembership[i].valid;
    }

    // ===== 3. Aggregate Compliance =====
    signal partialCompliance[NUM_TXS + 1];
    partialCompliance[0] <== 1;
    for (var i = 0; i < NUM_TXS; i++) {
        partialCompliance[i + 1] <== partialCompliance[i] * txCompliant[i];
    }
    signal allCompliant <== partialCompliance[NUM_TXS];

    // ===== 4. Verify Result =====
    complianceResult === allCompliant;
}

// Helper template for sorted Merkle non-membership
template SortedMerkleNonMembership(DEPTH) {
    signal input element;
    signal input root;
    signal input leftNeighbor;
    signal input rightNeighbor;
    signal input leftPath[DEPTH];
    signal input rightPath[DEPTH];
    signal input leftIndex;
    signal input rightIndex;
    signal output valid;

    // Verify left < element < right
    component leftCheck = LessThan(256);
    leftCheck.in[0] <== leftNeighbor;
    leftCheck.in[1] <== element;

    component rightCheck = LessThan(256);
    rightCheck.in[0] <== element;
    rightCheck.in[1] <== rightNeighbor;

    // Verify left and right are in the tree
    component leftProof = MerkleProof(DEPTH);
    leftProof.leaf <== leftNeighbor;
    leftProof.root <== root;
    for (var i = 0; i < DEPTH; i++) {
        leftProof.path[i] <== leftPath[i];
    }
    leftProof.index <== leftIndex;

    component rightProof = MerkleProof(DEPTH);
    rightProof.leaf <== rightNeighbor;
    rightProof.root <== root;
    for (var i = 0; i < DEPTH; i++) {
        rightProof.path[i] <== rightPath[i];
    }
    rightProof.index <== rightIndex;

    // Verify left and right are adjacent (rightIndex = leftIndex + 1)
    component adjacentCheck = IsEqual();
    adjacentCheck.in[0] <== rightIndex;
    adjacentCheck.in[1] <== leftIndex + 1;

    // All conditions must hold for valid non-membership
    valid <== leftCheck.out * rightCheck.out * adjacentCheck.out;
}

component main {public [historyRoot, sanctionsListRoot, complianceResult, listVersion, numTransactions]} =
    SanctionsCheck(100, 20, 16);
```

### Key Constraints

1. **History Membership**: Each transaction exists in user's history tree
2. **Non-Membership Proof**: Each counterparty proven NOT in sanctions list
3. **Sorted Tree Structure**: Sanctions list in sorted Merkle tree for non-membership
4. **Adjacency Proof**: Neighbors in sorted tree are actually adjacent
5. **Aggregate Compliance**: All transactions must pass for overall compliance

## Effects

| Aspect | Impact |
|--------|--------|
| **Regulatory Compliance** | Prove adherence to sanctions requirements |
| **Privacy Preservation** | Transaction counterparties never revealed |
| **List Currency** | Uses current sanctions list root |
| **Batch Verification** | Multiple transactions in single proof |
| **Institutional Enabling** | Regulated entities can participate |
| **Global Applicability** | Supports multiple sanctions regimes |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Stale Sanctions List** | listVersion and root freshness checks |
| **Incomplete History** | Verifier may require minimum history depth |
| **Sanctions Evasion** | Cannot prove compliance for unlisted addresses |
| **List Manipulation** | Use official, attested sanctions list roots |
| **New Sanctions** | Re-prove after list updates |
| **History Pruning** | Keep sufficient history for compliance periods |
| **Counterparty Definition** | Clear definition of what constitutes interaction |

## Implementation Challenges

1. **Sorted Merkle Tree Maintenance**
   - Sanctions list must be in sorted order
   - Insertions require tree restructuring
   - Consider sparse Merkle tree alternatives

2. **List Update Frequency**
   - OFAC updates multiple times weekly
   - EU/UK lists update regularly
   - Need efficient re-proving mechanism

3. **History Accumulation**
   - Long transaction histories mean large proofs
   - Consider rolling window compliance
   - Recursive proof aggregation for history

4. **Multi-Jurisdiction Lists**
   - Different lists for US, EU, UK, etc.
   - Single proof for multiple lists increases complexity
   - May need separate proofs per jurisdiction

5. **Counterparty Identification**
   - Direct counterparty clear
   - Intermediate hops more complex
   - Define "interaction" clearly

## Derivatives

1. **Real-Time Sanctions Screening** - Screen each transaction before execution against live sanctions list. Prevents transaction if counterparty becomes sanctioned mid-session. Continuous compliance monitoring.

2. **Historical Compliance Proofs** - Prove compliance at specific past dates using historical sanctions list snapshots. Useful for audits covering past periods. Requires archived list roots.

3. **Counterparty Risk Assessment** - Beyond binary sanctions check, assess proximity to sanctioned entities. Degrees of separation analysis. Risk scoring for borderline cases.

4. **Sanctions List Update Subscription** - Automatic re-proving when sanctions lists update. Maintains continuous compliance certification. Alerts if status changes.

5. **Cross-Chain Compliance Verification** - Prove compliance across multiple blockchains where user has activity. Aggregate cross-chain history into unified compliance proof. Supports multi-chain institutions.

## Use Cases

1. **Exchange Compliance**
   - Cryptocurrency exchange needs sanctions screening
   - User proves all counterparties are not sanctioned
   - Exchange satisfies regulatory requirements
   - User transaction history remains private

2. **Bank DeFi Integration**
   - Bank wants to interact with DeFi protocols
   - Must prove no sanctioned entity interaction
   - ZK proof satisfies compliance team
   - DeFi positions remain confidential

3. **Cross-Border Payments**
   - Payment processor handles international transfers
   - Proves sender/receiver not on any sanctions list
   - Satisfies OFAC and EU screening requirements
   - Payment details remain private

4. **Institutional Fund Management**
   - Hedge fund uses privacy-preserving DeFi
   - Must prove portfolio has no sanctioned exposure
   - Quarterly compliance proofs for auditors
   - Trading strategies remain confidential

## Real-World Products & User Experience

See [Sanctions Compliance - Products & UX](../../product/c-privacy/c9-sanctions-products.md) for detailed real-world applications and user experience scenarios.

---

[Back to Index](../../README.md)
