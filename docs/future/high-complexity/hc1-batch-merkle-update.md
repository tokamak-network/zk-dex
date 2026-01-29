# HC1. Batch Merkle Tree Update

Update multiple notes in a single proof, enabling efficient batch operations.

**Constraints**: ~800K | **Complexity**: Very High

---

## Background

Traditional zkSNARK systems process one note at a time, requiring N proofs for N transactions. This becomes a bottleneck as:
- Each proof incurs fixed verification gas costs (~200K gas for Groth16)
- Sequential processing limits throughput
- L1 calldata costs scale linearly with transaction count
- Prover computation is duplicated across similar operations

**Why current approaches are insufficient:**

| Approach | Limitation |
|----------|------------|
| Individual proofs | 200K gas per transaction, economically unviable for small transfers |
| Simple batching (no ZK) | Reveals transaction details, no privacy preservation |
| Optimistic batching | 7-day challenge period, poor UX for users |
| Parallel tree updates | State conflicts require complex coordination |

Batch processing addresses these issues by amortizing proof verification costs across multiple transactions, essential for rollup scalability while maintaining ZK privacy guarantees.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `oldRoot` | field | Merkle root before batch update |
| `newRoot` | field | Merkle root after batch update |
| `nullifierHashes` | field[BATCH_SIZE] | Nullifiers for spent notes |
| `newCommitments` | field[BATCH_SIZE] | Commitments for new notes |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `oldNotes` | field[BATCH_SIZE][5] | Note data: [pkX, pkY, value, tokenType, salt] |
| `oldPaths` | field[BATCH_SIZE][TREE_DEPTH] | Merkle proofs for old notes |
| `oldIndices` | uint[BATCH_SIZE] | Leaf indices for old notes |
| `sks` | field[BATCH_SIZE] | Secret keys for ownership proofs |
| `newNotes` | field[BATCH_SIZE][5] | New note data |
| `intermediateRoots` | field[BATCH_SIZE+1] | State roots between updates |

### Circuit Logic

## Effects

| Aspect | Impact |
|--------|--------|
| **Gas Efficiency** | ~95% reduction in per-tx verification cost (200K to ~12K per tx at 16 batch) |
| **Throughput** | 10-50x increase in transactions per block |
| **Latency** | Trade-off: batching introduces delay (wait for full batch) |
| **Prover Cost** | Higher hardware requirements for batch proof generation |
| **User Experience** | Near-instant finality after batch inclusion |
| **Calldata Cost** | ~80% reduction vs individual proofs (shared proof overhead) |

## Derivatives

1. **Recursive Batch Updates** - Chain multiple batch proofs using recursive SNARKs (e.g., Nova, Halo2) for theoretically unlimited throughput. Each proof verifies the previous batch, creating a proof chain. Enables processing thousands of transactions with constant verification cost.

2. **Selective Disclosure Batch** - Batch that reveals a configurable subset of transactions to auditors while keeping others private. Uses selective commitment opening with auditor public keys. Essential for regulatory compliance in institutional settings.

3. **Cross-Shard Batch** - Coordinate batch updates across multiple Merkle trees for horizontal scaling. Requires cross-shard communication protocol and atomic commitment across shards. Enables partition-tolerant scaling.

4. **Priority Batch** - Fast-lane batch for urgent transactions with higher fees. Implements a two-tier system: standard batches (lower fees, higher latency) and priority batches (higher fees, immediate processing). Fee market for batch inclusion priority.

5. **Compression Batch** - Combine with data compression (e.g., BLS signature aggregation, calldata compression) for minimal L1 footprint. Can reduce calldata by additional 50-70% through techniques like bitmap encoding for active slots.

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";

template BatchMerkleUpdate(BATCH_SIZE, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input oldRoot;
    signal input newRoot;
    signal input nullifierHashes[BATCH_SIZE];
    signal input newCommitments[BATCH_SIZE];

    // ===== Private Inputs =====
    signal input oldNotes[BATCH_SIZE][5];  // [pkX, pkY, value, tokenType, salt]
    signal input oldPaths[BATCH_SIZE][TREE_DEPTH];
    signal input oldIndices[BATCH_SIZE];
    signal input sks[BATCH_SIZE];
    signal input newNotes[BATCH_SIZE][5];
    signal input intermediateRoots[BATCH_SIZE + 1];

    // ===== Component Declarations (must be outside loops) =====
    component oldNoteHash[BATCH_SIZE];
    component ownership[BATCH_SIZE];
    component oldMerkle[BATCH_SIZE];
    component nullifier[BATCH_SIZE];
    component newNoteHash[BATCH_SIZE];
    component updateMerkle[BATCH_SIZE];

    // ===== Root Chain Validation =====
    intermediateRoots[0] === oldRoot;
    intermediateRoots[BATCH_SIZE] === newRoot;

    // ===== Process Each Transaction in Batch =====
    for (var i = 0; i < BATCH_SIZE; i++) {
        // 1. Hash old note
        oldNoteHash[i] = Poseidon(5);
        for (var j = 0; j < 5; j++) {
            oldNoteHash[i].inputs[j] <== oldNotes[i][j];
        }

        // 2. Verify ownership
        ownership[i] = ProofOfOwnershipStrict();
        ownership[i].sk <== sks[i];
        ownership[i].pkX <== oldNotes[i][0];
        ownership[i].pkY <== oldNotes[i][1];

        // 3. Verify Merkle inclusion against current intermediate root
        oldMerkle[i] = MerkleProof(TREE_DEPTH);
        oldMerkle[i].leaf <== oldNoteHash[i].out;
        oldMerkle[i].root <== intermediateRoots[i];
        for (var j = 0; j < TREE_DEPTH; j++) {
            oldMerkle[i].path[j] <== oldPaths[i][j];
        }
        oldMerkle[i].index <== oldIndices[i];

        // 4. Compute and verify nullifier
        nullifier[i] = Poseidon(2);
        nullifier[i].inputs[0] <== oldNoteHash[i].out;
        nullifier[i].inputs[1] <== sks[i];
        nullifier[i].out === nullifierHashes[i];

        // 5. Hash new note and verify commitment
        newNoteHash[i] = Poseidon(5);
        for (var j = 0; j < 5; j++) {
            newNoteHash[i].inputs[j] <== newNotes[i][j];
        }
        newNoteHash[i].out === newCommitments[i];

        // 6. Compute next intermediate root
        updateMerkle[i] = MerkleUpdate(TREE_DEPTH);
        updateMerkle[i].oldRoot <== intermediateRoots[i];
        updateMerkle[i].oldLeaf <== oldNoteHash[i].out;
        updateMerkle[i].newLeaf <== newNoteHash[i].out;
        updateMerkle[i].index <== oldIndices[i];
        for (var j = 0; j < TREE_DEPTH; j++) {
            updateMerkle[i].path[j] <== oldPaths[i][j];
        }
        updateMerkle[i].newRoot === intermediateRoots[i + 1];
    }

    // ===== Value Conservation =====
    var totalOldValue = 0;
    var totalNewValue = 0;
    for (var i = 0; i < BATCH_SIZE; i++) {
        totalOldValue += oldNotes[i][2];
        totalNewValue += newNotes[i][2];
    }
    totalOldValue === totalNewValue;
}

component main {public [oldRoot, newRoot, nullifierHashes, newCommitments]} =
    BatchMerkleUpdate(16, 20);
```

### Key Constraints

1. **Sequential Root Chain**: Each intermediate root must be valid transition from previous
2. **Ownership Verification**: All spent notes must be owned by transaction signers
3. **Nullifier Uniqueness**: Contract must check nullifiers against spent set
4. **Value Conservation**: Sum of inputs equals sum of outputs (no creation/destruction)

### Design Note: Intermediate Roots vs Parallel Processing

The intermediate roots approach (sequential updates) was chosen over parallel processing for several reasons:

| Approach | Pros | Cons |
|----------|------|------|
| **Intermediate Roots (Current)** | Simpler circuit, deterministic ordering, no conflict resolution | O(n) state updates, longer proving time |
| **Parallel Merkle Update** | Potentially faster proving with multiple cores | Requires conflict detection, complex path merging, non-deterministic ordering |
| **Sparse Merkle Tree** | O(1) updates, natural parallelism | Higher storage overhead, different proof structure |

For BATCH_SIZE=16, the sequential approach adds ~10% to proving time but significantly simplifies the circuit and eliminates race conditions. For larger batches (64+), parallel approaches with conflict resolution may be warranted.

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Double-Spend in Batch** | Nullifier uniqueness checked within batch before proof generation |
| **Ordering Manipulation** | Intermediate roots enforce deterministic ordering; sequencer cannot reorder |
| **Incomplete Batch** | Allow partial batches with padding (inactive slots); minimum batch size for economic viability |
| **Prover Censorship** | Decentralized prover network; user can self-prove with longer timeout |
| **State Root Desync** | Contract stores root; proof must reference current on-chain root |
| **Replay Attack** | Nullifiers stored permanently; old batches cannot be replayed |
| **Value Overflow** | Use 252-bit comparisons; sum validation in field arithmetic |

## Implementation Challenges

1. **Intermediate Root Computation**
   - Prover must compute all intermediate Merkle roots off-chain
   - Requires access to full Merkle tree state
   - Consider using incremental Merkle tree libraries (e.g., @zk-kit/incremental-merkle-tree)

2. **Batch Coordination**
   - How to collect transactions from multiple users into one batch?
   - Mempool design for pending transactions
   - Fee splitting mechanism among batch participants

3. **Prover Hardware Requirements**
   - ~800K constraints requires significant RAM (~32GB for trusted setup)
   - Proof generation time: 30-60 seconds on consumer hardware
   - Consider GPU acceleration or distributed proving

4. **Partial Batch Handling**
   - What if batch isn't full? (Use dummy/padding transactions)
   - Minimum economic batch size vs. latency trade-off
   - Timeout mechanism to force partial batch processing

5. **Failure Recovery**
   - If proof generation fails, how to recover pending transactions?
   - Need transaction replay mechanism with updated Merkle paths
   - Consider checkpointing intermediate state

## Use Cases

1. **Rollup Batch Processing**
   - L2 sequencer collects 16 transfers, generates single proof
   - 95% gas reduction enables micro-transactions economically
   - Batch interval: every block or every N seconds

2. **Exchange Settlement**
   - DEX batches multiple trades from order matching
   - All trades in batch settle atomically
   - Reduces MEV extraction opportunities

3. **Payroll Distribution**
   - Company distributes salary to 16 employees in one proof
   - Privacy preserved: individual amounts not revealed
   - Significant cost savings vs. 16 separate transfers

4. **Airdrop Distribution**
   - Token distribution to multiple recipients
   - Combine with Merkle proof of eligibility
   - Scale to thousands with recursive batching

## Real-World Products & User Experience

See [Real-World Products & User Experience](../../product/high-complexity/hc1-batch-merkle-update-products.md) for detailed product scenarios and use cases.

---

[Back to Index](../README.md)
