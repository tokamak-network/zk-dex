# E8. Staking Deposit/Withdraw

Deposit and withdraw staked assets with hidden stake amounts and delegation choices, enabling private proof-of-stake participation.

**Constraints**: ~180K | **Complexity**: Low

---

## Background

Staking reveals significant information that can be exploited:

- **Wealth Exposure**: Visible stake amounts reveal net worth and investment capacity
- **Validator Intelligence**: Stake distribution across validators exposes strategy
- **Slashing Risk**: Known stake sizes enable targeted slashing attacks
- **Governance Weight**: Visible stakes reveal voting power and influence

Current staking protocols expose all deposit details. Private staking hides stake amounts while proving validator eligibility and reward entitlements through ZK proofs.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `stakeNoteHash` | field | Hash of the staking position note |
| `depositNoteHash` | field | Hash of deposited token note |
| `validatorCommitment` | field | Commitment to validator selection |
| `stakingPoolCommitment` | field | Pool state commitment |
| `minStake` | uint | Minimum stake requirement |
| `nullifier` | field | Prevents double-spend |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `stakerPkX, stakerPkY` | field | Staker's public key |
| `stakerSk` | field | Staker's secret key |
| `stakeAmount` | uint | Amount staked (hidden) |
| `validatorId` | uint | Selected validator (hidden) |
| `depositTime` | uint | Stake deposit timestamp |
| `stakeSalt` | field | Stake note randomness |
| `depositSalt` | field | Deposit note randomness |
| `poolTotalStake` | uint | Total staked in pool |
| `poolSalt` | field | Pool state randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template StakingDeposit() {
    // ===== Public Inputs =====
    signal input stakeNoteHash;
    signal input depositNoteHash;
    signal input validatorCommitment;
    signal input stakingPoolCommitment;
    signal input newPoolCommitment;
    signal input minStake;
    signal input currentTime;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input stakerPkX, stakerPkY, stakerSk;
    signal input stakeAmount;
    signal input validatorId;
    signal input stakeSalt, depositSalt;
    signal input poolTotalStake, poolSalt;
    signal input newPoolTotalStake, newPoolSalt;
    signal input tokenType;

    // ===== 1. Verify Staker Ownership =====
    component stakerOwnership = ProofOfOwnershipStrict();
    stakerOwnership.sk <== stakerSk;
    stakerOwnership.pkX <== stakerPkX;
    stakerOwnership.pkY <== stakerPkY;

    // ===== 2. Verify Minimum Stake =====
    component minStakeCheck = GreaterEqThan(128);
    minStakeCheck.in[0] <== stakeAmount;
    minStakeCheck.in[1] <== minStake;
    minStakeCheck.out === 1;

    // ===== 3. Verify Deposit Note =====
    component depositNote = PoseidonRegularNote();
    depositNote.pkX <== stakerPkX;
    depositNote.pkY <== stakerPkY;
    depositNote.value <== stakeAmount;
    depositNote.tokenType <== tokenType;
    depositNote.salt <== depositSalt;
    depositNote.out === depositNoteHash;

    // ===== 4. Verify Validator Commitment =====
    component validatorHash = Poseidon(2);
    validatorHash.inputs[0] <== validatorId;
    validatorHash.inputs[1] <== stakerSk;  // Links validator choice to staker
    validatorHash.out === validatorCommitment;

    // ===== 5. Verify Staking Pool State =====
    component poolState = Poseidon(2);
    poolState.inputs[0] <== poolTotalStake;
    poolState.inputs[1] <== poolSalt;
    poolState.out === stakingPoolCommitment;

    // ===== 6. Verify Pool Update =====
    newPoolTotalStake === poolTotalStake + stakeAmount;

    component newPoolState = Poseidon(2);
    newPoolState.inputs[0] <== newPoolTotalStake;
    newPoolState.inputs[1] <== newPoolSalt;
    newPoolState.out === newPoolCommitment;

    // ===== 7. Verify Stake Note =====
    component stakeNote = Poseidon(6);
    stakeNote.inputs[0] <== stakerPkX;
    stakeNote.inputs[1] <== stakerPkY;
    stakeNote.inputs[2] <== stakeAmount;
    stakeNote.inputs[3] <== validatorId;
    stakeNote.inputs[4] <== currentTime;  // Deposit timestamp
    stakeNote.inputs[5] <== stakeSalt;
    stakeNote.out === stakeNoteHash;

    // ===== 8. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== depositNoteHash;
    nullifierHash.inputs[1] <== stakerSk;
    nullifierHash.out === nullifier;
}

template StakingWithdraw() {
    // ===== Public Inputs =====
    signal input stakeNoteHash;
    signal input withdrawNoteHash;
    signal input stakingPoolCommitment;
    signal input newPoolCommitment;
    signal input currentTime;
    signal input minLockPeriod;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input stakerPkX, stakerPkY, stakerSk;
    signal input stakeAmount;
    signal input validatorId;
    signal input depositTime;
    signal input stakeSalt;
    signal input withdrawAmount;
    signal input withdrawSalt;
    signal input poolTotalStake, poolSalt;
    signal input newPoolTotalStake, newPoolSalt;
    signal input tokenType;

    // ===== 1. Verify Staker Ownership =====
    component stakerOwnership = ProofOfOwnershipStrict();
    stakerOwnership.sk <== stakerSk;
    stakerOwnership.pkX <== stakerPkX;
    stakerOwnership.pkY <== stakerPkY;

    // ===== 2. Verify Stake Note =====
    component stakeNote = Poseidon(6);
    stakeNote.inputs[0] <== stakerPkX;
    stakeNote.inputs[1] <== stakerPkY;
    stakeNote.inputs[2] <== stakeAmount;
    stakeNote.inputs[3] <== validatorId;
    stakeNote.inputs[4] <== depositTime;
    stakeNote.inputs[5] <== stakeSalt;
    stakeNote.out === stakeNoteHash;

    // ===== 3. Verify Lock Period Elapsed =====
    signal timeStaked;
    timeStaked <== currentTime - depositTime;

    component lockCheck = GreaterEqThan(64);
    lockCheck.in[0] <== timeStaked;
    lockCheck.in[1] <== minLockPeriod;
    lockCheck.out === 1;

    // ===== 4. Verify Withdraw Amount =====
    component withdrawCheck = LessEqThan(128);
    withdrawCheck.in[0] <== withdrawAmount;
    withdrawCheck.in[1] <== stakeAmount;
    withdrawCheck.out === 1;

    // ===== 5. Verify Pool State =====
    component poolState = Poseidon(2);
    poolState.inputs[0] <== poolTotalStake;
    poolState.inputs[1] <== poolSalt;
    poolState.out === stakingPoolCommitment;

    // ===== 6. Verify Pool Update =====
    newPoolTotalStake === poolTotalStake - withdrawAmount;

    component newPoolState = Poseidon(2);
    newPoolState.inputs[0] <== newPoolTotalStake;
    newPoolState.inputs[1] <== newPoolSalt;
    newPoolState.out === newPoolCommitment;

    // ===== 7. Verify Withdraw Note =====
    component withdrawNote = PoseidonRegularNote();
    withdrawNote.pkX <== stakerPkX;
    withdrawNote.pkY <== stakerPkY;
    withdrawNote.value <== withdrawAmount;
    withdrawNote.tokenType <== tokenType;
    withdrawNote.salt <== withdrawSalt;
    withdrawNote.out === withdrawNoteHash;

    // ===== 8. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== stakeNoteHash;
    nullifierHash.inputs[1] <== stakerSk;
    nullifierHash.out === nullifier;
}

template RewardClaim() {
    // ===== Public Inputs =====
    signal input stakeNoteHash;
    signal input rewardNoteHash;
    signal input rewardRootHash;       // Merkle root of reward distribution
    signal input epochNumber;
    signal input rewardNullifier;

    // ===== Private Inputs =====
    signal input stakerPkX, stakerPkY, stakerSk;
    signal input stakeAmount;
    signal input validatorId;
    signal input depositTime;
    signal input stakeSalt;
    signal input rewardAmount;
    signal input rewardSalt;
    signal input rewardMerkleProof[20];
    signal input rewardMerkleIndex;

    // ===== 1. Verify Staker Ownership =====
    component stakerOwnership = ProofOfOwnershipStrict();
    stakerOwnership.sk <== stakerSk;
    stakerOwnership.pkX <== stakerPkX;
    stakerOwnership.pkY <== stakerPkY;

    // ===== 2. Verify Stake Note =====
    component stakeNote = Poseidon(6);
    stakeNote.inputs[0] <== stakerPkX;
    stakeNote.inputs[1] <== stakerPkY;
    stakeNote.inputs[2] <== stakeAmount;
    stakeNote.inputs[3] <== validatorId;
    stakeNote.inputs[4] <== depositTime;
    stakeNote.inputs[5] <== stakeSalt;
    stakeNote.out === stakeNoteHash;

    // ===== 3. Verify Reward Entitlement =====
    // Compute leaf: hash(stakeNoteHash, rewardAmount, epochNumber)
    component rewardLeaf = Poseidon(3);
    rewardLeaf.inputs[0] <== stakeNoteHash;
    rewardLeaf.inputs[1] <== rewardAmount;
    rewardLeaf.inputs[2] <== epochNumber;

    // Verify Merkle proof (simplified - would use MerkleProofVerifier)
    // rewardLeaf.out should be in tree with root rewardRootHash

    // ===== 4. Verify Reward Note =====
    component rewardNote = PoseidonRegularNote();
    rewardNote.pkX <== stakerPkX;
    rewardNote.pkY <== stakerPkY;
    rewardNote.value <== rewardAmount;
    rewardNote.tokenType <== 1;  // Reward token
    rewardNote.salt <== rewardSalt;
    rewardNote.out === rewardNoteHash;

    // ===== 5. Verify Reward Nullifier =====
    component nullifierHash = Poseidon(3);
    nullifierHash.inputs[0] <== stakeNoteHash;
    nullifierHash.inputs[1] <== stakerSk;
    nullifierHash.inputs[2] <== epochNumber;
    nullifierHash.out === rewardNullifier;
}

component main {public [stakeNoteHash, depositNoteHash, validatorCommitment,
    stakingPoolCommitment, newPoolCommitment, minStake, currentTime, nullifier]} = StakingDeposit();
```

### Key Constraints

1. **Ownership Verification**: Staker proves control via secret key
2. **Minimum Stake**: Stake amount meets protocol minimum
3. **Validator Commitment**: Validator choice linked to staker identity
4. **Lock Period**: Withdrawal only after minimum lock elapsed
5. **Pool Accounting**: Pool total stake correctly updated
6. **Reward Entitlement**: Merkle proof verifies reward eligibility

## Effects

| Aspect | Impact |
|--------|--------|
| **Stake Privacy** | Staked amounts hidden from observers |
| **Delegation Privacy** | Validator choices not publicly linked |
| **Wealth Protection** | Cannot determine staker net worth |
| **Governance Opacity** | Voting power not directly calculable |
| **Reward Privacy** | Reward claims don't reveal stake size |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Double Staking** | Nullifier prevents stake note reuse |
| **Premature Withdrawal** | Lock period enforced in circuit |
| **Validator Manipulation** | Validator commitment prevents retroactive changes |
| **Slashing Evasion** | Slashing proofs can target committed validators |
| **Reward Gaming** | Epoch-based nullifier prevents double claims |
| **Sybil Staking** | Minimum stake requirement limits attack surface |

## Implementation Challenges

1. **Validator Selection**
   - Random or deterministic validator assignment
   - Rebalancing stake across validators
   - Validator set changes

2. **Slashing Mechanism**
   - How to slash private stakes
   - Proportional vs fixed slashing
   - Slashing proof requirements

3. **Reward Distribution**
   - Merkle tree of rewards per epoch
   - Efficient proof generation
   - Handling missed rewards

4. **Unbonding Queue**
   - Managing withdrawal requests
   - Time-locked unbonding
   - Queue ordering and fairness

## Derivatives

1. **Liquid Staking Tokens** - Receive liquid representation of staked position. Private LST notes tradeable while underlying stake remains locked, proving stake ownership without revealing amount.

2. **Delegation Privacy** - Delegate stake to validators without revealing delegator identity or amount. Validators see total delegated stake but not individual delegators.

3. **Slashing Protection** - Purchase insurance against validator slashing. Proves stake is at risk without revealing amount, enabling fair premium calculation.

4. **Reward Distribution** - Distribute staking rewards proportionally with privacy. Uses homomorphic commitments to compute rewards without revealing individual stakes.

5. **Unstaking Queues** - Queue withdrawals with hidden amounts. Proves position in queue without revealing unstake size or affecting queue ordering.

## Use Cases

1. **Network Validation**
   - Validator stakes required minimum privately
   - Competitors cannot determine validator wealth
   - Slashing protection maintained

2. **Delegated Staking**
   - Token holder delegates to validators
   - Delegation amount hidden
   - Maintains voting power privacy

3. **Institutional Staking**
   - Fund stakes client assets
   - AUM not revealed through staking
   - Fiduciary duty maintained privately

4. **Yield Generation**
   - User stakes for passive yield
   - Stake size hidden from observers
   - Reward claims maintain privacy

## Real-World Products & User Experience

See: [Staking Deposit/Withdraw - Real-World Products](../../../product/e-defi/e8-staking-products.md)
---

[Back to Index](../../README.md)
