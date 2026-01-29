# D8. Proof of Reserves

Prove aggregate holdings exceed threshold without revealing individual balances or note structure.

**Constraints**: ~600K | **Complexity**: High

---

## Background

Proof of reserves enables trustless solvency verification:

- **Custodian Accountability**: Exchanges and custodians must prove they hold user funds without revealing portfolio structure
- **Privacy Preservation**: Individual account balances remain confidential while aggregate exceeds threshold
- **Continuous Attestation**: Regular proofs maintain ongoing confidence without costly audits
- **Crisis Prevention**: Early warning of reserve shortfalls prevents bank-run scenarios

After high-profile exchange collapses, proof of reserves became critical for centralized custodians. Traditional approaches either reveal too much (full transparency) or too little (trusted auditors). ZK proofs of reserves achieve the optimal balance: cryptographic certainty without information leakage.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `merkleRoot` | field | Current merkle root of all notes |
| `minReserves` | uint | Minimum reserve threshold to prove |
| `tokenType` | uint | Token type being proven |
| `entityCommitment` | field | Commitment to custodian identity |
| `attestationTime` | uint | Timestamp of this attestation |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `entityPkX, entityPkY` | field | Custodian's public key |
| `entitySk` | field | Custodian's secret key |
| `entitySalt` | field | Entity commitment randomness |
| `noteHashes[N]` | field[] | Hashes of owned notes |
| `values[N]` | uint[] | Value of each note |
| `salts[N]` | field[] | Randomness for each note |
| `isActive[N]` | bool[] | Flag for real vs. padding notes |
| `merklePaths[N][D]` | field[][] | Merkle proofs for each note |
| `merkleIndexes[N]` | uint[] | Positions in merkle tree |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template ProofOfReserves(NUM_NOTES, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input merkleRoot;
    signal input minReserves;
    signal input tokenType;
    signal input entityCommitment;
    signal input attestationTime;

    // ===== Private Inputs =====
    signal input entityPkX, entityPkY, entitySk, entitySalt;
    signal input noteHashes[NUM_NOTES];
    signal input values[NUM_NOTES];
    signal input salts[NUM_NOTES];
    signal input isActive[NUM_NOTES];
    signal input merklePaths[NUM_NOTES][TREE_DEPTH];
    signal input merkleIndexes[NUM_NOTES];

    // ===== 1. Verify Entity Commitment =====
    component entity = Poseidon(3);
    entity.inputs[0] <== entityPkX;
    entity.inputs[1] <== entityPkY;
    entity.inputs[2] <== entitySalt;
    entity.out === entityCommitment;

    // ===== 2. Verify Entity Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== entitySk;
    ownership.pkX <== entityPkX;
    ownership.pkY <== entityPkY;

    // ===== 3. Process Each Note =====
    signal runningTotal[NUM_NOTES + 1];
    runningTotal[0] <== 0;

    component notes[NUM_NOTES];
    component merkleProofs[NUM_NOTES];
    component activeChecks[NUM_NOTES];
    component hashMatches[NUM_NOTES];

    for (var i = 0; i < NUM_NOTES; i++) {
        // 3a. Verify isActive is binary (0 or 1)
        isActive[i] * (1 - isActive[i]) === 0;

        // 3b. Compute expected note hash
        notes[i] = PoseidonRegularNote();
        notes[i].pkX <== entityPkX;
        notes[i].pkY <== entityPkY;
        notes[i].value <== values[i];
        notes[i].tokenType <== tokenType;
        notes[i].salt <== salts[i];

        // 3c. Verify note hash matches (if active)
        // (computed - provided) * isActive === 0
        signal hashDiff;
        hashDiff <== notes[i].out - noteHashes[i];
        hashDiff * isActive[i] === 0;

        // 3d. Verify merkle inclusion (for all notes, active or not)
        merkleProofs[i] = MerkleProof(TREE_DEPTH);
        merkleProofs[i].leaf <== noteHashes[i];
        merkleProofs[i].root <== merkleRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            merkleProofs[i].path[j] <== merklePaths[i][j];
        }
        merkleProofs[i].index <== merkleIndexes[i];

        // 3e. Accumulate value (only active notes)
        runningTotal[i + 1] <== runningTotal[i] + values[i] * isActive[i];
    }

    // ===== 4. Final Total =====
    signal totalReserves;
    totalReserves <== runningTotal[NUM_NOTES];

    // ===== 5. Verify Reserves >= Minimum =====
    component reserveCheck = GreaterEqThan(128);
    reserveCheck.in[0] <== totalReserves;
    reserveCheck.in[1] <== minReserves;
    reserveCheck.out === 1;

    // ===== 6. Ensure At Least One Active Note =====
    signal activeSum[NUM_NOTES + 1];
    activeSum[0] <== 0;
    for (var i = 0; i < NUM_NOTES; i++) {
        activeSum[i + 1] <== activeSum[i] + isActive[i];
    }
    component hasActive = GreaterThan(64);
    hasActive.in[0] <== activeSum[NUM_NOTES];
    hasActive.in[1] <== 0;
    hasActive.out === 1;
}

component main {public [merkleRoot, minReserves, tokenType, entityCommitment, attestationTime]} =
    ProofOfReserves(100, 20);
```

### Key Constraints

1. **Entity Binding**: Proof tied to specific custodian commitment
2. **Ownership Verification**: Custodian proves control of all claimed notes
3. **Note Validity**: Each active note verified against merkle tree
4. **Value Aggregation**: Total of active note values computed correctly
5. **Threshold Satisfaction**: Aggregate reserves meet or exceed minimum

## Effects

| Aspect | Impact |
|--------|--------|
| **Trust Verification** | Cryptographic proof of solvency without trusted auditor |
| **Privacy Preservation** | Exact reserves and note structure remain hidden |
| **Continuous Assurance** | Automated regular attestations feasible |
| **Market Confidence** | Verifiable reserves support market stability |
| **Regulatory Compliance** | Meets solvency requirements without full transparency |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Borrowed Reserves** | Timestamp proof; reserves must persist between attestations |
| **Note Duplication** | Merkle tree prevents same note being counted twice |
| **Stale Proofs** | Attestation timestamp must be recent; consider expiry |
| **Collusion** | Entity commitment prevents proof sharing between custodians |
| **Partial Reserve Hiding** | minReserves should match claimed liabilities |
| **Key Compromise** | Multi-sig entity keys; regular key rotation |

## Implementation Challenges

1. **Scalability**
   - Large custodians may have thousands of notes
   - Circuit size scales with NUM_NOTES parameter
   - Consider recursive proofs for very large portfolios

2. **Proof Generation Time**
   - 600K constraints requires significant computation
   - May need dedicated proof generation infrastructure
   - Consider proving in batches with aggregation

3. **Liability Matching**
   - Proving reserves without proving matching liabilities incomplete
   - Consider complementary proof-of-liabilities circuit
   - Solvency = reserves - liabilities >= 0

4. **Multi-Asset Reserves**
   - Custodians hold multiple token types
   - Separate proof per token or unified multi-asset circuit
   - Exchange rate handling for unified solvency

## Derivatives

1. **Proof of Liabilities** - Complementary circuit proving total customer deposits. Combined with reserves proves solvency ratio. Requires privacy-preserving liability summation across all accounts.

2. **Reserve Ratio Alerts** - Continuous monitoring with automated alerts when reserves approach threshold. Keeper network submits proofs periodically. Early warning system for liquidity stress.

3. **Tiered Disclosure** - Different reserve thresholds for different audiences. Public proof shows reserves > X; regulator proof shows exact amount. Granular transparency based on trust level.

4. **Cross-Entity Aggregates** - Prove aggregate reserves across multiple custodians without revealing individual holdings. Industry-wide solvency metrics. Useful for systemic risk assessment.

5. **Historical Continuity** - Chain of proofs showing reserves maintained over time. Each proof references previous attestation. Builds confidence through consistent track record.

## Use Cases

1. **Exchange Solvency Attestation**
   - Centralized exchange holds customer funds in ZK-DEX notes
   - Monthly proof that reserves exceed customer deposits
   - Published on-chain for public verification
   - Exact holdings remain confidential from competitors

2. **Stablecoin Reserve Backing**
   - Stablecoin issuer claims 100% collateral backing
   - Weekly proof that reserves >= circulating supply
   - Automated on-chain verification without manual audit
   - Maintains confidence during market stress

3. **Institutional Custody**
   - Fund administrator custodies client assets
   - Quarterly proof for regulatory compliance
   - Specific reserve threshold based on AUM
   - Satisfies fiduciary requirements privately

4. **Insurance Fund Adequacy**
   - DeFi protocol maintains insurance fund
   - Continuous proof that fund exceeds coverage obligations
   - Automatic alerts if reserves drop near threshold
   - Community confidence in protocol safety

## Real-World Products & User Experience

See: [Proof of Reserves Products & UX](../../product/d-governance/d8-reserves-products.md)

---

[Back to Index](../../README.md)
