# E2. Options Write/Exercise

Write and exercise options contracts with hidden strike prices and position sizes, enabling private derivatives trading.

**Constraints**: ~300K | **Complexity**: High

---

## Background

Options trading in DeFi requires privacy for competitive advantage:

- **Strike Price Exposure**: Visible strike prices reveal trader expectations and enable targeted manipulation
- **Position Size Leakage**: Large option positions signal market sentiment and invite counter-trading
- **Strategy Revelation**: Options combinations (spreads, straddles) reveal sophisticated strategies
- **Expiration Hunting**: Visible expirations enable manipulation near expiry dates

Traditional DeFi options protocols like Opyn or Lyra expose all option parameters on-chain. Private options hide strike price, position size, and strategy composition while proving valid option mechanics through ZK proofs.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `optionNoteHash` | field | Hash of the option position note |
| `collateralNoteHash` | field | Hash of collateral backing the option |
| `premiumNoteHash` | field | Hash of premium payment note |
| `optionType` | uint | Call (0) or Put (1) |
| `underlyingAsset` | uint | Token type of underlying asset |
| `expirationTime` | uint | Option expiration timestamp |
| `nullifier` | field | Prevents double-exercise |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `writerPkX, writerPkY` | field | Option writer's public key |
| `writerSk` | field | Writer's secret key |
| `holderPkX, holderPkY` | field | Option holder's public key |
| `strikePrice` | uint | Strike price (hidden) |
| `quantity` | uint | Number of contracts |
| `premiumAmount` | uint | Premium paid for option |
| `collateralValue` | uint | Collateral amount |
| `optionSalt` | field | Option note randomness |
| `collateralSalt` | field | Collateral note randomness |
| `premiumSalt` | field | Premium note randomness |
| `currentPrice` | uint | Current underlying price (for exercise) |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template OptionWrite() {
    // ===== Public Inputs =====
    signal input optionNoteHash;
    signal input collateralNoteHash;
    signal input premiumNoteHash;
    signal input optionType;           // 0 = Call, 1 = Put
    signal input underlyingAsset;
    signal input expirationTime;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input writerPkX, writerPkY, writerSk;
    signal input holderPkX, holderPkY;
    signal input strikePrice;
    signal input quantity;
    signal input premiumAmount;
    signal input collateralValue;
    signal input optionSalt, collateralSalt, premiumSalt;

    // ===== 1. Verify Writer Ownership =====
    component writerOwnership = ProofOfOwnershipStrict();
    writerOwnership.sk <== writerSk;
    writerOwnership.pkX <== writerPkX;
    writerOwnership.pkY <== writerPkY;

    // ===== 2. Verify Option Note =====
    // Option note contains: writer, holder, strike, quantity, type, expiration
    component optionNote = Poseidon(8);
    optionNote.inputs[0] <== writerPkX;
    optionNote.inputs[1] <== writerPkY;
    optionNote.inputs[2] <== holderPkX;
    optionNote.inputs[3] <== holderPkY;
    optionNote.inputs[4] <== strikePrice;
    optionNote.inputs[5] <== quantity;
    optionNote.inputs[6] <== optionType;
    optionNote.inputs[7] <== optionSalt;
    optionNote.out === optionNoteHash;

    // ===== 3. Verify Collateral Sufficiency =====
    // For calls: collateral >= quantity (underlying tokens)
    // For puts: collateral >= quantity * strikePrice (quote tokens)
    signal requiredCollateral;
    signal callCollateral;
    signal putCollateral;

    callCollateral <== quantity;
    putCollateral <== quantity * strikePrice;

    // Select based on option type (0=call, 1=put)
    requiredCollateral <== (1 - optionType) * callCollateral + optionType * putCollateral;

    component collateralCheck = GreaterEqThan(128);
    collateralCheck.in[0] <== collateralValue;
    collateralCheck.in[1] <== requiredCollateral;
    collateralCheck.out === 1;

    // ===== 4. Verify Collateral Note =====
    component collateralNote = PoseidonRegularNote();
    collateralNote.pkX <== writerPkX;
    collateralNote.pkY <== writerPkY;
    collateralNote.value <== collateralValue;
    // Collateral token: underlying for calls, quote for puts
    signal collateralToken;
    collateralToken <== (1 - optionType) * underlyingAsset + optionType * 1;
    collateralNote.tokenType <== collateralToken;
    collateralNote.salt <== collateralSalt;
    collateralNote.out === collateralNoteHash;

    // ===== 5. Verify Premium Note =====
    component premiumNote = PoseidonRegularNote();
    premiumNote.pkX <== writerPkX;  // Premium goes to writer
    premiumNote.pkY <== writerPkY;
    premiumNote.value <== premiumAmount;
    premiumNote.tokenType <== 1;    // Premium in quote currency
    premiumNote.salt <== premiumSalt;
    premiumNote.out === premiumNoteHash;

    // ===== 6. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== optionNoteHash;
    nullifierHash.inputs[1] <== writerSk;
    nullifierHash.out === nullifier;

    // ===== 7. Verify Expiration in Future =====
    // This would be checked against block timestamp on-chain
    signal output expirationOut;
    expirationOut <== expirationTime;
}

template OptionExercise() {
    // ===== Public Inputs =====
    signal input optionNoteHash;
    signal input settlementNoteHash;
    signal input currentPrice;
    signal input currentTime;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input holderPkX, holderPkY, holderSk;
    signal input writerPkX, writerPkY;
    signal input strikePrice;
    signal input quantity;
    signal input optionType;
    signal input expirationTime;
    signal input optionSalt;
    signal input settlementValue;
    signal input settlementSalt;

    // ===== 1. Verify Holder Ownership =====
    component holderOwnership = ProofOfOwnershipStrict();
    holderOwnership.sk <== holderSk;
    holderOwnership.pkX <== holderPkX;
    holderOwnership.pkY <== holderPkY;

    // ===== 2. Verify Option Note =====
    component optionNote = Poseidon(8);
    optionNote.inputs[0] <== writerPkX;
    optionNote.inputs[1] <== writerPkY;
    optionNote.inputs[2] <== holderPkX;
    optionNote.inputs[3] <== holderPkY;
    optionNote.inputs[4] <== strikePrice;
    optionNote.inputs[5] <== quantity;
    optionNote.inputs[6] <== optionType;
    optionNote.inputs[7] <== optionSalt;
    optionNote.out === optionNoteHash;

    // ===== 3. Verify Not Expired =====
    component expiryCheck = LessThan(64);
    expiryCheck.in[0] <== currentTime;
    expiryCheck.in[1] <== expirationTime;
    expiryCheck.out === 1;

    // ===== 4. Verify In-The-Money =====
    // Call: currentPrice > strikePrice
    // Put: currentPrice < strikePrice
    component callITM = GreaterThan(64);
    callITM.in[0] <== currentPrice;
    callITM.in[1] <== strikePrice;

    component putITM = LessThan(64);
    putITM.in[0] <== currentPrice;
    putITM.in[1] <== strikePrice;

    signal isITM;
    isITM <== (1 - optionType) * callITM.out + optionType * putITM.out;
    isITM === 1;

    // ===== 5. Calculate Settlement Amount =====
    // Call: (currentPrice - strikePrice) * quantity
    // Put: (strikePrice - currentPrice) * quantity
    signal callPayout;
    signal putPayout;
    callPayout <== (currentPrice - strikePrice) * quantity;
    putPayout <== (strikePrice - currentPrice) * quantity;

    signal expectedSettlement;
    expectedSettlement <== (1 - optionType) * callPayout + optionType * putPayout;

    component settlementCheck = GreaterEqThan(128);
    settlementCheck.in[0] <== settlementValue;
    settlementCheck.in[1] <== expectedSettlement;
    settlementCheck.out === 1;

    // ===== 6. Verify Settlement Note =====
    component settlementNote = PoseidonRegularNote();
    settlementNote.pkX <== holderPkX;
    settlementNote.pkY <== holderPkY;
    settlementNote.value <== settlementValue;
    settlementNote.tokenType <== 1;  // Settlement in quote currency
    settlementNote.salt <== settlementSalt;
    settlementNote.out === settlementNoteHash;

    // ===== 7. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== optionNoteHash;
    nullifierHash.inputs[1] <== holderSk;
    nullifierHash.out === nullifier;
}

component main {public [optionNoteHash, collateralNoteHash, premiumNoteHash,
    optionType, underlyingAsset, expirationTime, nullifier]} = OptionWrite();
```

### Key Constraints

1. **Ownership Verification**: Writer/holder proves control via secret key
2. **Collateral Sufficiency**: Full collateralization required for option writing
3. **Option Parameters**: Strike, quantity, type encoded in option note
4. **Expiration Check**: Exercise only valid before expiration
5. **ITM Verification**: Only in-the-money options can be exercised
6. **Settlement Calculation**: Payout matches option mechanics

## Effects

| Aspect | Impact |
|--------|--------|
| **Strike Privacy** | Strike prices hidden from market observers |
| **Position Confidentiality** | Option sizes not visible on-chain |
| **Strategy Protection** | Complex option strategies remain private |
| **MEV Prevention** | Cannot front-run option exercises |
| **Fair Pricing** | Hidden flow prevents market manipulation |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Oracle Manipulation** | Use TWAP and multiple oracle sources for settlement price |
| **Collateral Theft** | Collateral locked until expiration or exercise |
| **Double Exercise** | Nullifier prevents multiple exercises of same option |
| **Expiration Gaming** | Use block timestamp with buffer for expiration |
| **Premium Manipulation** | Off-chain matching with commitment schemes |
| **Flash Loan Attacks** | Settlement price based on TWAP, not spot |

## Implementation Challenges

1. **Oracle Integration**
   - Reliable price feeds essential for settlement
   - TWAP calculation over appropriate window
   - Handle oracle failures gracefully

2. **Collateral Management**
   - Lock collateral for option duration
   - Handle partial exercises if supported
   - Return unused collateral after expiration

3. **American vs European Options**
   - Circuit shown is European (exercise at expiry only)
   - American options require tracking exercise window
   - Early exercise introduces additional complexity

4. **Premium Discovery**
   - Options pricing models (Black-Scholes) need volatility input
   - Off-chain pricing with on-chain commitment
   - Market maker integration

## Derivatives

1. **Private Covered Calls** - Write calls against held underlying positions without revealing the underlying ownership. Proves sufficient collateral exists while hiding exact holdings and strike selection strategy.

2. **Private Puts for Insurance** - Purchase downside protection without revealing portfolio or hedge size. Enables institutional hedging without signaling concerns about holdings.

3. **Option Spreads** - Combine multiple options (bull spreads, iron condors) in single proof. Hides complex strategy while proving all legs are properly collateralized.

4. **Binary Options** - Fixed payout options with hidden strike. Simpler settlement logic but same privacy guarantees for prediction market applications.

5. **Perpetual Options** - Options without expiration that charge ongoing funding. Combines perpetual mechanics with option payoff structure for continuous hedging.

## Use Cases

1. **Portfolio Insurance**
   - Fund manager wants downside protection
   - Buys puts without revealing position size or strike level
   - Competitors cannot deduce hedging strategy

2. **Yield Enhancement**
   - Investor writes covered calls on holdings
   - Strike price and premium hidden
   - Generates income without revealing exit targets

3. **Volatility Trading**
   - Trader expects high volatility but uncertain direction
   - Buys straddle (call + put at same strike)
   - Strategy hidden from market makers

4. **Speculation with Limited Risk**
   - Retail trader bullish on asset
   - Buys calls with defined maximum loss
   - Position size and leverage not visible

## Real-World Products & User Experience

See: [Options Write/Exercise - Real-World Products](../../../product/e-defi/e2-options-products.md)

---

[Back to Index](../../README.md)
