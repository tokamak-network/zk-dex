# F3. NFT Fractionalize

Split high-value NFT ownership into tradeable fraction tokens while preserving privacy of original ownership and fraction distribution.

**Constraints**: ~200K | **Complexity**: Medium

---

## Background

NFT fractionalization addresses liquidity and accessibility challenges:

- **Capital Accessibility**: High-value NFTs (>$100K) are inaccessible to most collectors; fractions democratize ownership
- **Liquidity Creation**: Whole NFTs have thin markets; fractions enable continuous price discovery
- **Portfolio Diversification**: Collectors can own pieces of multiple valuable NFTs rather than concentrating in one
- **Privacy Preservation**: Current fractionalization reveals who holds what percentage; ZK fractions hide this

Traditional fractional ownership exists in real estate (REITs) and fine art (Masterworks). Blockchain fractionalization is transparent by default, exposing ownership distributions. ZK fractionalization provides the benefits while protecting ownership privacy.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `nftNoteHash` | field | Hash of the NFT being fractionalized |
| `vaultHash` | field | Hash of the vault holding the NFT |
| `fractionCommitments` | field[N] | Array of fraction note commitments |
| `totalFractions` | uint | Total number of fractions created |
| `nullifier` | field | Nullifier for the original NFT note |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `ownerPkX, ownerPkY` | field | NFT owner's public key |
| `ownerSk` | field | Owner's secret key |
| `nftId` | uint | NFT identifier |
| `collectionAddress` | address | NFT collection contract |
| `nftSalt` | field | NFT note randomness |
| `fractionAmounts` | uint[N] | Amount for each fraction |
| `fractionRecipients` | field[N][2] | Public keys of fraction recipients |
| `fractionSalts` | field[N] | Randomness for each fraction |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template NFTFractionalize(N) {
    // ===== Public Inputs =====
    signal input nftNoteHash;
    signal input vaultHash;
    signal input fractionCommitments[N];
    signal input totalFractions;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input ownerPkX, ownerPkY, ownerSk;
    signal input nftId, collectionAddress, nftSalt;
    signal input fractionAmounts[N];
    signal input fractionRecipientPkX[N], fractionRecipientPkY[N];
    signal input fractionSalts[N];

    // ===== 1. Verify NFT Note =====
    component nftNote = Poseidon(5);
    nftNote.inputs[0] <== ownerPkX;
    nftNote.inputs[1] <== ownerPkY;
    nftNote.inputs[2] <== nftId;
    nftNote.inputs[3] <== collectionAddress;
    nftNote.inputs[4] <== nftSalt;
    nftNote.out === nftNoteHash;

    // ===== 2. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== ownerSk;
    ownership.pkX <== ownerPkX;
    ownership.pkY <== ownerPkY;

    // ===== 3. Compute Nullifier =====
    component nullifierCalc = Poseidon(3);
    nullifierCalc.inputs[0] <== nftId;
    nullifierCalc.inputs[1] <== nftSalt;
    nullifierCalc.inputs[2] <== ownerSk;
    nullifierCalc.out === nullifier;

    // ===== 4. Create Vault Commitment =====
    // Vault holds NFT locked for fractionalization
    component vault = Poseidon(4);
    vault.inputs[0] <== nftId;
    vault.inputs[1] <== collectionAddress;
    vault.inputs[2] <== totalFractions;
    vault.inputs[3] <== nullifier;  // Links vault to original note
    vault.out === vaultHash;

    // ===== 5. Create Fraction Notes =====
    component fractionNotes[N];
    signal fractionSum[N+1];
    fractionSum[0] <== 0;

    for (var i = 0; i < N; i++) {
        // Fraction note: Hash(recipientPkX, recipientPkY, amount, vaultHash, salt)
        fractionNotes[i] = Poseidon(5);
        fractionNotes[i].inputs[0] <== fractionRecipientPkX[i];
        fractionNotes[i].inputs[1] <== fractionRecipientPkY[i];
        fractionNotes[i].inputs[2] <== fractionAmounts[i];
        fractionNotes[i].inputs[3] <== vaultHash;
        fractionNotes[i].inputs[4] <== fractionSalts[i];
        fractionNotes[i].out === fractionCommitments[i];

        // Accumulate fractions
        fractionSum[i+1] <== fractionSum[i] + fractionAmounts[i];
    }

    // ===== 6. Verify Total Equals 100% =====
    // Using basis points: 10000 = 100%
    fractionSum[N] === totalFractions;

    // ===== 7. Verify Non-Zero Fractions =====
    component nonZero[N];
    for (var i = 0; i < N; i++) {
        nonZero[i] = GreaterThan(64);
        nonZero[i].in[0] <== fractionAmounts[i];
        nonZero[i].in[1] <== 0;
        nonZero[i].out === 1;
    }
}

component main {public [nftNoteHash, vaultHash, fractionCommitments, totalFractions, nullifier]} =
    NFTFractionalize(10);  // Support up to 10 initial fraction holders
```

### Key Constraints

1. **NFT Ownership**: Only the NFT owner can initiate fractionalization
2. **Conservation**: Total fractions must equal 100% (or totalFractions basis points)
3. **Non-Zero Fractions**: Each fraction must have positive value
4. **Vault Linkage**: Vault commitment cryptographically links to original NFT
5. **Nullifier Uniqueness**: Original NFT note is consumed; cannot be fractionalized twice

## Effects

| Aspect | Impact |
|--------|--------|
| **Liquidity** | High-value NFTs become tradeable in smaller units |
| **Accessibility** | More collectors can participate in valuable NFT ownership |
| **Ownership Privacy** | Fraction distribution hidden from public |
| **Price Discovery** | Continuous trading of fractions reveals market valuation |
| **Composability** | Fractions can be used in DeFi (collateral, LP) |
| **Governance** | Fraction holders can vote on NFT decisions |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Fraction Inflation** | Conservation constraint ensures no extra fractions created |
| **Reconstitution Attack** | Buyout mechanism requires threshold; cannot force other holders |
| **Vault Manipulation** | Vault hash includes nullifier; immutably linked to specific NFT |
| **Dust Fractions** | Minimum fraction size can be enforced (e.g., 0.1%) |
| **Governance Attacks** | Time-locks on governance actions; quorum requirements |
| **Oracle Manipulation** | Use multiple price sources for buyout valuations |

## Implementation Challenges

1. **Buyout Mechanism**
   - How can someone acquire 100% and reconstitute the NFT?
   - Auction-based buyout with fair value determination
   - Threshold voting by fraction holders to approve sale

2. **Fraction Trading**
   - Need marketplace supporting private fraction transfers
   - Order book or AMM for fraction liquidity
   - Price discovery without revealing holder positions

3. **Revenue Distribution**
   - If NFT generates revenue (royalties, rentals), how to distribute?
   - Claim mechanism where fraction holders prove ownership
   - Batch distribution to reduce gas costs

4. **Governance Coordination**
   - Decisions about the NFT (lending, display, licensing)
   - Voting mechanism with private fraction amounts
   - Delegation and proxy voting support

## Derivatives

1. **Governance Rights Fractions** - Separate economic and governance rights into different fraction types. Some fractions receive revenue share; others control NFT decisions. Allows specialized ownership structures like investment vs. curation rights.

2. **Buyout Mechanisms** - Enable complete reconstitution through fair auction. Circuit proves all fractions collected; original NFT released from vault. Includes price discovery period and minority protection.

3. **Fraction Voting** - Vote on NFT-related decisions with private fraction amounts. Circuit proves fraction ownership and vote validity. Supports quadratic voting, delegation, and time-weighted voting.

4. **Royalty Distribution** - Automatically distribute secondary sale royalties to fraction holders. Circuit verifies fraction ownership at snapshot time. Claimable royalties without revealing individual holdings.

5. **Fraction Redemption** - Convert fractions back to proportional value if NFT is sold. Circuit proves fraction ownership; calculates payout. Handles partial redemptions and price disputes.

## Use Cases

1. **Blue-Chip NFT Investment**
   - CryptoPunk sells for $10M
   - Fractionalized into 10,000 shares at $1,000 each
   - Retail collectors can own piece of iconic NFT
   - Fraction prices trade based on market sentiment

2. **DAO Treasury Diversification**
   - DAO owns valuable NFT from early days
   - Fractionalizes to distribute ownership to token holders
   - Original NFT stays in vault; governance over it shared
   - Creates liquidity event without selling NFT

3. **Artist Patronage**
   - Artist retains 20% of fractions on new work
   - Sells 80% to collectors via auction
   - Artist maintains stake in future appreciation
   - Collectors aligned with artist's long-term success

4. **Metaverse Land Development**
   - Valuable virtual land parcel fractionalized
   - Multiple parties contribute to development costs
   - Revenue from land usage distributed to fraction holders
   - Enables large-scale metaverse projects

## Real-World Products & User Experience

See detailed product descriptions and user experiences: [F3. NFT Fractionalize - Products](../../product/f-nft-gaming/f3-fractionalize-products.md)

---

[Back to Index](../../README.md)
