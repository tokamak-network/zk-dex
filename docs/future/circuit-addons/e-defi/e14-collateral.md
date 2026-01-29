# E14. Collateral Deposit/Withdraw

Deposit and withdraw collateral with hidden amounts, health factors, and liquidation thresholds for private lending positions.

**Constraints**: ~180K | **Complexity**: Low

---

## Background

Collateral management exposes critical financial information:

- **Position Sizing**: Visible collateral reveals borrowing capacity and wealth
- **Health Factor Exposure**: Known health factors enable targeted liquidation
- **Liquidation Thresholds**: Visible thresholds create precision attack vectors
- **Withdrawal Timing**: Large withdrawals signal position changes

Current lending protocols like Aave and Compound expose all collateral parameters. Private collateral management hides amounts while proving sufficient collateralization through ZK proofs.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `collateralNoteHash` | field | Hash of the collateral position note |
| `depositNoteHash` | field | Hash of deposited asset note |
| `lendingPoolCommitment` | field | Lending pool state commitment |
| `collateralTokenType` | uint | Type of collateral asset |
| `minHealthFactor` | uint | Minimum required health factor |
| `nullifier` | field | Prevents double-spend |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `borrowerPkX, borrowerPkY` | field | Borrower's public key |
| `borrowerSk` | field | Borrower's secret key |
| `collateralAmount` | uint | Collateral amount (hidden) |
| `borrowedAmount` | uint | Current debt amount (hidden) |
| `collateralPrice` | uint | Collateral asset price |
| `liquidationThreshold` | uint | Liquidation threshold percentage |
| `healthFactor` | uint | Current health factor (hidden) |
| `collateralSalt` | field | Collateral note randomness |
| `depositSalt` | field | Deposit note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template CollateralDeposit() {
    // ===== Public Inputs =====
    signal input collateralNoteHash;
    signal input depositNoteHash;
    signal input lendingPoolCommitment;
    signal input newPoolCommitment;
    signal input collateralTokenType;
    signal input collateralFactor;      // e.g., 75 for 75% LTV
    signal input nullifier;

    // ===== Private Inputs =====
    signal input borrowerPkX, borrowerPkY, borrowerSk;
    signal input depositAmount;
    signal input existingCollateral;
    signal input borrowedAmount;
    signal input collateralPrice;
    signal input collateralSalt, depositSalt;
    signal input poolTotalCollateral, poolSalt;
    signal input newPoolTotalCollateral, newPoolSalt;

    // ===== 1. Verify Borrower Ownership =====
    component borrowerOwnership = ProofOfOwnershipStrict();
    borrowerOwnership.sk <== borrowerSk;
    borrowerOwnership.pkX <== borrowerPkX;
    borrowerOwnership.pkY <== borrowerPkY;

    // ===== 2. Verify Deposit Note =====
    component depositNote = PoseidonRegularNote();
    depositNote.pkX <== borrowerPkX;
    depositNote.pkY <== borrowerPkY;
    depositNote.value <== depositAmount;
    depositNote.tokenType <== collateralTokenType;
    depositNote.salt <== depositSalt;
    depositNote.out === depositNoteHash;

    // ===== 3. Verify Pool State =====
    component poolState = Poseidon(3);
    poolState.inputs[0] <== poolTotalCollateral;
    poolState.inputs[1] <== collateralTokenType;
    poolState.inputs[2] <== poolSalt;
    poolState.out === lendingPoolCommitment;

    // ===== 4. Calculate New Collateral =====
    signal newCollateralAmount;
    newCollateralAmount <== existingCollateral + depositAmount;

    // ===== 5. Verify New Health Factor =====
    // healthFactor = (collateralValue * collateralFactor / 100) / borrowedAmount
    signal collateralValue;
    collateralValue <== newCollateralAmount * collateralPrice;

    signal adjustedCollateral;
    adjustedCollateral <== collateralValue * collateralFactor / 100;

    // Health factor should be >= 100 (1.0 in basis points)
    // If no debt, health factor is infinite (represented as very high number)
    signal healthFactor;
    signal hasDebt;
    component debtCheck = GreaterThan(128);
    debtCheck.in[0] <== borrowedAmount;
    debtCheck.in[1] <== 0;
    hasDebt <== debtCheck.out;

    // If hasDebt, healthFactor = adjustedCollateral * 100 / borrowedAmount
    // Else healthFactor = max value
    signal healthIfDebt;
    healthIfDebt <== adjustedCollateral * 100 / (borrowedAmount + 1);  // +1 to avoid div by zero

    healthFactor <== hasDebt * healthIfDebt + (1 - hasDebt) * 10000;  // 10000 = 100x if no debt

    component healthCheck = GreaterEqThan(32);
    healthCheck.in[0] <== healthFactor;
    healthCheck.in[1] <== 100;  // Minimum 1.0 health factor
    healthCheck.out === 1;

    // ===== 6. Verify Collateral Note =====
    component collateralNote = Poseidon(6);
    collateralNote.inputs[0] <== borrowerPkX;
    collateralNote.inputs[1] <== borrowerPkY;
    collateralNote.inputs[2] <== newCollateralAmount;
    collateralNote.inputs[3] <== borrowedAmount;
    collateralNote.inputs[4] <== collateralTokenType;
    collateralNote.inputs[5] <== collateralSalt;
    collateralNote.out === collateralNoteHash;

    // ===== 7. Update Pool State =====
    newPoolTotalCollateral === poolTotalCollateral + depositAmount;

    component newPoolState = Poseidon(3);
    newPoolState.inputs[0] <== newPoolTotalCollateral;
    newPoolState.inputs[1] <== collateralTokenType;
    newPoolState.inputs[2] <== newPoolSalt;
    newPoolState.out === newPoolCommitment;

    // ===== 8. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== depositNoteHash;
    nullifierHash.inputs[1] <== borrowerSk;
    nullifierHash.out === nullifier;
}

template CollateralWithdraw() {
    // ===== Public Inputs =====
    signal input collateralNoteHash;
    signal input newCollateralNoteHash;
    signal input withdrawNoteHash;
    signal input lendingPoolCommitment;
    signal input newPoolCommitment;
    signal input collateralTokenType;
    signal input minHealthFactor;       // e.g., 110 for 1.1
    signal input nullifier;

    // ===== Private Inputs =====
    signal input borrowerPkX, borrowerPkY, borrowerSk;
    signal input currentCollateral;
    signal input borrowedAmount;
    signal input withdrawAmount;
    signal input collateralPrice;
    signal input collateralFactor;
    signal input collateralSalt, newCollateralSalt, withdrawSalt;
    signal input poolTotalCollateral, poolSalt;
    signal input newPoolTotalCollateral, newPoolSalt;

    // ===== 1. Verify Borrower Ownership =====
    component borrowerOwnership = ProofOfOwnershipStrict();
    borrowerOwnership.sk <== borrowerSk;
    borrowerOwnership.pkX <== borrowerPkX;
    borrowerOwnership.pkY <== borrowerPkY;

    // ===== 2. Verify Current Collateral Note =====
    component currentNote = Poseidon(6);
    currentNote.inputs[0] <== borrowerPkX;
    currentNote.inputs[1] <== borrowerPkY;
    currentNote.inputs[2] <== currentCollateral;
    currentNote.inputs[3] <== borrowedAmount;
    currentNote.inputs[4] <== collateralTokenType;
    currentNote.inputs[5] <== collateralSalt;
    currentNote.out === collateralNoteHash;

    // ===== 3. Verify Withdraw Amount Valid =====
    component withdrawCheck = LessEqThan(128);
    withdrawCheck.in[0] <== withdrawAmount;
    withdrawCheck.in[1] <== currentCollateral;
    withdrawCheck.out === 1;

    // ===== 4. Calculate New Collateral and Health Factor =====
    signal newCollateralAmount;
    newCollateralAmount <== currentCollateral - withdrawAmount;

    signal newCollateralValue;
    newCollateralValue <== newCollateralAmount * collateralPrice;

    signal adjustedCollateral;
    adjustedCollateral <== newCollateralValue * collateralFactor / 100;

    // Verify health factor after withdrawal
    signal hasDebt;
    component debtCheck = GreaterThan(128);
    debtCheck.in[0] <== borrowedAmount;
    debtCheck.in[1] <== 0;
    hasDebt <== debtCheck.out;

    signal newHealthFactor;
    signal healthIfDebt;
    healthIfDebt <== adjustedCollateral * 100 / (borrowedAmount + 1);

    newHealthFactor <== hasDebt * healthIfDebt + (1 - hasDebt) * 10000;

    component healthCheck = GreaterEqThan(32);
    healthCheck.in[0] <== newHealthFactor;
    healthCheck.in[1] <== minHealthFactor;
    healthCheck.out === 1;

    // ===== 5. Verify New Collateral Note =====
    component newCollateralNote = Poseidon(6);
    newCollateralNote.inputs[0] <== borrowerPkX;
    newCollateralNote.inputs[1] <== borrowerPkY;
    newCollateralNote.inputs[2] <== newCollateralAmount;
    newCollateralNote.inputs[3] <== borrowedAmount;
    newCollateralNote.inputs[4] <== collateralTokenType;
    newCollateralNote.inputs[5] <== newCollateralSalt;
    newCollateralNote.out === newCollateralNoteHash;

    // ===== 6. Verify Withdraw Note =====
    component withdrawNote = PoseidonRegularNote();
    withdrawNote.pkX <== borrowerPkX;
    withdrawNote.pkY <== borrowerPkY;
    withdrawNote.value <== withdrawAmount;
    withdrawNote.tokenType <== collateralTokenType;
    withdrawNote.salt <== withdrawSalt;
    withdrawNote.out === withdrawNoteHash;

    // ===== 7. Update Pool State =====
    component poolState = Poseidon(3);
    poolState.inputs[0] <== poolTotalCollateral;
    poolState.inputs[1] <== collateralTokenType;
    poolState.inputs[2] <== poolSalt;
    poolState.out === lendingPoolCommitment;

    newPoolTotalCollateral === poolTotalCollateral - withdrawAmount;

    component newPoolState = Poseidon(3);
    newPoolState.inputs[0] <== newPoolTotalCollateral;
    newPoolState.inputs[1] <== collateralTokenType;
    newPoolState.inputs[2] <== newPoolSalt;
    newPoolState.out === newPoolCommitment;

    // ===== 8. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== collateralNoteHash;
    nullifierHash.inputs[1] <== borrowerSk;
    nullifierHash.out === nullifier;
}

template CollateralLiquidate() {
    // ===== Public Inputs =====
    signal input collateralNoteHash;
    signal input liquidatorRewardHash;
    signal input remainderNoteHash;
    signal input collateralTokenType;
    signal input currentPrice;
    signal input liquidationThreshold;
    signal input liquidationBonus;

    // ===== Private Inputs =====
    signal input borrowerPkX, borrowerPkY;
    signal input liquidatorPkX, liquidatorPkY, liquidatorSk;
    signal input collateralAmount;
    signal input borrowedAmount;
    signal input collateralSalt;
    signal input debtRepaid;
    signal input collateralSeized;
    signal input remainderAmount;
    signal input rewardSalt, remainderSalt;

    // ===== 1. Verify Liquidator Ownership =====
    component liquidatorOwnership = ProofOfOwnershipStrict();
    liquidatorOwnership.sk <== liquidatorSk;
    liquidatorOwnership.pkX <== liquidatorPkX;
    liquidatorOwnership.pkY <== liquidatorPkY;

    // ===== 2. Verify Collateral Note =====
    component collateralNote = Poseidon(6);
    collateralNote.inputs[0] <== borrowerPkX;
    collateralNote.inputs[1] <== borrowerPkY;
    collateralNote.inputs[2] <== collateralAmount;
    collateralNote.inputs[3] <== borrowedAmount;
    collateralNote.inputs[4] <== collateralTokenType;
    collateralNote.inputs[5] <== collateralSalt;
    collateralNote.out === collateralNoteHash;

    // ===== 3. Verify Position is Liquidatable =====
    signal collateralValue;
    collateralValue <== collateralAmount * currentPrice;

    signal thresholdValue;
    thresholdValue <== borrowedAmount * liquidationThreshold / 100;

    component liquidatable = LessThan(128);
    liquidatable.in[0] <== collateralValue;
    liquidatable.in[1] <== thresholdValue;
    liquidatable.out === 1;

    // ===== 4. Verify Collateral Seized =====
    // collateralSeized = debtRepaid * (100 + liquidationBonus) / 100 / currentPrice
    signal seizedValue;
    seizedValue <== debtRepaid * (100 + liquidationBonus) / 100;

    signal expectedSeized;
    expectedSeized <== seizedValue / currentPrice;

    component seizedCheck = LessEqThan(128);
    seizedCheck.in[0] <== collateralSeized;
    seizedCheck.in[1] <== expectedSeized + 1;  // +1 for rounding
    seizedCheck.out === 1;

    // ===== 5. Verify Reward Note =====
    component rewardNote = PoseidonRegularNote();
    rewardNote.pkX <== liquidatorPkX;
    rewardNote.pkY <== liquidatorPkY;
    rewardNote.value <== collateralSeized;
    rewardNote.tokenType <== collateralTokenType;
    rewardNote.salt <== rewardSalt;
    rewardNote.out === liquidatorRewardHash;

    // ===== 6. Verify Remainder Note =====
    remainderAmount === collateralAmount - collateralSeized;

    component remainderNote = PoseidonRegularNote();
    remainderNote.pkX <== borrowerPkX;
    remainderNote.pkY <== borrowerPkY;
    remainderNote.value <== remainderAmount;
    remainderNote.tokenType <== collateralTokenType;
    remainderNote.salt <== remainderSalt;
    remainderNote.out === remainderNoteHash;
}

component main {public [collateralNoteHash, depositNoteHash, lendingPoolCommitment,
    newPoolCommitment, collateralTokenType, collateralFactor, nullifier]} = CollateralDeposit();
```

### Key Constraints

1. **Ownership Verification**: Borrower proves control via secret key
2. **Health Factor Maintenance**: Position stays above minimum health factor
3. **Withdrawal Limit**: Cannot withdraw more than deposited
4. **Pool Accounting**: Pool state correctly updated
5. **Liquidation Threshold**: Only underwater positions liquidatable
6. **Bonus Calculation**: Liquidation bonus correctly applied

## Effects

| Aspect | Impact |
|--------|--------|
| **Position Privacy** | Collateral amounts hidden from observers |
| **Health Factor Opacity** | Cannot calculate liquidation risk externally |
| **Wealth Protection** | Borrowing capacity not revealed |
| **Liquidation Privacy** | Position details hidden until liquidation |
| **Fair Treatment** | Cryptographic proof of valid operations |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Undercollateralization** | Health factor check enforced in circuit |
| **Liquidation Evasion** | Protocol can prove position underwater |
| **Double Withdrawal** | Nullifier prevents collateral reuse |
| **Price Manipulation** | TWAP and multiple oracle sources |
| **Flash Deposit Attacks** | Minimum deposit holding period |
| **Health Factor Gaming** | Conservative collateral factors |

## Implementation Challenges

1. **Multi-Collateral Support**
   - Different collateral factors per asset
   - Cross-collateral health calculation
   - Asset correlation considerations

2. **Interest Accrual**
   - Tracking interest on borrowed amounts
   - Variable vs fixed rates
   - Interest compounding

3. **Price Feed Reliability**
   - Oracle integration
   - Price staleness detection
   - Circuit breakers for extreme moves

4. **Liquidation Engine**
   - Keeper incentive structure
   - Partial liquidation support
   - Bad debt socialization

## Derivatives

1. **Cross-Collateral Positions** - Use multiple assets as collateral with hidden allocation. Proves combined health factor while hiding individual asset contributions.

2. **Collateral Factor Proofs** - Prove collateral meets minimum factor without revealing amount. Enables solvency attestations for external integrations.

3. **Health Factor Monitoring** - Off-chain monitoring with private alerts. Proves position health without revealing position details.

4. **Collateral Swaps** - Swap collateral type without closing position. Proves equivalent collateralization while hiding old and new amounts.

5. **Isolated vs Cross Margin** - Choose isolation mode per position. Proves margin mode while hiding risk allocation across positions.

## Use Cases

1. **Leveraged Trading**
   - Trader deposits collateral for leverage
   - Collateral amount hidden
   - Health factor private from liquidators

2. **Yield Farming Collateral**
   - User deposits LP tokens as collateral
   - Position size hidden
   - Borrowing capacity not revealed

3. **Institutional Borrowing**
   - Fund deposits collateral for loans
   - AUM not exposed through collateral
   - Credit capacity confidential

4. **Flash Loan Collateral**
   - Temporary collateral for flash operations
   - Deposit and withdrawal amounts hidden
   - Transaction flow not visible

## Real-World Products & User Experience

See: [Collateral Deposit/Withdraw - Real-World Products](../../../product/e-defi/e14-collateral-products.md)
---

[Back to Index](../../README.md)
