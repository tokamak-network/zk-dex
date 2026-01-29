# E4. Insurance Buy/Claim

Purchase coverage and submit claims for DeFi insurance products with hidden policy amounts and claim details.

**Constraints**: ~200K | **Complexity**: Medium

---

## Background

DeFi insurance markets require privacy for both policyholder protection and actuarial integrity:

- **Coverage Exposure**: Visible policy amounts reveal portfolio sizes and risk tolerance
- **Claim Signaling**: Public claims can trigger market reactions and front-running
- **Premium Leakage**: Premium amounts expose actuarial assumptions and pricing
- **Fraud Detection Complexity**: Balancing privacy with claim verification is challenging

Current DeFi insurance protocols like Nexus Mutual expose policy details. Private insurance enables coverage without revealing the insured amount or triggering market reactions upon claims.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `policyNoteHash` | field | Hash of the insurance policy note |
| `premiumNoteHash` | field | Hash of premium payment note |
| `poolCommitment` | field | Insurance pool state commitment |
| `riskType` | uint | Type of risk covered (smart contract, peg, etc.) |
| `expirationTime` | uint | Policy expiration timestamp |
| `nullifier` | field | Prevents double-claiming |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `holderPkX, holderPkY` | field | Policyholder's public key |
| `holderSk` | field | Policyholder's secret key |
| `coverageAmount` | uint | Maximum payout amount (hidden) |
| `premiumAmount` | uint | Premium paid (hidden) |
| `deductible` | uint | Claim deductible amount |
| `policyId` | uint | Unique policy identifier |
| `policySalt` | field | Policy note randomness |
| `premiumSalt` | field | Premium note randomness |
| `poolReserves` | uint | Total pool reserves |
| `poolUtilization` | uint | Current pool utilization |
| `poolSalt` | field | Pool state randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template InsuranceBuy() {
    // ===== Public Inputs =====
    signal input policyNoteHash;
    signal input premiumNoteHash;
    signal input poolCommitment;
    signal input newPoolCommitment;
    signal input riskType;
    signal input expirationTime;
    signal input currentTime;

    // ===== Private Inputs =====
    signal input holderPkX, holderPkY, holderSk;
    signal input coverageAmount;
    signal input premiumAmount;
    signal input deductible;
    signal input policyId;
    signal input policySalt, premiumSalt;
    signal input poolReserves, poolUtilization, poolSalt;
    signal input newPoolReserves, newPoolUtilization, newPoolSalt;

    // ===== 1. Verify Policyholder Ownership =====
    component holderOwnership = ProofOfOwnershipStrict();
    holderOwnership.sk <== holderSk;
    holderOwnership.pkX <== holderPkX;
    holderOwnership.pkY <== holderPkY;

    // ===== 2. Verify Pool State =====
    component pool = Poseidon(4);
    pool.inputs[0] <== poolReserves;
    pool.inputs[1] <== poolUtilization;
    pool.inputs[2] <== riskType;
    pool.inputs[3] <== poolSalt;
    pool.out === poolCommitment;

    // ===== 3. Verify Pool Can Cover Policy =====
    // Available capacity = reserves - utilization
    signal availableCapacity;
    availableCapacity <== poolReserves - poolUtilization;

    component capacityCheck = GreaterEqThan(128);
    capacityCheck.in[0] <== availableCapacity;
    capacityCheck.in[1] <== coverageAmount;
    capacityCheck.out === 1;

    // ===== 4. Verify Premium Calculation =====
    // Premium = coverageAmount * riskRate * duration / (365 * 86400)
    // Simplified: premium >= coverageAmount * minRate
    signal minPremium;
    // Minimum 1% annual rate, pro-rated
    signal duration;
    duration <== expirationTime - currentTime;

    // minPremium = coverageAmount * duration * 100 / (365 * 86400 * 10000)
    // Simplified constraint: premium proportional to coverage
    minPremium <== coverageAmount / 100;  // 1% minimum

    component premiumCheck = GreaterEqThan(128);
    premiumCheck.in[0] <== premiumAmount;
    premiumCheck.in[1] <== minPremium;
    premiumCheck.out === 1;

    // ===== 5. Verify Policy Note =====
    component policyNote = Poseidon(8);
    policyNote.inputs[0] <== holderPkX;
    policyNote.inputs[1] <== holderPkY;
    policyNote.inputs[2] <== coverageAmount;
    policyNote.inputs[3] <== deductible;
    policyNote.inputs[4] <== riskType;
    policyNote.inputs[5] <== expirationTime;
    policyNote.inputs[6] <== policyId;
    policyNote.inputs[7] <== policySalt;
    policyNote.out === policyNoteHash;

    // ===== 6. Verify Premium Note =====
    component premiumNote = PoseidonRegularNote();
    premiumNote.pkX <== holderPkX;
    premiumNote.pkY <== holderPkY;
    premiumNote.value <== premiumAmount;
    premiumNote.tokenType <== 1;  // Premium in stablecoin
    premiumNote.salt <== premiumSalt;
    premiumNote.out === premiumNoteHash;

    // ===== 7. Update Pool State =====
    // New utilization = old utilization + coverage amount
    signal expectedNewUtilization;
    expectedNewUtilization <== poolUtilization + coverageAmount;

    // New reserves = old reserves + premium
    signal expectedNewReserves;
    expectedNewReserves <== poolReserves + premiumAmount;

    component newPool = Poseidon(4);
    newPool.inputs[0] <== expectedNewReserves;
    newPool.inputs[1] <== expectedNewUtilization;
    newPool.inputs[2] <== riskType;
    newPool.inputs[3] <== newPoolSalt;
    newPool.out === newPoolCommitment;

    // ===== 8. Verify Expiration in Future =====
    component expiryCheck = GreaterThan(64);
    expiryCheck.in[0] <== expirationTime;
    expiryCheck.in[1] <== currentTime;
    expiryCheck.out === 1;
}

template InsuranceClaim() {
    // ===== Public Inputs =====
    signal input policyNoteHash;
    signal input payoutNoteHash;
    signal input eventProofHash;      // Hash of verified loss event
    signal input poolCommitment;
    signal input newPoolCommitment;
    signal input currentTime;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input holderPkX, holderPkY, holderSk;
    signal input coverageAmount;
    signal input deductible;
    signal input riskType;
    signal input expirationTime;
    signal input policyId;
    signal input policySalt;
    signal input lossAmount;          // Actual loss incurred
    signal input payoutAmount;
    signal input payoutSalt;
    signal input poolReserves, poolUtilization, poolSalt;
    signal input newPoolReserves, newPoolUtilization, newPoolSalt;

    // ===== 1. Verify Policyholder Ownership =====
    component holderOwnership = ProofOfOwnershipStrict();
    holderOwnership.sk <== holderSk;
    holderOwnership.pkX <== holderPkX;
    holderOwnership.pkY <== holderPkY;

    // ===== 2. Verify Policy Note =====
    component policyNote = Poseidon(8);
    policyNote.inputs[0] <== holderPkX;
    policyNote.inputs[1] <== holderPkY;
    policyNote.inputs[2] <== coverageAmount;
    policyNote.inputs[3] <== deductible;
    policyNote.inputs[4] <== riskType;
    policyNote.inputs[5] <== expirationTime;
    policyNote.inputs[6] <== policyId;
    policyNote.inputs[7] <== policySalt;
    policyNote.out === policyNoteHash;

    // ===== 3. Verify Policy Not Expired =====
    component expiryCheck = GreaterEqThan(64);
    expiryCheck.in[0] <== expirationTime;
    expiryCheck.in[1] <== currentTime;
    expiryCheck.out === 1;

    // ===== 4. Verify Payout Calculation =====
    // Payout = min(lossAmount - deductible, coverageAmount)
    signal lossAfterDeductible;
    lossAfterDeductible <== lossAmount - deductible;

    // Ensure loss exceeds deductible
    component deductibleCheck = GreaterThan(128);
    deductibleCheck.in[0] <== lossAmount;
    deductibleCheck.in[1] <== deductible;
    deductibleCheck.out === 1;

    // Payout capped at coverage
    component payoutCap = LessEqThan(128);
    payoutCap.in[0] <== payoutAmount;
    payoutCap.in[1] <== coverageAmount;
    payoutCap.out === 1;

    // Payout should not exceed loss after deductible
    component payoutLossCheck = LessEqThan(128);
    payoutLossCheck.in[0] <== payoutAmount;
    payoutLossCheck.in[1] <== lossAfterDeductible;
    payoutLossCheck.out === 1;

    // ===== 5. Verify Pool State =====
    component pool = Poseidon(4);
    pool.inputs[0] <== poolReserves;
    pool.inputs[1] <== poolUtilization;
    pool.inputs[2] <== riskType;
    pool.inputs[3] <== poolSalt;
    pool.out === poolCommitment;

    // ===== 6. Verify Pool Can Pay Claim =====
    component reserveCheck = GreaterEqThan(128);
    reserveCheck.in[0] <== poolReserves;
    reserveCheck.in[1] <== payoutAmount;
    reserveCheck.out === 1;

    // ===== 7. Verify Payout Note =====
    component payoutNote = PoseidonRegularNote();
    payoutNote.pkX <== holderPkX;
    payoutNote.pkY <== holderPkY;
    payoutNote.value <== payoutAmount;
    payoutNote.tokenType <== 1;
    payoutNote.salt <== payoutSalt;
    payoutNote.out === payoutNoteHash;

    // ===== 8. Update Pool State =====
    signal expectedNewReserves;
    expectedNewReserves <== poolReserves - payoutAmount;

    signal expectedNewUtilization;
    expectedNewUtilization <== poolUtilization - coverageAmount;

    component newPool = Poseidon(4);
    newPool.inputs[0] <== expectedNewReserves;
    newPool.inputs[1] <== expectedNewUtilization;
    newPool.inputs[2] <== riskType;
    newPool.inputs[3] <== newPoolSalt;
    newPool.out === newPoolCommitment;

    // ===== 9. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== policyNoteHash;
    nullifierHash.inputs[1] <== holderSk;
    nullifierHash.out === nullifier;
}

component main {public [policyNoteHash, premiumNoteHash, poolCommitment,
    newPoolCommitment, riskType, expirationTime, currentTime]} = InsuranceBuy();
```

### Key Constraints

1. **Ownership Verification**: Policyholder proves identity via secret key
2. **Pool Capacity**: Insurance pool has sufficient reserves for coverage
3. **Premium Adequacy**: Premium meets minimum risk-adjusted rate
4. **Policy Parameters**: Coverage, deductible, expiration encoded correctly
5. **Claim Validity**: Loss exceeds deductible, payout capped at coverage
6. **Pool Solvency**: Reserves sufficient to pay claim

## Effects

| Aspect | Impact |
|--------|--------|
| **Coverage Privacy** | Policy amounts hidden from market |
| **Claim Confidentiality** | Claim details not publicly visible |
| **Premium Privacy** | Actuarial pricing protected |
| **Pool Integrity** | Aggregate solvency verifiable without individual exposure |
| **Fraud Prevention** | Cryptographic proof of loss required |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Fake Loss Events** | Oracle/governance verification of loss events required |
| **Double Claims** | Nullifier prevents multiple claims on same policy |
| **Pool Insolvency** | Circuit verifies reserves before payout |
| **Premium Manipulation** | Minimum premium rates enforced in circuit |
| **Coverage Inflation** | Pool utilization tracking prevents over-coverage |
| **Oracle Gaming** | Multiple event verifiers required for large claims |

## Implementation Challenges

1. **Loss Verification**
   - How to prove loss occurred (smart contract hack, depeg, etc.)
   - Oracle network for event verification
   - Threshold signatures for claim approval

2. **Actuarial Pricing**
   - Risk-based premium calculation
   - Historical loss data integration
   - Dynamic pricing based on pool utilization

3. **Pool Management**
   - Capital efficiency vs solvency
   - Reinsurance integration
   - Liquidity for claims

4. **Claim Assessment**
   - Determining loss amount accurately
   - Partial loss scenarios
   - Dispute resolution mechanism

## Derivatives

1. **Parametric Insurance** - Automatic payout based on verifiable on-chain events (price drop, oracle failure). No claim assessment needed; circuit verifies event occurred and calculates payout based on predefined parameters.

2. **Multi-Peril Coverage** - Single policy covering multiple risk types (smart contract + oracle + depeg). Proves coverage across categories while hiding total exposure per category.

3. **Insurance Pools** - LP-style participation in insurance capital with hidden stake sizes. Enables private underwriting with proportional premium sharing.

4. **Claim Verification Proofs** - Third-party loss assessors submit proofs of loss without revealing claimant identity. Enables professional loss adjustment while preserving privacy.

5. **Premium Calculation Proofs** - Actuarial models run privately with proof of fair pricing. Insurers prove premium is correctly calculated without revealing model parameters.

## Use Cases

1. **Smart Contract Coverage**
   - Protocol holds treasury in DeFi
   - Buys insurance against smart contract exploit
   - Coverage amount hidden to prevent targeted attacks

2. **Stablecoin Depeg Protection**
   - Institution holds large stablecoin position
   - Purchases depeg insurance privately
   - Claim doesn't trigger market panic

3. **Oracle Failure Insurance**
   - DeFi protocol protects against oracle manipulation
   - Coverage terms hidden from potential attackers
   - Automatic parametric payout on oracle failure

4. **Liquidation Insurance**
   - Leveraged trader buys protection against liquidation
   - Policy details hidden from liquidation bots
   - Claim pays difference between liquidation and fair price

## Real-World Products & User Experience

See: [Insurance Buy/Claim - Real-World Products](../../../product/e-defi/e4-insurance-products.md)
---

[Back to Index](../../README.md)
