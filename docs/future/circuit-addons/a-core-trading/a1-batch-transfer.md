# A1. Batch Transfer

N-to-M note transfers in a single transaction, enabling efficient consolidation, distribution, and complex payment flows.

**Constraints**: ~500K | **Complexity**: Medium

---

## Background

Batch transfers address critical limitations in individual note handling:

- **Gas Cost Accumulation**: Users with many small notes face prohibitive gas costs for individual transfers
- **Payment Processing**: Businesses need to pay multiple recipients efficiently (payroll, dividends, airdrops)
- **Note Fragmentation**: Trading activity creates many small notes requiring periodic consolidation
- **Privacy Enhancement**: Batch operations create larger anonymity sets, making transaction graph analysis harder
- **Atomic Operations**: Multi-party settlements require all-or-nothing execution guarantees

In traditional finance, batch processing is standard for ACH, wire transfers, and payroll. In ZK systems, batching is even more critical due to high per-proof costs.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `merkleRoot` | field | Current state tree root |
| `inputHash[N_IN]` | field[] | Hashes of input notes being spent |
| `outputHash[N_OUT]` | field[] | Hashes of output notes being created |
| `tokenType` | uint | Token type (all notes must match) |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `inPkX[N_IN], inPkY[N_IN]` | field[] | Input note owner public keys |
| `inValue[N_IN]` | uint[] | Input note values |
| `inSalt[N_IN]` | field[] | Input note randomness |
| `inSk[N_IN]` | field[] | Secret keys for ownership proofs |
| `inPath[N_IN][TREE_DEPTH]` | field[][] | Merkle proof paths |
| `inIndex[N_IN]` | uint[] | Merkle proof indices |
| `outPkX[N_OUT], outPkY[N_OUT]` | field[] | Output note owner public keys |
| `outValue[N_OUT]` | uint[] | Output note values |
| `outSalt[N_OUT]` | field[] | Output note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template BatchTransfer(N_IN, N_OUT, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input merkleRoot;
    signal input inputHash[N_IN];
    signal input outputHash[N_OUT];
    signal input tokenType;

    // ===== Private Inputs =====
    signal input inPkX[N_IN], inPkY[N_IN];
    signal input inValue[N_IN], inSalt[N_IN], inSk[N_IN];
    signal input inPath[N_IN][TREE_DEPTH], inIndex[N_IN];
    signal input outPkX[N_OUT], outPkY[N_OUT];
    signal input outValue[N_OUT], outSalt[N_OUT];

    // ===== Components =====
    component inNote[N_IN];
    component inOwn[N_IN];
    component inMerkle[N_IN];
    component outNote[N_OUT];

    // ===== 1. Verify Each Input Note =====
    signal inValueSum[N_IN + 1];
    inValueSum[0] <== 0;

    for (var i = 0; i < N_IN; i++) {
        // Verify note hash
        inNote[i] = PoseidonRegularNote();
        inNote[i].pkX <== inPkX[i];
        inNote[i].pkY <== inPkY[i];
        inNote[i].value <== inValue[i];
        inNote[i].tokenType <== tokenType;
        inNote[i].salt <== inSalt[i];
        inNote[i].out === inputHash[i];

        // Verify ownership
        inOwn[i] = ProofOfOwnershipStrict();
        inOwn[i].sk <== inSk[i];
        inOwn[i].pkX <== inPkX[i];
        inOwn[i].pkY <== inPkY[i];

        // Verify Merkle inclusion
        inMerkle[i] = MerkleProof(TREE_DEPTH);
        inMerkle[i].leaf <== inputHash[i];
        inMerkle[i].root <== merkleRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            inMerkle[i].path[j] <== inPath[i][j];
        }
        inMerkle[i].index <== inIndex[i];

        // Accumulate input value
        inValueSum[i + 1] <== inValueSum[i] + inValue[i];
    }

    // ===== 2. Verify Each Output Note =====
    signal outValueSum[N_OUT + 1];
    outValueSum[0] <== 0;

    for (var i = 0; i < N_OUT; i++) {
        // Verify note hash
        outNote[i] = PoseidonRegularNote();
        outNote[i].pkX <== outPkX[i];
        outNote[i].pkY <== outPkY[i];
        outNote[i].value <== outValue[i];
        outNote[i].tokenType <== tokenType;
        outNote[i].salt <== outSalt[i];
        outNote[i].out === outputHash[i];

        // Accumulate output value
        outValueSum[i + 1] <== outValueSum[i] + outValue[i];
    }

    // ===== 3. Balance Check: Total In == Total Out =====
    inValueSum[N_IN] === outValueSum[N_OUT];

    // ===== 4. Non-Zero Validation =====
    // At least one input must have non-zero value (prevents empty batch)
    signal hasValue[N_IN + 1];
    hasValue[0] <== 0;
    for (var i = 0; i < N_IN; i++) {
        component isNonZero = IsZero();
        isNonZero.in <== inValue[i];
        hasValue[i + 1] <== hasValue[i] + (1 - isNonZero.out);
    }
    component atLeastOne = GreaterThan(8);
    atLeastOne.in[0] <== hasValue[N_IN];
    atLeastOne.in[1] <== 0;
    atLeastOne.out === 1;
}

component main {public [merkleRoot, inputHash, outputHash, tokenType]} =
    BatchTransfer(8, 8, 20);
```

### Key Constraints

1. **Individual Note Verification**: Each input note must hash correctly and exist in Merkle tree
2. **Ownership Proofs**: All input notes require valid ownership proofs from respective secret keys
3. **Balance Conservation**: Sum of input values must exactly equal sum of output values
4. **Token Homogeneity**: All notes in batch must be same token type
5. **Non-Empty Batch**: At least one input must have non-zero value

## Effects

| Aspect | Impact |
|--------|--------|
| **Gas Efficiency** | 60-80% reduction vs. individual transfers |
| **Privacy** | Larger anonymity set from multiple inputs/outputs |
| **UX** | Single transaction for complex payment flows |
| **Atomicity** | All-or-nothing execution prevents partial failures |
| **Note Management** | Enables efficient consolidation and distribution |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Double Spending** | Each input note hash generates unique nullifier; contract tracks spent nullifiers |
| **Balance Manipulation** | Circuit enforces strict input-output balance equality |
| **Front-Running** | Note hashes hide amounts; observer cannot determine profitable reordering |
| **Replay Attack** | Nullifiers tied to specific notes prevent replay |
| **Merkle Root Staleness** | Contract validates merkleRoot is current state |
| **Owner Impersonation** | BabyJubJub signature verification ensures only owner can spend |

## Implementation Challenges

1. **Proof Generation Time**
   - Large batches (8x8) require significant computation
   - Consider client-side chunking for very large batches
   - WebAssembly witness generation may take 10-30 seconds

2. **Merkle Proof Aggregation**
   - Multiple Merkle proofs increase circuit size linearly
   - Consider proof batching strategies for common subtrees
   - Pre-compute common paths for frequently accessed notes

3. **Dynamic Batch Sizing**
   - Fixed N_IN/N_OUT requires padding for smaller batches
   - Deploy multiple circuit sizes (2x2, 4x4, 8x8) for flexibility
   - Zero-value notes used as padding must not affect balance

4. **Gas Limit Constraints**
   - Large batches may approach block gas limits
   - Proof verification ~200K gas + ~20K per nullifier
   - Maximum practical batch size ~16x16 on current networks

5. **State Synchronization**
   - Merkle root must remain valid during proof generation
   - Consider optimistic proof generation with root validation at submission
   - Implement retry logic for stale root rejections

## Derivatives

1. **Batch Payroll System** - Employers distribute salaries to multiple employees in single transaction. Circuit extended with employer signature, payment schedule commitment, and employee public key registry. Enables private payroll where amounts and recipients are hidden from observers.

2. **Note Defragmentation Service** - Automated consolidation of small notes into larger denominations. Background process monitors user's note inventory, generates optimal consolidation batches when gas is cheap. Improves future transaction efficiency and reduces long-term storage costs.

3. **Private Crowdfunding** - Multiple contributors send to single recipient without revealing individual amounts. Extended with contribution commitment hash, funding goal threshold, and refund mechanism if goal not met. Contributors remain anonymous even to project creator.

4. **Cross-Chain Batch Bridge** - Batch multiple notes for bridging to another chain in single proof. Includes destination chain identifier, bridge contract address, and time-lock for challenge period. Reduces per-note bridging overhead by 90%.

5. **MEV-Resistant Multi-Transfer** - Batch transfers with encrypted routing that prevents sandwich attacks. Includes commitment to execution order, minimum acceptable rates, and timeout conditions. Searchers cannot extract value from batch contents.

## Use Cases

1. **Corporate Payroll**
   - Company with 50 employees needs monthly salary distribution
   - Single batch transfer sends all salaries atomically
   - Employees receive funds without revealing company's total payroll
   - Failed payment to one employee doesn't affect others (batch succeeds or fails entirely)

2. **Trading Bot Consolidation**
   - Arbitrage bot accumulates hundreds of small notes from trades
   - Weekly consolidation combines into manageable note sizes
   - Reduces future transaction costs and proof generation time
   - Maintains privacy by obscuring trading frequency and volumes

3. **DAO Treasury Distribution**
   - Governance proposal approves grants to 10 different projects
   - Single batch transfer executes all grants atomically
   - Each recipient receives different amount based on proposal
   - On-chain observers see batch but cannot determine individual allocations

4. **Airdrop Distribution**
   - Protocol distributes tokens to qualifying addresses
   - Merkle-based eligibility combined with batch transfer
   - Recipients claim in batches, reducing total gas costs
   - Distribution amounts remain private until claimed

## Real-World Products & User Experience

See dedicated product documentation: [Product Applications](../../product/a-core-trading/a1-batch-transfer-products.md)

---

[Back to Index](../../README.md)
