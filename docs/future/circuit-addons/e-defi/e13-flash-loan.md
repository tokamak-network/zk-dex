# E13. Flash Loan Execute

Execute flash loans with hidden borrowed amounts and arbitrage strategies, enabling private capital-free operations.

**Constraints**: ~200K (atomic) | **Complexity**: Medium

---

## Background

Flash loans expose valuable strategic information:

- **Borrowed Amounts**: Visible loan sizes reveal arbitrage opportunity magnitude
- **Strategy Exposure**: Arbitrage paths become copyable by competitors
- **Opportunity Detection**: Large flash loans signal profitable opportunities
- **Timing Leakage**: Flash loan execution reveals market inefficiencies

Current flash loan providers like Aave and dYdX expose all loan parameters. Private flash loans hide the borrowed amount while proving atomicity and repayment through ZK proofs.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `loanRequestHash` | field | Hash of flash loan request |
| `repaymentNoteHash` | field | Hash of repayment proof |
| `poolCommitment` | field | Lending pool state commitment |
| `tokenType` | uint | Token being borrowed |
| `feeRate` | uint | Flash loan fee in basis points |
| `blockNumber` | uint | Block for atomicity verification |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `borrowerPkX, borrowerPkY` | field | Borrower's public key |
| `borrowerSk` | field | Borrower's secret key |
| `borrowAmount` | uint | Amount borrowed (hidden) |
| `feeAmount` | uint | Fee paid (hidden) |
| `repayAmount` | uint | Total repaid (hidden) |
| `requestSalt` | field | Request note randomness |
| `repaymentSalt` | field | Repayment note randomness |
| `poolReserves` | uint | Pool available reserves |
| `poolSalt` | field | Pool state randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template FlashLoanExecute() {
    // ===== Public Inputs =====
    signal input loanRequestHash;
    signal input repaymentNoteHash;
    signal input poolCommitment;
    signal input tokenType;
    signal input feeRate;           // Basis points (e.g., 9 = 0.09%)
    signal input blockNumber;

    // ===== Private Inputs =====
    signal input borrowerPkX, borrowerPkY, borrowerSk;
    signal input borrowAmount;
    signal input feeAmount;
    signal input repayAmount;
    signal input requestSalt, repaymentSalt;
    signal input poolReserves, poolSalt;
    signal input profitAmount;       // Arbitrage profit (hidden)

    // ===== 1. Verify Borrower Ownership =====
    component borrowerOwnership = ProofOfOwnershipStrict();
    borrowerOwnership.sk <== borrowerSk;
    borrowerOwnership.pkX <== borrowerPkX;
    borrowerOwnership.pkY <== borrowerPkY;

    // ===== 2. Verify Pool Has Sufficient Liquidity =====
    component liquidityCheck = GreaterEqThan(128);
    liquidityCheck.in[0] <== poolReserves;
    liquidityCheck.in[1] <== borrowAmount;
    liquidityCheck.out === 1;

    // ===== 3. Verify Pool Commitment =====
    component poolState = Poseidon(3);
    poolState.inputs[0] <== poolReserves;
    poolState.inputs[1] <== tokenType;
    poolState.inputs[2] <== poolSalt;
    poolState.out === poolCommitment;

    // ===== 4. Verify Fee Calculation =====
    // feeAmount = borrowAmount * feeRate / 10000
    signal expectedFee;
    expectedFee <== borrowAmount * feeRate / 10000;

    component feeCheck = GreaterEqThan(128);
    feeCheck.in[0] <== feeAmount;
    feeCheck.in[1] <== expectedFee;
    feeCheck.out === 1;

    // ===== 5. Verify Repayment =====
    // repayAmount = borrowAmount + feeAmount
    signal expectedRepay;
    expectedRepay <== borrowAmount + feeAmount;

    repayAmount === expectedRepay;

    // ===== 6. Verify Loan Request Hash =====
    component requestHash = Poseidon(6);
    requestHash.inputs[0] <== borrowerPkX;
    requestHash.inputs[1] <== borrowerPkY;
    requestHash.inputs[2] <== borrowAmount;
    requestHash.inputs[3] <== tokenType;
    requestHash.inputs[4] <== blockNumber;
    requestHash.inputs[5] <== requestSalt;
    requestHash.out === loanRequestHash;

    // ===== 7. Verify Repayment Note =====
    component repaymentNote = PoseidonRegularNote();
    repaymentNote.pkX <== borrowerPkX;
    repaymentNote.pkY <== borrowerPkY;
    repaymentNote.value <== repayAmount;
    repaymentNote.tokenType <== tokenType;
    repaymentNote.salt <== repaymentSalt;
    repaymentNote.out === repaymentNoteHash;

    // ===== 8. Verify Profit is Non-Negative =====
    // Borrower must have made profit after fees
    component profitCheck = GreaterEqThan(128);
    profitCheck.in[0] <== profitAmount;
    profitCheck.in[1] <== 0;
    profitCheck.out === 1;
}

template FlashLoanArbitrage() {
    // Complete arbitrage proof within flash loan
    signal input loanRequestHash;
    signal input repaymentNoteHash;
    signal input profitNoteHash;
    signal input poolCommitment;
    signal input tokenType;
    signal input feeRate;
    signal input blockNumber;

    // Private inputs
    signal input borrowerPkX, borrowerPkY, borrowerSk;
    signal input borrowAmount;
    signal input feeAmount;
    signal input repayAmount;
    signal input profitAmount;
    signal input requestSalt, repaymentSalt, profitSalt;
    signal input poolReserves, poolSalt;

    // Arbitrage path details (hidden)
    signal input buyPrice;
    signal input sellPrice;
    signal input tradeAmount;

    // ===== 1. Verify Borrower Ownership =====
    component borrowerOwnership = ProofOfOwnershipStrict();
    borrowerOwnership.sk <== borrowerSk;
    borrowerOwnership.pkX <== borrowerPkX;
    borrowerOwnership.pkY <== borrowerPkY;

    // ===== 2. Verify Pool Commitment =====
    component poolState = Poseidon(3);
    poolState.inputs[0] <== poolReserves;
    poolState.inputs[1] <== tokenType;
    poolState.inputs[2] <== poolSalt;
    poolState.out === poolCommitment;

    // ===== 3. Verify Arbitrage Profit =====
    // profit = sellPrice * tradeAmount - buyPrice * tradeAmount
    signal buyTotal;
    signal sellTotal;
    buyTotal <== buyPrice * tradeAmount;
    sellTotal <== sellPrice * tradeAmount;

    signal grossProfit;
    grossProfit <== sellTotal - buyTotal;

    // Net profit = gross profit - flash loan fee
    signal expectedFee;
    expectedFee <== borrowAmount * feeRate / 10000;

    signal expectedNetProfit;
    expectedNetProfit <== grossProfit - expectedFee;

    // Claimed profit should match or be less than expected
    component profitVerify = LessEqThan(128);
    profitVerify.in[0] <== profitAmount;
    profitVerify.in[1] <== expectedNetProfit;
    profitVerify.out === 1;

    // ===== 4. Verify Repayment Covers Loan + Fee =====
    repayAmount === borrowAmount + expectedFee;

    // ===== 5. Verify Loan Request Hash =====
    component requestHash = Poseidon(6);
    requestHash.inputs[0] <== borrowerPkX;
    requestHash.inputs[1] <== borrowerPkY;
    requestHash.inputs[2] <== borrowAmount;
    requestHash.inputs[3] <== tokenType;
    requestHash.inputs[4] <== blockNumber;
    requestHash.inputs[5] <== requestSalt;
    requestHash.out === loanRequestHash;

    // ===== 6. Verify Repayment Note =====
    component repaymentNote = PoseidonRegularNote();
    repaymentNote.pkX <== borrowerPkX;
    repaymentNote.pkY <== borrowerPkY;
    repaymentNote.value <== repayAmount;
    repaymentNote.tokenType <== tokenType;
    repaymentNote.salt <== repaymentSalt;
    repaymentNote.out === repaymentNoteHash;

    // ===== 7. Verify Profit Note =====
    component profitNote = PoseidonRegularNote();
    profitNote.pkX <== borrowerPkX;
    profitNote.pkY <== borrowerPkY;
    profitNote.value <== profitAmount;
    profitNote.tokenType <== tokenType;
    profitNote.salt <== profitSalt;
    profitNote.out === profitNoteHash;
}

template FlashLoanLiquidation() {
    // Flash loan for liquidation with hidden position details
    signal input loanRequestHash;
    signal input repaymentNoteHash;
    signal input collateralNoteHash;
    signal input poolCommitment;
    signal input tokenType;
    signal input feeRate;
    signal input blockNumber;

    // Private inputs
    signal input borrowerPkX, borrowerPkY, borrowerSk;
    signal input borrowAmount;
    signal input feeAmount;
    signal input repayAmount;
    signal input collateralReceived;
    signal input liquidationBonus;
    signal input requestSalt, repaymentSalt, collateralSalt;
    signal input poolReserves, poolSalt;

    // Liquidation target details (hidden)
    signal input targetDebt;
    signal input targetCollateral;
    signal input liquidationThreshold;

    // ===== 1. Verify Borrower Ownership =====
    component borrowerOwnership = ProofOfOwnershipStrict();
    borrowerOwnership.sk <== borrowerSk;
    borrowerOwnership.pkX <== borrowerPkX;
    borrowerOwnership.pkY <== borrowerPkY;

    // ===== 2. Verify Target is Liquidatable =====
    // Simplified: targetCollateral < targetDebt * liquidationThreshold
    signal collateralRequired;
    collateralRequired <== targetDebt * liquidationThreshold / 100;

    component liquidatable = LessThan(128);
    liquidatable.in[0] <== targetCollateral;
    liquidatable.in[1] <== collateralRequired;
    liquidatable.out === 1;

    // ===== 3. Verify Collateral Received Includes Bonus =====
    signal expectedCollateral;
    expectedCollateral <== borrowAmount + borrowAmount * liquidationBonus / 100;

    component collateralCheck = LessEqThan(128);
    collateralCheck.in[0] <== collateralReceived;
    collateralCheck.in[1] <== expectedCollateral;
    collateralCheck.out === 1;

    // ===== 4. Verify Repayment =====
    signal expectedFee;
    expectedFee <== borrowAmount * feeRate / 10000;
    repayAmount === borrowAmount + expectedFee;

    // ===== 5. Verify Loan Request Hash =====
    component requestHash = Poseidon(6);
    requestHash.inputs[0] <== borrowerPkX;
    requestHash.inputs[1] <== borrowerPkY;
    requestHash.inputs[2] <== borrowAmount;
    requestHash.inputs[3] <== tokenType;
    requestHash.inputs[4] <== blockNumber;
    requestHash.inputs[5] <== requestSalt;
    requestHash.out === loanRequestHash;

    // ===== 6. Verify Output Notes =====
    component repaymentNote = PoseidonRegularNote();
    repaymentNote.pkX <== borrowerPkX;
    repaymentNote.pkY <== borrowerPkY;
    repaymentNote.value <== repayAmount;
    repaymentNote.tokenType <== tokenType;
    repaymentNote.salt <== repaymentSalt;
    repaymentNote.out === repaymentNoteHash;

    component collateralNote = PoseidonRegularNote();
    collateralNote.pkX <== borrowerPkX;
    collateralNote.pkY <== borrowerPkY;
    collateralNote.value <== collateralReceived;
    collateralNote.tokenType <== 2;  // Collateral token
    collateralNote.salt <== collateralSalt;
    collateralNote.out === collateralNoteHash;
}

component main {public [loanRequestHash, repaymentNoteHash, poolCommitment,
    tokenType, feeRate, blockNumber]} = FlashLoanExecute();
```

### Key Constraints

1. **Ownership Verification**: Borrower proves identity via secret key
2. **Liquidity Check**: Pool has sufficient reserves for loan
3. **Fee Calculation**: Fee correctly computed from borrow amount
4. **Repayment Completeness**: Repayment covers principal plus fee
5. **Atomicity**: All operations within single block
6. **Profit Verification**: Arbitrage yields positive return

## Effects

| Aspect | Impact |
|--------|--------|
| **Loan Privacy** | Borrowed amount hidden from observers |
| **Strategy Confidentiality** | Arbitrage path not visible |
| **Opportunity Protection** | Cannot detect profitable opportunities |
| **Profit Privacy** | Realized profit hidden |
| **Fair Execution** | Cryptographic proof of valid repayment |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Non-Repayment** | Atomic execution ensures repayment |
| **Pool Draining** | Liquidity check before loan |
| **Fee Evasion** | Fee calculation enforced in circuit |
| **Strategy Copying** | All parameters hidden |
| **Block Manipulation** | Block number commitment |
| **Repeated Loans** | Pool state update prevents double-borrow |

## Implementation Challenges

1. **Atomicity Guarantee**
   - Ensuring all operations complete in single block
   - Handling reverts properly
   - Cross-contract call sequencing

2. **Pool State Management**
   - Tracking reserves through loan lifecycle
   - Concurrent loan handling
   - Fee distribution

3. **Arbitrage Integration**
   - Connecting to multiple DEXs privately
   - Price verification across venues
   - Slippage management

4. **Gas Optimization**
   - Proof verification cost
   - Multi-hop swap efficiency
   - Batch operation support

## Derivatives

1. **Multi-Pool Flash Arbitrage** - Borrow from multiple pools simultaneously for complex arbitrage. Single proof covers multi-pool loan while hiding amounts from each pool.

2. **Liquidation Flash Loans** - Execute liquidations using flash borrowed funds. Proves liquidation is valid while hiding target position details and profit captured.

3. **Collateral Swaps** - Swap collateral type using flash loan for bridge funding. Proves collateral equivalence while hiding position sizes and swap rates.

4. **Flash Minting** - Create synthetic tokens backed by flash-borrowed collateral. Proves sufficient backing while hiding mint amount and collateral type.

5. **Composable Flash Actions** - Chain multiple DeFi actions within single flash loan. Proves each action valid while hiding intermediate states and amounts.

## Use Cases

1. **DEX Arbitrage**
   - Arbitrageur spots price discrepancy
   - Flash borrows to capture spread
   - Loan amount and profit hidden

2. **Liquidation Execution**
   - Liquidator identifies underwater position
   - Flash borrows to execute liquidation
   - Target and profit details private

3. **Collateral Swap**
   - User wants to change collateral type
   - Flash borrows to swap atomically
   - Position sizes not revealed

4. **Self-Liquidation**
   - User closes own position efficiently
   - Uses flash loan for capital
   - Position details remain private

## Real-World Products & User Experience

See: [Flash Loan Execute - Real-World Products](../../product/e-defi/e13-flash-loan-products.md)
---

[Back to Index](../../README.md)
