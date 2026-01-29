# F4. Loot Box Open

Verifiable random loot box opening with provably fair outcome generation and hidden contents until reveal.

**Constraints**: ~180K | **Complexity**: Medium-High

---

## Background

Loot boxes require trust in randomness and fairness:

- **Verifiable Randomness**: Players must trust that outcomes are not manipulated; VRF provides cryptographic guarantees
- **Predictability Prevention**: If outcomes are predictable, players can game the system or lose trust
- **Hidden Contents**: Contents should only be revealed upon opening; prevents selection of "good" boxes
- **Drop Rate Transparency**: Players deserve to know actual probabilities while outcomes remain unpredictable

Gaming regulators increasingly require provable fairness in randomized rewards. ZK loot boxes provide cryptographic proof that outcomes match committed probabilities without revealing the random seed or outcome until opened.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `boxCommitment` | field | Commitment to the sealed loot box |
| `outcomeCommitment` | field | Commitment to the revealed item(s) |
| `vrfOutput` | field | VRF output proving randomness |
| `vrfProof` | field | VRF proof for verification |
| `boxId` | uint | Unique identifier of the loot box |
| `nullifier` | field | Prevents double-opening |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `ownerPkX, ownerPkY` | field | Box owner's public key |
| `ownerSk` | field | Owner's secret key |
| `boxSalt` | field | Randomness in box commitment |
| `boxType` | uint | Type/tier of loot box |
| `vrfSeed` | field | Seed used for VRF |
| `itemId` | uint | Resulting item from opening |
| `itemRarity` | uint | Rarity tier of result |
| `itemSalt` | field | Randomness for item note |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/vrf/vrf_verify.circom";
include "../utils/comparators.circom";

template LootBoxOpen(NUM_TIERS) {
    // ===== Public Inputs =====
    signal input boxCommitment;
    signal input outcomeCommitment;
    signal input vrfOutput;
    signal input vrfProof;
    signal input boxId;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input ownerPkX, ownerPkY, ownerSk;
    signal input boxSalt;
    signal input boxType;
    signal input vrfSeed;
    signal input itemId;
    signal input itemRarity;
    signal input itemSalt;

    // Drop rate thresholds for each tier (cumulative, out of 10000)
    // Example: [100, 500, 2000, 10000] = 1% legendary, 4% epic, 15% rare, 80% common
    signal input rarityThresholds[NUM_TIERS];

    // ===== 1. Verify Box Commitment =====
    component boxHash = Poseidon(5);
    boxHash.inputs[0] <== ownerPkX;
    boxHash.inputs[1] <== ownerPkY;
    boxHash.inputs[2] <== boxId;
    boxHash.inputs[3] <== boxType;
    boxHash.inputs[4] <== boxSalt;
    boxHash.out === boxCommitment;

    // ===== 2. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== ownerSk;
    ownership.pkX <== ownerPkX;
    ownership.pkY <== ownerPkY;

    // ===== 3. Compute Nullifier =====
    component nullifierCalc = Poseidon(3);
    nullifierCalc.inputs[0] <== boxId;
    nullifierCalc.inputs[1] <== boxSalt;
    nullifierCalc.inputs[2] <== ownerSk;
    nullifierCalc.out === nullifier;

    // ===== 4. Verify VRF =====
    component vrf = VRFVerify();
    vrf.pk[0] <== ownerPkX;
    vrf.pk[1] <== ownerPkY;
    vrf.seed <== vrfSeed;
    vrf.output <== vrfOutput;
    vrf.proof <== vrfProof;

    // VRF seed must include box-specific data to prevent reuse
    component seedHash = Poseidon(3);
    seedHash.inputs[0] <== boxId;
    seedHash.inputs[1] <== boxSalt;
    seedHash.inputs[2] <== ownerSk;
    seedHash.out === vrfSeed;

    // ===== 5. Determine Rarity from VRF Output =====
    // Convert VRF output to range [0, 10000)
    signal vrfMod;
    vrfMod <-- vrfOutput % 10000;

    // Range check
    component rangeCheck = LessThan(64);
    rangeCheck.in[0] <== vrfMod;
    rangeCheck.in[1] <== 10000;
    rangeCheck.out === 1;

    // Verify division
    signal quotient;
    quotient <-- vrfOutput \ 10000;
    vrfOutput === quotient * 10000 + vrfMod;

    // Determine rarity tier
    component tierCheck[NUM_TIERS];
    signal inTier[NUM_TIERS];

    for (var i = 0; i < NUM_TIERS; i++) {
        tierCheck[i] = LessThan(64);
        tierCheck[i].in[0] <== vrfMod;
        tierCheck[i].in[1] <== rarityThresholds[i];

        if (i == 0) {
            inTier[i] <== tierCheck[i].out;
        } else {
            // In this tier if less than threshold[i] but not less than threshold[i-1]
            component prevCheck = GreaterEqThan(64);
            prevCheck.in[0] <== vrfMod;
            prevCheck.in[1] <== rarityThresholds[i-1];
            inTier[i] <== tierCheck[i].out * prevCheck.out;
        }
    }

    // Verify claimed rarity matches VRF result
    signal rarityMatch;
    rarityMatch <== inTier[itemRarity];
    rarityMatch === 1;

    // ===== 6. Create Outcome Note =====
    component outcomeNote = Poseidon(5);
    outcomeNote.inputs[0] <== ownerPkX;
    outcomeNote.inputs[1] <== ownerPkY;
    outcomeNote.inputs[2] <== itemId;
    outcomeNote.inputs[3] <== itemRarity;
    outcomeNote.inputs[4] <== itemSalt;
    outcomeNote.out === outcomeCommitment;
}

component main {public [boxCommitment, outcomeCommitment, vrfOutput, vrfProof, boxId, nullifier]} =
    LootBoxOpen(4);  // 4 rarity tiers: common, rare, epic, legendary
```

### Key Constraints

1. **Box Ownership**: Only the box owner can open it
2. **VRF Validity**: Random outcome must be verifiably generated from seed
3. **Seed Uniqueness**: VRF seed derived from box-specific data; cannot reuse seeds
4. **Rarity Compliance**: Outcome rarity matches VRF output against drop rate thresholds
5. **Single Opening**: Nullifier ensures box can only be opened once

## Effects

| Aspect | Impact |
|--------|--------|
| **Provable Fairness** | Cryptographic proof of unmanipulated randomness |
| **Drop Rate Guarantee** | Players can verify claimed probabilities |
| **Outcome Privacy** | Contents hidden until player chooses to reveal |
| **Anti-Manipulation** | Developers cannot selectively adjust individual outcomes |
| **Regulatory Compliance** | Auditable randomness satisfies gaming regulations |
| **Player Trust** | Transparent mechanics build confidence |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **VRF Seed Manipulation** | Seed derived from committed values; cannot be changed |
| **Outcome Preview** | VRF output not computable without secret key |
| **Selective Opening** | Nullifier prevents trying multiple outcomes |
| **Drop Rate Fraud** | Thresholds can be publicly committed per box type |
| **Replay Attacks** | Box ID and salt make each opening unique |
| **Front-Running** | Opening proof committed before outcome visible |

## Implementation Challenges

1. **VRF Implementation**
   - Need efficient VRF circuit (ECVRF or similar)
   - VRF verification adds significant constraints
   - Consider optimized implementations for specific curves

2. **Drop Rate Commitment**
   - How are drop rates committed and verified?
   - Per-box-type commitments published on-chain
   - Updates require transparency and notice period

3. **Item Generation**
   - VRF determines rarity; how is specific item chosen?
   - Secondary randomness within rarity tier
   - Item pool per rarity must be defined

4. **Box Acquisition**
   - How are boxes initially distributed?
   - Purchase, earn, or airdrop mechanics
   - Anti-sybil measures for free boxes

## Derivatives

1. **Tiered Rarity Systems** - Complex multi-tier drop tables with sub-categories. Circuit supports nested probability distributions (e.g., 5% epic with 20% chance of foil variant). Enables rich item stratification.

2. **Pity Timers** - Guaranteed rare after N opens without one. Circuit tracks opening history via commitment chain. Prevents extended bad luck streaks while maintaining randomness.

3. **Batch Opening** - Open multiple boxes in single proof with combined VRF. More gas-efficient for players with many boxes. Aggregates results into multiple item notes.

4. **Tradeable Sealed Boxes** - Transfer box ownership before opening. Box note can be traded; new owner provides opening proof. Enables box speculation and gifting.

5. **Drop Rate Verification** - Public audit of actual vs. claimed drop rates. Circuit generates proofs aggregatable for statistical analysis. Community can verify developer honesty.

## Use Cases

1. **Blockchain Gaming Rewards**
   - Player completes quest, receives sealed loot box
   - Opens box using their key; VRF determines contents
   - Proves to game server item was fairly generated
   - Can trade sealed boxes on secondary market

2. **NFT Mystery Collections**
   - Artist releases 10,000 mystery boxes
   - Each contains one of 100 possible artworks
   - Buyers can open to reveal or trade sealed
   - Artist proves fair distribution across rarities

3. **Esports Prize Boxes**
   - Tournament winners receive prize boxes
   - Contents range from merchandise to cash prizes
   - Provably fair distribution prevents favoritism accusations
   - Sponsors can verify prize allocation integrity

4. **Regulatory-Compliant Gacha**
   - Mobile game implements gacha with ZK loot boxes
   - Regulators can audit drop rates match claims
   - Players have cryptographic proof of fairness
   - Company demonstrates compliance without revealing algorithms

## Real-World Products & User Experience

See detailed product descriptions and user experiences: [F4. Loot Box Open - Products](../../product/f-nft-gaming/f4-loot-box-products.md)

---

[Back to Index](../../README.md)
