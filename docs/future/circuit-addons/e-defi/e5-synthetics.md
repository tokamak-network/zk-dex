# E5. Synthetic Asset Mint/Burn

Mint and burn synthetic assets with hidden collateralization ratios and position sizes, enabling private exposure to any asset.

**Constraints**: ~250K | **Complexity**: Medium

---

## Background

Synthetic assets require privacy for both user protection and market integrity:

- **Collateral Exposure**: Visible collateral reveals net worth and risk appetite
- **Position Signaling**: Large synthetic positions signal market views
- **Liquidation Vulnerability**: Known collateralization ratios invite attacks
- **Strategy Leakage**: Synthetic basket compositions reveal investment theses

Current synthetic protocols like Synthetix expose all position details. Private synthetics hide collateral amounts and synthetic exposure while proving adequate collateralization through ZK proofs.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `positionNoteHash` | field | Hash of the synthetic position note |
| `collateralNoteHash` | field | Hash of collateral deposit note |
| `syntheticNoteHash` | field | Hash of minted synthetic token note |
| `syntheticAssetId` | uint | Identifier for the synthetic asset |
| `oraclePrice` | uint | Current oracle price for synthetic |
| `minCollateralRatio` | uint | Minimum required collateral ratio |
| `nullifier` | field | Prevents double-spend |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `minterPkX, minterPkY` | field | Minter's public key |
| `minterSk` | field | Minter's secret key |
| `collateralAmount` | uint | Collateral deposited (hidden) |
| `collateralTokenType` | uint | Type of collateral token |
| `syntheticAmount` | uint | Amount of synthetic minted (hidden) |
| `collateralRatio` | uint | Actual collateral ratio (hidden) |
| `positionSalt` | field | Position note randomness |
| `collateralSalt` | field | Collateral note randomness |
| `syntheticSalt` | field | Synthetic note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template SyntheticMint() {
    // ===== Public Inputs =====
    signal input positionNoteHash;
    signal input collateralNoteHash;
    signal input syntheticNoteHash;
    signal input syntheticAssetId;
    signal input oraclePrice;
    signal input minCollateralRatio;  // e.g., 150 for 150%
    signal input nullifier;

    // ===== Private Inputs =====
    signal input minterPkX, minterPkY, minterSk;
    signal input collateralAmount;
    signal input collateralTokenType;
    signal input syntheticAmount;
    signal input collateralRatio;
    signal input positionSalt, collateralSalt, syntheticSalt;

    // ===== 1. Verify Minter Ownership =====
    component minterOwnership = ProofOfOwnershipStrict();
    minterOwnership.sk <== minterSk;
    minterOwnership.pkX <== minterPkX;
    minterOwnership.pkY <== minterPkY;

    // ===== 2. Calculate Synthetic Value =====
    signal syntheticValue;
    syntheticValue <== syntheticAmount * oraclePrice;

    // ===== 3. Verify Collateral Ratio =====
    // collateralAmount >= syntheticValue * minCollateralRatio / 100
    signal requiredCollateral;
    requiredCollateral <== syntheticValue * minCollateralRatio / 100;

    component collateralCheck = GreaterEqThan(128);
    collateralCheck.in[0] <== collateralAmount;
    collateralCheck.in[1] <== requiredCollateral;
    collateralCheck.out === 1;

    // ===== 4. Verify Claimed Ratio Matches =====
    // collateralRatio = collateralAmount * 100 / syntheticValue
    signal calculatedRatio;
    calculatedRatio <== collateralAmount * 100 / syntheticValue;

    // Allow small tolerance for rounding
    component ratioCheck = GreaterEqThan(32);
    ratioCheck.in[0] <== calculatedRatio;
    ratioCheck.in[1] <== collateralRatio;
    ratioCheck.out === 1;

    // ===== 5. Verify Minimum Ratio Met =====
    component minRatioCheck = GreaterEqThan(32);
    minRatioCheck.in[0] <== collateralRatio;
    minRatioCheck.in[1] <== minCollateralRatio;
    minRatioCheck.out === 1;

    // ===== 6. Verify Position Note =====
    component positionNote = Poseidon(8);
    positionNote.inputs[0] <== minterPkX;
    positionNote.inputs[1] <== minterPkY;
    positionNote.inputs[2] <== syntheticAssetId;
    positionNote.inputs[3] <== syntheticAmount;
    positionNote.inputs[4] <== collateralAmount;
    positionNote.inputs[5] <== collateralTokenType;
    positionNote.inputs[6] <== oraclePrice;  // Entry price snapshot
    positionNote.inputs[7] <== positionSalt;
    positionNote.out === positionNoteHash;

    // ===== 7. Verify Collateral Note =====
    component collateralNote = PoseidonRegularNote();
    collateralNote.pkX <== minterPkX;
    collateralNote.pkY <== minterPkY;
    collateralNote.value <== collateralAmount;
    collateralNote.tokenType <== collateralTokenType;
    collateralNote.salt <== collateralSalt;
    collateralNote.out === collateralNoteHash;

    // ===== 8. Verify Synthetic Note =====
    component syntheticNote = PoseidonRegularNote();
    syntheticNote.pkX <== minterPkX;
    syntheticNote.pkY <== minterPkY;
    syntheticNote.value <== syntheticAmount;
    syntheticNote.tokenType <== syntheticAssetId;
    syntheticNote.salt <== syntheticSalt;
    syntheticNote.out === syntheticNoteHash;

    // ===== 9. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== collateralNoteHash;
    nullifierHash.inputs[1] <== minterSk;
    nullifierHash.out === nullifier;
}

template SyntheticBurn() {
    // ===== Public Inputs =====
    signal input positionNoteHash;
    signal input syntheticNoteHash;
    signal input returnCollateralNoteHash;
    signal input syntheticAssetId;
    signal input oraclePrice;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input minterPkX, minterPkY, minterSk;
    signal input syntheticAmount;
    signal input burnAmount;
    signal input collateralAmount;
    signal input collateralTokenType;
    signal input entryPrice;
    signal input positionSalt, syntheticSalt, returnSalt;
    signal input returnCollateralAmount;

    // ===== 1. Verify Minter Ownership =====
    component minterOwnership = ProofOfOwnershipStrict();
    minterOwnership.sk <== minterSk;
    minterOwnership.pkX <== minterPkX;
    minterOwnership.pkY <== minterPkY;

    // ===== 2. Verify Position Note =====
    component positionNote = Poseidon(8);
    positionNote.inputs[0] <== minterPkX;
    positionNote.inputs[1] <== minterPkY;
    positionNote.inputs[2] <== syntheticAssetId;
    positionNote.inputs[3] <== syntheticAmount;
    positionNote.inputs[4] <== collateralAmount;
    positionNote.inputs[5] <== collateralTokenType;
    positionNote.inputs[6] <== entryPrice;
    positionNote.inputs[7] <== positionSalt;
    positionNote.out === positionNoteHash;

    // ===== 3. Verify Synthetic Note Being Burned =====
    component syntheticNote = PoseidonRegularNote();
    syntheticNote.pkX <== minterPkX;
    syntheticNote.pkY <== minterPkY;
    syntheticNote.value <== burnAmount;
    syntheticNote.tokenType <== syntheticAssetId;
    syntheticNote.salt <== syntheticSalt;
    syntheticNote.out === syntheticNoteHash;

    // ===== 4. Verify Burn Amount Valid =====
    component burnCheck = LessEqThan(128);
    burnCheck.in[0] <== burnAmount;
    burnCheck.in[1] <== syntheticAmount;
    burnCheck.out === 1;

    // ===== 5. Calculate Collateral Return =====
    // Pro-rata: returnCollateral = collateralAmount * burnAmount / syntheticAmount
    signal expectedReturn;
    expectedReturn <== collateralAmount * burnAmount / syntheticAmount;

    component returnCheck = LessEqThan(128);
    returnCheck.in[0] <== returnCollateralAmount;
    returnCheck.in[1] <== expectedReturn;
    returnCheck.out === 1;

    // ===== 6. Verify Return Collateral Note =====
    component returnNote = PoseidonRegularNote();
    returnNote.pkX <== minterPkX;
    returnNote.pkY <== minterPkY;
    returnNote.value <== returnCollateralAmount;
    returnNote.tokenType <== collateralTokenType;
    returnNote.salt <== returnSalt;
    returnNote.out === returnCollateralNoteHash;

    // ===== 7. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== syntheticNoteHash;
    nullifierHash.inputs[1] <== minterSk;
    nullifierHash.out === nullifier;
}

template SyntheticLiquidate() {
    // ===== Public Inputs =====
    signal input positionNoteHash;
    signal input liquidatorRewardHash;
    signal input syntheticAssetId;
    signal input oraclePrice;
    signal input minCollateralRatio;
    signal input liquidationPenalty;  // e.g., 10 for 10%

    // ===== Private Inputs =====
    signal input minterPkX, minterPkY;
    signal input liquidatorPkX, liquidatorPkY, liquidatorSk;
    signal input syntheticAmount;
    signal input collateralAmount;
    signal input collateralTokenType;
    signal input entryPrice;
    signal input positionSalt;
    signal input rewardAmount;
    signal input rewardSalt;

    // ===== 1. Verify Liquidator Ownership =====
    component liquidatorOwnership = ProofOfOwnershipStrict();
    liquidatorOwnership.sk <== liquidatorSk;
    liquidatorOwnership.pkX <== liquidatorPkX;
    liquidatorOwnership.pkY <== liquidatorPkY;

    // ===== 2. Verify Position Note =====
    component positionNote = Poseidon(8);
    positionNote.inputs[0] <== minterPkX;
    positionNote.inputs[1] <== minterPkY;
    positionNote.inputs[2] <== syntheticAssetId;
    positionNote.inputs[3] <== syntheticAmount;
    positionNote.inputs[4] <== collateralAmount;
    positionNote.inputs[5] <== collateralTokenType;
    positionNote.inputs[6] <== entryPrice;
    positionNote.inputs[7] <== positionSalt;
    positionNote.out === positionNoteHash;

    // ===== 3. Verify Position is Undercollateralized =====
    signal syntheticValue;
    syntheticValue <== syntheticAmount * oraclePrice;

    signal currentRatio;
    currentRatio <== collateralAmount * 100 / syntheticValue;

    component underCollateralizedCheck = LessThan(32);
    underCollateralizedCheck.in[0] <== currentRatio;
    underCollateralizedCheck.in[1] <== minCollateralRatio;
    underCollateralizedCheck.out === 1;

    // ===== 4. Calculate Liquidation Reward =====
    signal penaltyAmount;
    penaltyAmount <== collateralAmount * liquidationPenalty / 100;

    component rewardCheck = LessEqThan(128);
    rewardCheck.in[0] <== rewardAmount;
    rewardCheck.in[1] <== penaltyAmount;
    rewardCheck.out === 1;

    // ===== 5. Verify Reward Note =====
    component rewardNote = PoseidonRegularNote();
    rewardNote.pkX <== liquidatorPkX;
    rewardNote.pkY <== liquidatorPkY;
    rewardNote.value <== rewardAmount;
    rewardNote.tokenType <== collateralTokenType;
    rewardNote.salt <== rewardSalt;
    rewardNote.out === liquidatorRewardHash;
}

component main {public [positionNoteHash, collateralNoteHash, syntheticNoteHash,
    syntheticAssetId, oraclePrice, minCollateralRatio, nullifier]} = SyntheticMint();
```

### Key Constraints

1. **Ownership Verification**: Minter proves control via secret key
2. **Collateral Sufficiency**: Collateral meets minimum ratio requirement
3. **Ratio Verification**: Claimed ratio matches actual calculation
4. **Position Integrity**: All position parameters correctly encoded
5. **Burn Validity**: Cannot burn more than minted amount
6. **Liquidation Threshold**: Only undercollateralized positions liquidatable

## Effects

| Aspect | Impact |
|--------|--------|
| **Position Privacy** | Collateral and synthetic amounts hidden |
| **Strategy Confidentiality** | Synthetic exposure not visible |
| **Liquidation Protection** | Collateral ratio hidden from attackers |
| **Market Integrity** | Large mints don't signal market direction |
| **Fair Liquidation** | Only undercollateralized positions liquidatable |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Oracle Manipulation** | Use TWAP and multiple oracle sources |
| **Undercollateralization** | Minimum ratio enforced in circuit |
| **Liquidation Frontrunning** | Position details hidden until liquidation |
| **Double Mint** | Nullifier prevents reuse of collateral |
| **Flash Loan Attacks** | TWAP prices prevent instant manipulation |
| **Cascading Liquidations** | Hidden positions prevent targeted attacks |

## Implementation Challenges

1. **Oracle Infrastructure**
   - Need reliable price feeds for all synthetic assets
   - Cross-chain price aggregation for exotic assets
   - Latency considerations for fast-moving markets

2. **Collateral Management**
   - Multi-collateral support complexity
   - Collateral factor calculations
   - Dynamic ratio adjustments

3. **Liquidation Mechanics**
   - Keeper incentives for private liquidations
   - Partial liquidation support
   - Liquidation auctions

4. **Debt Pool Management**
   - Global debt tracking with privacy
   - Fee distribution mechanism
   - System stability parameters

## Derivatives

1. **Synthetic Index Tokens** - Create basket synthetics tracking indices (DeFi index, NFT index). Proves correct weighting of components while hiding individual exposure to each asset in the basket.

2. **Inverse Synthetics** - Mint synthetics that move opposite to underlying (sETH-inverse). Enables short exposure with privacy, proving correct inverse price tracking.

3. **Leveraged Synthetics** - Mint 2x or 3x leveraged synthetics with hidden leverage ratio. Circuit proves adequate collateral for leveraged exposure without revealing multiplier.

4. **Synthetic Baskets** - User-defined baskets of synthetics in single position. Single collateral pool backs multiple synthetic exposures with hidden allocation.

5. **Cross-Chain Synthetics** - Mint synthetics backed by cross-chain collateral proofs. Bridge verification integrated with minting circuit for multi-chain positions.

## Use Cases

1. **Portfolio Diversification**
   - Investor wants exposure to gold without custody
   - Mints synthetic gold with hidden position size
   - Collateral ratio private from market observers

2. **Hedging Real-World Exposure**
   - Business hedges commodity price risk
   - Mints inverse oil synthetic privately
   - Hedge size doesn't reveal business operations

3. **Index Investing**
   - Trader wants DeFi blue-chip exposure
   - Mints synthetic DeFi index token
   - Allocation hidden from competitors

4. **Cross-Asset Arbitrage**
   - Arbitrageur spots mispricing between synthetic and spot
   - Mints/burns to capture spread
   - Strategy hidden from other arbitrageurs

## Real-World Products & User Experience

See: [Synthetic Asset Mint/Burn - Real-World Products](../../../product/e-defi/e5-synthetics-products.md)
---

[Back to Index](../../README.md)
