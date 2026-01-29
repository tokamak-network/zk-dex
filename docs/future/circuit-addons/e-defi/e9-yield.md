# E9. Yield Claim

Claim accumulated yield and rewards with hidden earnings amounts and source positions, enabling private income generation.

**Constraints**: ~150K | **Complexity**: Low

---

## Background

Yield claiming exposes significant financial information:

- **Earnings Exposure**: Visible yield claims reveal income and portfolio performance
- **Position Inference**: Yield amounts can be used to calculate underlying position sizes
- **Tax Implications**: Public yield claims create tax reporting challenges
- **Strategy Leakage**: Yield sources reveal investment allocation and strategy

Current DeFi yield protocols expose all claim details. Private yield claiming hides the reward amount while proving entitlement through ZK proofs.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `positionNoteHash` | field | Hash of the yield-generating position |
| `yieldNoteHash` | field | Hash of the claimed yield note |
| `yieldPoolCommitment` | field | Yield pool state commitment |
| `epochNumber` | uint | Current epoch for yield calculation |
| `yieldRate` | uint | Published yield rate for epoch |
| `nullifier` | field | Prevents double-claiming |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `claimerPkX, claimerPkY` | field | Claimer's public key |
| `claimerSk` | field | Claimer's secret key |
| `positionValue` | uint | Underlying position value (hidden) |
| `positionType` | uint | Type of yield-generating position |
| `lastClaimEpoch` | uint | Last epoch yield was claimed |
| `yieldAmount` | uint | Yield being claimed (hidden) |
| `positionSalt` | field | Position note randomness |
| `yieldSalt` | field | Yield note randomness |
| `accumulatedYield` | uint | Total accumulated unclaimed yield |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template YieldClaim() {
    // ===== Public Inputs =====
    signal input positionNoteHash;
    signal input yieldNoteHash;
    signal input yieldPoolCommitment;
    signal input newPoolCommitment;
    signal input epochNumber;
    signal input yieldRate;          // Rate in basis points (e.g., 500 = 5%)
    signal input nullifier;

    // ===== Private Inputs =====
    signal input claimerPkX, claimerPkY, claimerSk;
    signal input positionValue;
    signal input positionType;
    signal input lastClaimEpoch;
    signal input yieldAmount;
    signal input positionSalt, yieldSalt;
    signal input poolTotalYield, poolSalt;
    signal input newPoolTotalYield, newPoolSalt;

    // ===== 1. Verify Claimer Ownership =====
    component claimerOwnership = ProofOfOwnershipStrict();
    claimerOwnership.sk <== claimerSk;
    claimerOwnership.pkX <== claimerPkX;
    claimerOwnership.pkY <== claimerPkY;

    // ===== 2. Verify Position Note =====
    component positionNote = Poseidon(5);
    positionNote.inputs[0] <== claimerPkX;
    positionNote.inputs[1] <== claimerPkY;
    positionNote.inputs[2] <== positionValue;
    positionNote.inputs[3] <== positionType;
    positionNote.inputs[4] <== positionSalt;
    positionNote.out === positionNoteHash;

    // ===== 3. Verify Epochs Elapsed =====
    signal epochsElapsed;
    epochsElapsed <== epochNumber - lastClaimEpoch;

    component epochCheck = GreaterThan(32);
    epochCheck.in[0] <== epochsElapsed;
    epochCheck.in[1] <== 0;
    epochCheck.out === 1;

    // ===== 4. Verify Yield Calculation =====
    // yieldAmount = positionValue * yieldRate * epochsElapsed / 10000
    signal expectedYield;
    signal yieldPerEpoch;
    yieldPerEpoch <== positionValue * yieldRate / 10000;
    expectedYield <== yieldPerEpoch * epochsElapsed;

    // Allow claiming up to expected yield (partial claims allowed)
    component yieldCheck = LessEqThan(128);
    yieldCheck.in[0] <== yieldAmount;
    yieldCheck.in[1] <== expectedYield;
    yieldCheck.out === 1;

    // Ensure non-zero claim
    component nonZeroCheck = GreaterThan(128);
    nonZeroCheck.in[0] <== yieldAmount;
    nonZeroCheck.in[1] <== 0;
    nonZeroCheck.out === 1;

    // ===== 5. Verify Yield Pool State =====
    component poolState = Poseidon(2);
    poolState.inputs[0] <== poolTotalYield;
    poolState.inputs[1] <== poolSalt;
    poolState.out === yieldPoolCommitment;

    // ===== 6. Verify Pool Has Sufficient Yield =====
    component poolSufficiencyCheck = GreaterEqThan(128);
    poolSufficiencyCheck.in[0] <== poolTotalYield;
    poolSufficiencyCheck.in[1] <== yieldAmount;
    poolSufficiencyCheck.out === 1;

    // ===== 7. Update Pool State =====
    newPoolTotalYield === poolTotalYield - yieldAmount;

    component newPoolState = Poseidon(2);
    newPoolState.inputs[0] <== newPoolTotalYield;
    newPoolState.inputs[1] <== newPoolSalt;
    newPoolState.out === newPoolCommitment;

    // ===== 8. Verify Yield Note =====
    component yieldNote = PoseidonRegularNote();
    yieldNote.pkX <== claimerPkX;
    yieldNote.pkY <== claimerPkY;
    yieldNote.value <== yieldAmount;
    yieldNote.tokenType <== 1;  // Yield in reward token
    yieldNote.salt <== yieldSalt;
    yieldNote.out === yieldNoteHash;

    // ===== 9. Verify Nullifier (per epoch range) =====
    component nullifierHash = Poseidon(4);
    nullifierHash.inputs[0] <== positionNoteHash;
    nullifierHash.inputs[1] <== claimerSk;
    nullifierHash.inputs[2] <== lastClaimEpoch;
    nullifierHash.inputs[3] <== epochNumber;
    nullifierHash.out === nullifier;
}

template YieldCompound() {
    // ===== Public Inputs =====
    signal input positionNoteHash;
    signal input newPositionNoteHash;
    signal input yieldPoolCommitment;
    signal input newPoolCommitment;
    signal input epochNumber;
    signal input yieldRate;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input claimerPkX, claimerPkY, claimerSk;
    signal input positionValue;
    signal input positionType;
    signal input lastClaimEpoch;
    signal input positionSalt;
    signal input newPositionValue;
    signal input newPositionSalt;
    signal input yieldAmount;
    signal input poolTotalYield, poolSalt;
    signal input newPoolTotalYield, newPoolSalt;

    // ===== 1. Verify Claimer Ownership =====
    component claimerOwnership = ProofOfOwnershipStrict();
    claimerOwnership.sk <== claimerSk;
    claimerOwnership.pkX <== claimerPkX;
    claimerOwnership.pkY <== claimerPkY;

    // ===== 2. Verify Original Position Note =====
    component positionNote = Poseidon(5);
    positionNote.inputs[0] <== claimerPkX;
    positionNote.inputs[1] <== claimerPkY;
    positionNote.inputs[2] <== positionValue;
    positionNote.inputs[3] <== positionType;
    positionNote.inputs[4] <== positionSalt;
    positionNote.out === positionNoteHash;

    // ===== 3. Verify Yield Calculation =====
    signal epochsElapsed;
    epochsElapsed <== epochNumber - lastClaimEpoch;

    signal expectedYield;
    expectedYield <== positionValue * yieldRate * epochsElapsed / 10000;

    component yieldCheck = LessEqThan(128);
    yieldCheck.in[0] <== yieldAmount;
    yieldCheck.in[1] <== expectedYield;
    yieldCheck.out === 1;

    // ===== 4. Verify New Position Value =====
    // newPositionValue = positionValue + yieldAmount (compound)
    newPositionValue === positionValue + yieldAmount;

    // ===== 5. Verify New Position Note =====
    component newPositionNote = Poseidon(5);
    newPositionNote.inputs[0] <== claimerPkX;
    newPositionNote.inputs[1] <== claimerPkY;
    newPositionNote.inputs[2] <== newPositionValue;
    newPositionNote.inputs[3] <== positionType;
    newPositionNote.inputs[4] <== newPositionSalt;
    newPositionNote.out === newPositionNoteHash;

    // ===== 6. Verify Pool State Update =====
    component poolState = Poseidon(2);
    poolState.inputs[0] <== poolTotalYield;
    poolState.inputs[1] <== poolSalt;
    poolState.out === yieldPoolCommitment;

    newPoolTotalYield === poolTotalYield - yieldAmount;

    component newPoolState = Poseidon(2);
    newPoolState.inputs[0] <== newPoolTotalYield;
    newPoolState.inputs[1] <== newPoolSalt;
    newPoolState.out === newPoolCommitment;

    // ===== 7. Verify Nullifier =====
    component nullifierHash = Poseidon(4);
    nullifierHash.inputs[0] <== positionNoteHash;
    nullifierHash.inputs[1] <== claimerSk;
    nullifierHash.inputs[2] <== lastClaimEpoch;
    nullifierHash.inputs[3] <== epochNumber;
    nullifierHash.out === nullifier;
}

template MultiPositionYieldClaim() {
    // Claim yield from multiple positions in single proof
    signal input positionNoteHashes[4];
    signal input totalYieldNoteHash;
    signal input epochNumber;
    signal input yieldRate;
    signal input nullifier;

    // Private inputs for each position
    signal input claimerPkX, claimerPkY, claimerSk;
    signal input positionValues[4];
    signal input positionTypes[4];
    signal input positionSalts[4];
    signal input lastClaimEpochs[4];
    signal input totalYieldAmount;
    signal input yieldSalt;

    // Verify ownership once
    component claimerOwnership = ProofOfOwnershipStrict();
    claimerOwnership.sk <== claimerSk;
    claimerOwnership.pkX <== claimerPkX;
    claimerOwnership.pkY <== claimerPkY;

    // Verify each position and calculate expected yield
    signal expectedYields[4];
    signal cumulativeExpectedYield[5];
    cumulativeExpectedYield[0] <== 0;

    component positionNotes[4];
    for (var i = 0; i < 4; i++) {
        positionNotes[i] = Poseidon(5);
        positionNotes[i].inputs[0] <== claimerPkX;
        positionNotes[i].inputs[1] <== claimerPkY;
        positionNotes[i].inputs[2] <== positionValues[i];
        positionNotes[i].inputs[3] <== positionTypes[i];
        positionNotes[i].inputs[4] <== positionSalts[i];
        positionNotes[i].out === positionNoteHashes[i];

        signal epochsElapsed;
        epochsElapsed <== epochNumber - lastClaimEpochs[i];
        expectedYields[i] <== positionValues[i] * yieldRate * epochsElapsed / 10000;
        cumulativeExpectedYield[i+1] <== cumulativeExpectedYield[i] + expectedYields[i];
    }

    // Verify total yield claimed
    component totalYieldCheck = LessEqThan(128);
    totalYieldCheck.in[0] <== totalYieldAmount;
    totalYieldCheck.in[1] <== cumulativeExpectedYield[4];
    totalYieldCheck.out === 1;

    // Verify yield note
    component yieldNote = PoseidonRegularNote();
    yieldNote.pkX <== claimerPkX;
    yieldNote.pkY <== claimerPkY;
    yieldNote.value <== totalYieldAmount;
    yieldNote.tokenType <== 1;
    yieldNote.salt <== yieldSalt;
    yieldNote.out === totalYieldNoteHash;
}

component main {public [positionNoteHash, yieldNoteHash, yieldPoolCommitment,
    newPoolCommitment, epochNumber, yieldRate, nullifier]} = YieldClaim();
```

### Key Constraints

1. **Ownership Verification**: Claimer proves control via secret key
2. **Position Validity**: Position note exists and is owned by claimer
3. **Epoch Calculation**: Yield computed for elapsed epochs
4. **Rate Application**: Yield rate correctly applied to position value
5. **Pool Solvency**: Yield pool has sufficient funds
6. **Double-Claim Prevention**: Nullifier unique per epoch range

## Effects

| Aspect | Impact |
|--------|--------|
| **Earnings Privacy** | Yield amounts hidden from observers |
| **Position Inference** | Cannot calculate underlying positions from yield |
| **Tax Privacy** | Yield events not publicly visible |
| **Strategy Concealment** | Yield sources remain confidential |
| **Fair Distribution** | Cryptographically verified entitlement |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Double Claiming** | Epoch-based nullifier prevents duplicate claims |
| **Yield Inflation** | Pool solvency check ensures available funds |
| **Rate Manipulation** | Yield rate set by governance, not user |
| **Position Spoofing** | Position note hash verification |
| **Time Manipulation** | Epoch number from consensus, not user |
| **Partial Claim Abuse** | Minimum claim thresholds |

## Implementation Challenges

1. **Epoch Management**
   - Determining epoch boundaries
   - Handling epoch transitions during claims
   - Historical yield rate tracking

2. **Pool Funding**
   - How yield pool is funded
   - Protocol revenue distribution
   - Deficit handling

3. **Multiple Position Types**
   - Different yield rates per position type
   - Complex yield calculation formulas
   - Dynamic APY computation

4. **Gas Optimization**
   - Batching multiple claims
   - Merkle proofs for large user sets
   - Efficient accumulator updates

## Derivatives

1. **Auto-Compounding** - Automatically reinvest yield into position without separate claim. Circuit proves yield calculation and position update in single proof, hiding both original position and compounded amount.

2. **Yield Aggregation** - Combine yield from multiple protocols into single claim. Proves entitlement across platforms while hiding individual protocol allocations.

3. **Multi-Protocol Claims** - Claim rewards from various DeFi positions simultaneously. Single proof verifies eligibility across staking, LP, lending positions without revealing individual stakes.

4. **Yield Splitting** - Distribute yield to multiple recipients with hidden split ratios. Useful for shared investment vehicles or automated payments.

5. **Tax-Optimized Claims** - Structure claims across tax years or jurisdictions. Proves yield entitlement while optimizing claim timing for tax efficiency.

## Use Cases

1. **Passive Income Generation**
   - Investor earns yield on DeFi positions
   - Income amount remains private
   - Competitors cannot track earnings

2. **Fund Management**
   - Fund generates yield for clients
   - Individual client allocations hidden
   - Performance metrics kept confidential

3. **Treasury Yield**
   - DAO treasury earns protocol revenue
   - Yield amounts hidden from governance attackers
   - Distribution managed privately

4. **Reward Distribution**
   - Protocol distributes rewards to users
   - Individual reward amounts private
   - Fair distribution cryptographically proven

## Real-World Products & User Experience

See: [Yield Claim - Real-World Products](../../product/e-defi/e9-yield-products.md)
---

[Back to Index](../../README.md)
