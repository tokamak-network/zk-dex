# E7. Liquidity Add/Remove

Add and remove liquidity from pools with hidden deposit amounts and LP share ownership, enabling private market making.

**Constraints**: ~250K | **Complexity**: Medium

---

## Background

Liquidity provision exposes significant information that can be exploited:

- **Capital Exposure**: Visible LP positions reveal wealth and capital allocation
- **Whale Tracking**: Large LP deposits signal confidence and attract copy-trading
- **IL Calculations**: Known positions enable precise impermanent loss calculations
- **Exit Watching**: Monitored withdrawals can front-run large redemptions

Current AMMs like Uniswap fully expose LP positions. Private liquidity provision hides the deposited amounts while proving correct LP share calculations through ZK proofs.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `lpNoteHash` | field | Hash of the LP position note |
| `token0NoteHash` | field | Hash of token0 deposit note |
| `token1NoteHash` | field | Hash of token1 deposit note |
| `poolStateCommitment` | field | Current pool state commitment |
| `newPoolStateCommitment` | field | Pool state after liquidity change |
| `poolId` | uint | Pool identifier |
| `nullifier` | field | Prevents double-spend |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `lpPkX, lpPkY` | field | Liquidity provider's public key |
| `lpSk` | field | LP's secret key |
| `token0Amount` | uint | Amount of token0 deposited (hidden) |
| `token1Amount` | uint | Amount of token1 deposited (hidden) |
| `lpShareAmount` | uint | LP shares received (hidden) |
| `reserve0` | uint | Pool reserve of token0 |
| `reserve1` | uint | Pool reserve of token1 |
| `totalLpSupply` | uint | Total LP token supply |
| `poolSalt` | field | Pool state randomness |
| `lpNoteSalt` | field | LP note randomness |
| `token0Salt, token1Salt` | field | Token note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template LiquidityAdd() {
    // ===== Public Inputs =====
    signal input lpNoteHash;
    signal input token0NoteHash;
    signal input token1NoteHash;
    signal input poolStateCommitment;
    signal input newPoolStateCommitment;
    signal input poolId;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input lpPkX, lpPkY, lpSk;
    signal input token0Amount, token1Amount;
    signal input lpShareAmount;
    signal input reserve0, reserve1, totalLpSupply;
    signal input newReserve0, newReserve1, newTotalLpSupply;
    signal input poolSalt, newPoolSalt;
    signal input lpNoteSalt, token0Salt, token1Salt;

    // ===== 1. Verify LP Ownership =====
    component lpOwnership = ProofOfOwnershipStrict();
    lpOwnership.sk <== lpSk;
    lpOwnership.pkX <== lpPkX;
    lpOwnership.pkY <== lpPkY;

    // ===== 2. Verify Current Pool State =====
    component poolState = Poseidon(5);
    poolState.inputs[0] <== reserve0;
    poolState.inputs[1] <== reserve1;
    poolState.inputs[2] <== totalLpSupply;
    poolState.inputs[3] <== poolId;
    poolState.inputs[4] <== poolSalt;
    poolState.out === poolStateCommitment;

    // ===== 3. Verify Proportional Deposit =====
    // token0Amount / reserve0 == token1Amount / reserve1
    // Cross multiply: token0Amount * reserve1 == token1Amount * reserve0
    signal leftSide;
    signal rightSide;
    leftSide <== token0Amount * reserve1;
    rightSide <== token1Amount * reserve0;

    // Allow small tolerance for rounding (0.1%)
    signal diff;
    component diffGt = GreaterThan(128);
    diffGt.in[0] <== leftSide;
    diffGt.in[1] <== rightSide;

    signal diffIfGt;
    signal diffIfLt;
    diffIfGt <== leftSide - rightSide;
    diffIfLt <== rightSide - leftSide;
    diff <== diffGt.out * diffIfGt + (1 - diffGt.out) * diffIfLt;

    signal maxDiff;
    maxDiff <== leftSide / 1000;  // 0.1% tolerance

    component toleranceCheck = LessEqThan(128);
    toleranceCheck.in[0] <== diff;
    toleranceCheck.in[1] <== maxDiff;
    toleranceCheck.out === 1;

    // ===== 4. Verify LP Share Calculation =====
    // lpShareAmount = token0Amount * totalLpSupply / reserve0
    // or lpShareAmount = token1Amount * totalLpSupply / reserve1
    signal expectedShares0;
    signal expectedShares1;
    expectedShares0 <== token0Amount * totalLpSupply / reserve0;
    expectedShares1 <== token1Amount * totalLpSupply / reserve1;

    // LP shares should be minimum of the two (protect against imbalanced deposits)
    component sharesMin = LessThan(128);
    sharesMin.in[0] <== expectedShares0;
    sharesMin.in[1] <== expectedShares1;

    signal expectedShares;
    expectedShares <== sharesMin.out * expectedShares0 + (1 - sharesMin.out) * expectedShares1;

    // Allow 0.1% tolerance for rounding
    signal sharesDiff;
    component sharesDiffGt = GreaterThan(128);
    sharesDiffGt.in[0] <== lpShareAmount;
    sharesDiffGt.in[1] <== expectedShares;

    signal sharesDiffIfGt;
    signal sharesDiffIfLt;
    sharesDiffIfGt <== lpShareAmount - expectedShares;
    sharesDiffIfLt <== expectedShares - lpShareAmount;
    sharesDiff <== sharesDiffGt.out * sharesDiffIfGt + (1 - sharesDiffGt.out) * sharesDiffIfLt;

    signal maxSharesDiff;
    maxSharesDiff <== expectedShares / 1000;

    component sharesToleranceCheck = LessEqThan(128);
    sharesToleranceCheck.in[0] <== sharesDiff;
    sharesToleranceCheck.in[1] <== maxSharesDiff + 1;  // +1 for rounding
    sharesToleranceCheck.out === 1;

    // ===== 5. Verify Reserve Updates =====
    newReserve0 === reserve0 + token0Amount;
    newReserve1 === reserve1 + token1Amount;
    newTotalLpSupply === totalLpSupply + lpShareAmount;

    // ===== 6. Verify Token0 Note =====
    component token0Note = PoseidonRegularNote();
    token0Note.pkX <== lpPkX;
    token0Note.pkY <== lpPkY;
    token0Note.value <== token0Amount;
    token0Note.tokenType <== 0;
    token0Note.salt <== token0Salt;
    token0Note.out === token0NoteHash;

    // ===== 7. Verify Token1 Note =====
    component token1Note = PoseidonRegularNote();
    token1Note.pkX <== lpPkX;
    token1Note.pkY <== lpPkY;
    token1Note.value <== token1Amount;
    token1Note.tokenType <== 1;
    token1Note.salt <== token1Salt;
    token1Note.out === token1NoteHash;

    // ===== 8. Verify LP Note =====
    component lpNote = Poseidon(5);
    lpNote.inputs[0] <== lpPkX;
    lpNote.inputs[1] <== lpPkY;
    lpNote.inputs[2] <== lpShareAmount;
    lpNote.inputs[3] <== poolId;
    lpNote.inputs[4] <== lpNoteSalt;
    lpNote.out === lpNoteHash;

    // ===== 9. Verify New Pool State =====
    component newPoolState = Poseidon(5);
    newPoolState.inputs[0] <== newReserve0;
    newPoolState.inputs[1] <== newReserve1;
    newPoolState.inputs[2] <== newTotalLpSupply;
    newPoolState.inputs[3] <== poolId;
    newPoolState.inputs[4] <== newPoolSalt;
    newPoolState.out === newPoolStateCommitment;

    // ===== 10. Verify Nullifier =====
    component nullifierHash = Poseidon(3);
    nullifierHash.inputs[0] <== token0NoteHash;
    nullifierHash.inputs[1] <== token1NoteHash;
    nullifierHash.inputs[2] <== lpSk;
    nullifierHash.out === nullifier;
}

template LiquidityRemove() {
    // ===== Public Inputs =====
    signal input lpNoteHash;
    signal input token0OutputHash;
    signal input token1OutputHash;
    signal input poolStateCommitment;
    signal input newPoolStateCommitment;
    signal input poolId;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input lpPkX, lpPkY, lpSk;
    signal input lpShareAmount;
    signal input lpNoteSalt;
    signal input token0Output, token1Output;
    signal input token0Salt, token1Salt;
    signal input reserve0, reserve1, totalLpSupply;
    signal input newReserve0, newReserve1, newTotalLpSupply;
    signal input poolSalt, newPoolSalt;

    // ===== 1. Verify LP Ownership =====
    component lpOwnership = ProofOfOwnershipStrict();
    lpOwnership.sk <== lpSk;
    lpOwnership.pkX <== lpPkX;
    lpOwnership.pkY <== lpPkY;

    // ===== 2. Verify LP Note =====
    component lpNote = Poseidon(5);
    lpNote.inputs[0] <== lpPkX;
    lpNote.inputs[1] <== lpPkY;
    lpNote.inputs[2] <== lpShareAmount;
    lpNote.inputs[3] <== poolId;
    lpNote.inputs[4] <== lpNoteSalt;
    lpNote.out === lpNoteHash;

    // ===== 3. Verify Current Pool State =====
    component poolState = Poseidon(5);
    poolState.inputs[0] <== reserve0;
    poolState.inputs[1] <== reserve1;
    poolState.inputs[2] <== totalLpSupply;
    poolState.inputs[3] <== poolId;
    poolState.inputs[4] <== poolSalt;
    poolState.out === poolStateCommitment;

    // ===== 4. Verify Token Output Calculations =====
    // token0Output = lpShareAmount * reserve0 / totalLpSupply
    // token1Output = lpShareAmount * reserve1 / totalLpSupply
    signal expectedToken0;
    signal expectedToken1;
    expectedToken0 <== lpShareAmount * reserve0 / totalLpSupply;
    expectedToken1 <== lpShareAmount * reserve1 / totalLpSupply;

    // Outputs should match or be slightly less (rounding in LP favor)
    component token0Check = LessEqThan(128);
    token0Check.in[0] <== token0Output;
    token0Check.in[1] <== expectedToken0;
    token0Check.out === 1;

    component token1Check = LessEqThan(128);
    token1Check.in[0] <== token1Output;
    token1Check.in[1] <== expectedToken1;
    token1Check.out === 1;

    // ===== 5. Verify Reserve Updates =====
    newReserve0 === reserve0 - token0Output;
    newReserve1 === reserve1 - token1Output;
    newTotalLpSupply === totalLpSupply - lpShareAmount;

    // ===== 6. Verify Output Notes =====
    component token0OutputNote = PoseidonRegularNote();
    token0OutputNote.pkX <== lpPkX;
    token0OutputNote.pkY <== lpPkY;
    token0OutputNote.value <== token0Output;
    token0OutputNote.tokenType <== 0;
    token0OutputNote.salt <== token0Salt;
    token0OutputNote.out === token0OutputHash;

    component token1OutputNote = PoseidonRegularNote();
    token1OutputNote.pkX <== lpPkX;
    token1OutputNote.pkY <== lpPkY;
    token1OutputNote.value <== token1Output;
    token1OutputNote.tokenType <== 1;
    token1OutputNote.salt <== token1Salt;
    token1OutputNote.out === token1OutputHash;

    // ===== 7. Verify New Pool State =====
    component newPoolState = Poseidon(5);
    newPoolState.inputs[0] <== newReserve0;
    newPoolState.inputs[1] <== newReserve1;
    newPoolState.inputs[2] <== newTotalLpSupply;
    newPoolState.inputs[3] <== poolId;
    newPoolState.inputs[4] <== newPoolSalt;
    newPoolState.out === newPoolStateCommitment;

    // ===== 8. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== lpNoteHash;
    nullifierHash.inputs[1] <== lpSk;
    nullifierHash.out === nullifier;
}

component main {public [lpNoteHash, token0NoteHash, token1NoteHash,
    poolStateCommitment, newPoolStateCommitment, poolId, nullifier]} = LiquidityAdd();
```

### Key Constraints

1. **Ownership Verification**: LP proves control via secret key
2. **Proportional Deposit**: Token amounts match pool ratio
3. **Share Calculation**: LP shares computed correctly
4. **Reserve Updates**: Pool reserves updated accurately
5. **Pro-rata Withdrawal**: Token outputs proportional to LP share
6. **State Integrity**: Pool state transitions are valid

## Effects

| Aspect | Impact |
|--------|--------|
| **Position Privacy** | LP deposit amounts hidden |
| **Wealth Protection** | Cannot track large LP positions |
| **IL Obscurity** | Impermanent loss calculations not possible |
| **Exit Privacy** | Withdrawals don't signal liquidity removal |
| **Fair Pricing** | Hidden liquidity prevents targeted attacks |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Pool State Manipulation** | Sequencer maintains authoritative state |
| **Share Inflation** | Minimum initial liquidity requirement |
| **Sandwich Attacks** | Hidden amounts prevent targeting |
| **Double Withdrawal** | Nullifier prevents LP share reuse |
| **Rounding Exploits** | Tolerance bounds prevent manipulation |
| **Flash Liquidity** | Same-block add/remove restrictions |

## Implementation Challenges

1. **Pool State Synchronization**
   - Multiple concurrent deposits/withdrawals
   - Ordering and batching considerations
   - State transition atomicity

2. **Initial Liquidity**
   - First deposit sets pool ratio
   - Minimum liquidity lockup
   - Price oracle bootstrapping

3. **Impermanent Loss Tracking**
   - Users need to track their own IL
   - Off-chain calculation tools required
   - Entry price commitment for IL computation

4. **Fee Accrual**
   - How to distribute trading fees privately
   - Fee compounding vs claim mechanism
   - Gas efficiency for fee distribution

## Derivatives

1. **Single-Sided Liquidity** - Deposit only one token and let protocol balance. Circuit proves correct single-sided entry while hiding deposit amount and auto-swap mechanics.

2. **Concentrated Liquidity Positions** - Provide liquidity in specific price ranges a la Uniswap V3. Proves position is within committed range while hiding exact tick boundaries and amounts.

3. **LP Token Privacy** - LP shares represented as private notes for composability. Enables private yield farming, LP staking, and collateralized lending without revealing LP positions.

4. **Impermanent Loss Proofs** - Prove IL amount without revealing position details. Useful for IL insurance claims or tax reporting while maintaining privacy.

5. **Migration Between Pools** - Atomic move liquidity from one pool to another. Single proof handles removal and addition without revealing amounts or temporary state.

## Use Cases

1. **Professional Market Making**
   - Market maker provides significant liquidity
   - Position size hidden from competitors
   - IL exposure not calculable by others

2. **Treasury Diversification**
   - DAO deploys treasury to LP positions
   - Amounts hidden from governance attackers
   - Yield farming without exposure

3. **Retail LP Participation**
   - Small investor provides liquidity
   - Wealth not revealed to blockchain observers
   - Privacy maintained across DeFi activities

4. **Institutional Liquidity**
   - Fund allocates to DeFi liquidity
   - AUM not revealed through LP positions
   - Maintains competitive advantage

## Real-World Products & User Experience

See: [Liquidity Add/Remove - Real-World Products](../../product/e-defi/e7-liquidity-products.md)
---

[Back to Index](../../README.md)
