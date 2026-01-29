# E6. Bond Issue/Redeem

Issue and redeem fixed-income bonds with hidden principal amounts and yields, enabling private debt markets.

**Constraints**: ~200K | **Complexity**: Medium

---

## Background

Bond markets require privacy for both issuers and investors:

- **Funding Exposure**: Visible bond issuance reveals funding needs and financial health
- **Yield Discovery**: Published yields expose cost of capital and creditworthiness
- **Position Concentration**: Large bond holdings signal investment strategy
- **Maturity Pressure**: Known maturity dates create refinancing risk awareness

Traditional DeFi lending protocols expose all terms. Private bonds enable fixed-income instruments where principal, yield, and maturity can remain confidential while proving payment obligations are met.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `bondNoteHash` | field | Hash of the bond instrument note |
| `principalNoteHash` | field | Hash of principal payment note |
| `issuerCommitment` | field | Commitment to issuer identity |
| `maturityTime` | uint | Bond maturity timestamp |
| `bondType` | uint | Zero-coupon (0) or Coupon-bearing (1) |
| `nullifier` | field | Prevents double-redemption |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `issuerPkX, issuerPkY` | field | Bond issuer's public key |
| `issuerSk` | field | Issuer's secret key |
| `holderPkX, holderPkY` | field | Bondholder's public key |
| `principalAmount` | uint | Bond principal amount (hidden) |
| `couponRate` | uint | Annual coupon rate in basis points |
| `yieldToMaturity` | uint | Effective yield (hidden) |
| `issuePrice` | uint | Price paid at issuance |
| `bondId` | uint | Unique bond identifier |
| `bondSalt` | field | Bond note randomness |
| `principalSalt` | field | Principal note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template BondIssue() {
    // ===== Public Inputs =====
    signal input bondNoteHash;
    signal input principalNoteHash;
    signal input issuerCommitment;
    signal input maturityTime;
    signal input bondType;           // 0 = Zero-coupon, 1 = Coupon
    signal input currentTime;

    // ===== Private Inputs =====
    signal input issuerPkX, issuerPkY, issuerSk;
    signal input holderPkX, holderPkY;
    signal input principalAmount;
    signal input couponRate;         // Basis points (e.g., 500 = 5%)
    signal input issuePrice;
    signal input bondId;
    signal input bondSalt, principalSalt;

    // ===== 1. Verify Issuer Ownership =====
    component issuerOwnership = ProofOfOwnershipStrict();
    issuerOwnership.sk <== issuerSk;
    issuerOwnership.pkX <== issuerPkX;
    issuerOwnership.pkY <== issuerPkY;

    // ===== 2. Verify Issuer Commitment =====
    component issuerHash = Poseidon(2);
    issuerHash.inputs[0] <== issuerPkX;
    issuerHash.inputs[1] <== issuerPkY;
    issuerHash.out === issuerCommitment;

    // ===== 3. Verify Maturity in Future =====
    component maturityCheck = GreaterThan(64);
    maturityCheck.in[0] <== maturityTime;
    maturityCheck.in[1] <== currentTime;
    maturityCheck.out === 1;

    // ===== 4. Verify Issue Price Reasonable =====
    // For zero-coupon: issuePrice < principalAmount (discount)
    // For coupon: issuePrice ~= principalAmount (par or premium)
    signal maxIssuePrice;
    maxIssuePrice <== principalAmount + principalAmount / 10;  // Max 110% of principal

    component priceCheck = LessEqThan(128);
    priceCheck.in[0] <== issuePrice;
    priceCheck.in[1] <== maxIssuePrice;
    priceCheck.out === 1;

    // Zero-coupon bonds must be issued at discount
    signal zeroCouponCheck;
    component discountCheck = LessThan(128);
    discountCheck.in[0] <== issuePrice;
    discountCheck.in[1] <== principalAmount;
    zeroCouponCheck <== (1 - bondType) * discountCheck.out + bondType;
    zeroCouponCheck === 1;

    // ===== 5. Verify Coupon Rate for Coupon Bonds =====
    // Coupon bonds should have non-zero coupon rate
    signal couponBondCheck;
    component couponNonZero = GreaterThan(32);
    couponNonZero.in[0] <== couponRate;
    couponNonZero.in[1] <== 0;
    couponBondCheck <== (1 - bondType) + bondType * couponNonZero.out;
    couponBondCheck === 1;

    // ===== 6. Verify Bond Note =====
    component bondNote = Poseidon(8);
    bondNote.inputs[0] <== issuerPkX;
    bondNote.inputs[1] <== issuerPkY;
    bondNote.inputs[2] <== holderPkX;
    bondNote.inputs[3] <== holderPkY;
    bondNote.inputs[4] <== principalAmount;
    bondNote.inputs[5] <== couponRate;
    bondNote.inputs[6] <== maturityTime;
    bondNote.inputs[7] <== bondSalt;
    bondNote.out === bondNoteHash;

    // ===== 7. Verify Principal Note (paid by holder to issuer) =====
    component principalNote = PoseidonRegularNote();
    principalNote.pkX <== issuerPkX;
    principalNote.pkY <== issuerPkY;
    principalNote.value <== issuePrice;
    principalNote.tokenType <== 1;  // Stablecoin
    principalNote.salt <== principalSalt;
    principalNote.out === principalNoteHash;
}

template BondRedeem() {
    // ===== Public Inputs =====
    signal input bondNoteHash;
    signal input redemptionNoteHash;
    signal input issuerCommitment;
    signal input currentTime;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input issuerPkX, issuerPkY;
    signal input holderPkX, holderPkY, holderSk;
    signal input principalAmount;
    signal input couponRate;
    signal input maturityTime;
    signal input bondSalt;
    signal input redemptionAmount;
    signal input redemptionSalt;

    // ===== 1. Verify Holder Ownership =====
    component holderOwnership = ProofOfOwnershipStrict();
    holderOwnership.sk <== holderSk;
    holderOwnership.pkX <== holderPkX;
    holderOwnership.pkY <== holderPkY;

    // ===== 2. Verify Bond Note =====
    component bondNote = Poseidon(8);
    bondNote.inputs[0] <== issuerPkX;
    bondNote.inputs[1] <== issuerPkY;
    bondNote.inputs[2] <== holderPkX;
    bondNote.inputs[3] <== holderPkY;
    bondNote.inputs[4] <== principalAmount;
    bondNote.inputs[5] <== couponRate;
    bondNote.inputs[6] <== maturityTime;
    bondNote.inputs[7] <== bondSalt;
    bondNote.out === bondNoteHash;

    // ===== 3. Verify Issuer Commitment =====
    component issuerHash = Poseidon(2);
    issuerHash.inputs[0] <== issuerPkX;
    issuerHash.inputs[1] <== issuerPkY;
    issuerHash.out === issuerCommitment;

    // ===== 4. Verify Maturity Reached =====
    component maturityReached = GreaterEqThan(64);
    maturityReached.in[0] <== currentTime;
    maturityReached.in[1] <== maturityTime;
    maturityReached.out === 1;

    // ===== 5. Verify Redemption Amount =====
    // Redemption = principal (accrued interest handled separately)
    redemptionAmount === principalAmount;

    // ===== 6. Verify Redemption Note =====
    component redemptionNote = PoseidonRegularNote();
    redemptionNote.pkX <== holderPkX;
    redemptionNote.pkY <== holderPkY;
    redemptionNote.value <== redemptionAmount;
    redemptionNote.tokenType <== 1;
    redemptionNote.salt <== redemptionSalt;
    redemptionNote.out === redemptionNoteHash;

    // ===== 7. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== bondNoteHash;
    nullifierHash.inputs[1] <== holderSk;
    nullifierHash.out === nullifier;
}

template CouponClaim() {
    // ===== Public Inputs =====
    signal input bondNoteHash;
    signal input couponNoteHash;
    signal input lastCouponTime;
    signal input currentTime;
    signal input couponNullifier;

    // ===== Private Inputs =====
    signal input issuerPkX, issuerPkY;
    signal input holderPkX, holderPkY, holderSk;
    signal input principalAmount;
    signal input couponRate;
    signal input maturityTime;
    signal input bondSalt;
    signal input couponAmount;
    signal input couponSalt;

    // ===== 1. Verify Holder Ownership =====
    component holderOwnership = ProofOfOwnershipStrict();
    holderOwnership.sk <== holderSk;
    holderOwnership.pkX <== holderPkX;
    holderOwnership.pkY <== holderPkY;

    // ===== 2. Verify Bond Note =====
    component bondNote = Poseidon(8);
    bondNote.inputs[0] <== issuerPkX;
    bondNote.inputs[1] <== issuerPkY;
    bondNote.inputs[2] <== holderPkX;
    bondNote.inputs[3] <== holderPkY;
    bondNote.inputs[4] <== principalAmount;
    bondNote.inputs[5] <== couponRate;
    bondNote.inputs[6] <== maturityTime;
    bondNote.inputs[7] <== bondSalt;
    bondNote.out === bondNoteHash;

    // ===== 3. Verify Coupon Period Elapsed =====
    signal couponPeriod;
    couponPeriod <== 31536000;  // 1 year in seconds

    signal timeSinceLastCoupon;
    timeSinceLastCoupon <== currentTime - lastCouponTime;

    component periodCheck = GreaterEqThan(64);
    periodCheck.in[0] <== timeSinceLastCoupon;
    periodCheck.in[1] <== couponPeriod;
    periodCheck.out === 1;

    // ===== 4. Verify Coupon Amount =====
    // couponAmount = principalAmount * couponRate / 10000
    signal expectedCoupon;
    expectedCoupon <== principalAmount * couponRate / 10000;

    couponAmount === expectedCoupon;

    // ===== 5. Verify Coupon Note =====
    component couponNote = PoseidonRegularNote();
    couponNote.pkX <== holderPkX;
    couponNote.pkY <== holderPkY;
    couponNote.value <== couponAmount;
    couponNote.tokenType <== 1;
    couponNote.salt <== couponSalt;
    couponNote.out === couponNoteHash;

    // ===== 6. Verify Coupon Nullifier =====
    component nullifierHash = Poseidon(3);
    nullifierHash.inputs[0] <== bondNoteHash;
    nullifierHash.inputs[1] <== holderSk;
    nullifierHash.inputs[2] <== lastCouponTime;
    nullifierHash.out === couponNullifier;
}

component main {public [bondNoteHash, principalNoteHash, issuerCommitment,
    maturityTime, bondType, currentTime]} = BondIssue();
```

### Key Constraints

1. **Issuer Verification**: Issuer proves identity via secret key
2. **Maturity Validation**: Bond maturity must be in the future at issuance
3. **Price Reasonableness**: Issue price within acceptable bounds
4. **Zero-Coupon Discount**: Zero-coupon bonds must be issued below par
5. **Coupon Rate Validity**: Coupon bonds require non-zero coupon rate
6. **Redemption Timing**: Redemption only after maturity

## Effects

| Aspect | Impact |
|--------|--------|
| **Principal Privacy** | Bond amounts hidden from market |
| **Yield Confidentiality** | Effective yields not exposed |
| **Issuer Protection** | Funding needs not revealed |
| **Investor Privacy** | Bond holdings not visible |
| **Fair Redemption** | Cryptographic proof of maturity |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Issuer Default** | Collateral requirements or credit rating proofs |
| **Double Redemption** | Nullifier prevents multiple redemptions |
| **Early Redemption** | Maturity check enforced in circuit |
| **Coupon Skipping** | Time-based nullifier per coupon period |
| **Rate Manipulation** | Coupon rate fixed at issuance |
| **Sybil Issuance** | Issuer commitment links to identity system |

## Implementation Challenges

1. **Credit Assessment**
   - How to assess creditworthiness privately
   - Integration with credit rating proofs
   - Collateral vs unsecured bonds

2. **Coupon Scheduling**
   - Managing periodic coupon payments
   - Handling missed coupons
   - Accrued interest calculations

3. **Secondary Market**
   - Bond transfer with hidden terms
   - Price discovery for private bonds
   - Liquidity challenges

4. **Default Handling**
   - Detecting issuer default
   - Collateral seizure mechanics
   - Restructuring procedures

## Derivatives

1. **Zero-Coupon Bonds** - Deep discount bonds with no periodic payments. Simpler accounting with single redemption event, proving correct discount rate at issuance.

2. **Convertible Bonds** - Bonds convertible to issuer equity tokens at predefined ratio. Circuit proves conversion terms while hiding trigger price and conversion amount.

3. **Bond Auctions** - Dutch auction for new bond issuance with hidden bids. Proves winning bid without revealing losing bids or total demand.

4. **Yield Curve Construction** - Aggregate private bond data to construct yield curves. Uses secure multi-party computation to derive rates without revealing individual positions.

5. **Bond Rating Proofs** - Third-party rating agencies provide creditworthiness proofs. Issuers prove minimum rating without revealing exact score or assessment details.

## Use Cases

1. **Corporate Debt Issuance**
   - Company needs funding but doesn't want to reveal amount
   - Issues bonds with hidden principal
   - Investors verify creditworthiness without seeing total debt

2. **Treasury Management**
   - DAO issues bonds to fund operations
   - Bond terms hidden from governance attackers
   - Redemption obligations provably met

3. **Fixed Income Portfolio**
   - Investor builds bond ladder for stable income
   - Maturities and amounts hidden
   - Coupon claims prove entitlement without revealing holdings

4. **Bridge Financing**
   - Protocol needs short-term funding
   - Issues discount bonds privately
   - Repayment at maturity without revealing funding gap

## Real-World Products & User Experience

See: [Bond Issue/Redeem - Real-World Products](../../../product/e-defi/e6-bonds-products.md)
---

[Back to Index](../../README.md)
