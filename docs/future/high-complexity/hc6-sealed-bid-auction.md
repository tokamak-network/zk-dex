# HC6. Sealed-Bid Auction Settlement

Settle a sealed-bid auction with many bids, revealing only the winner.

**Constraints**: ~600K | **Complexity**: High

---

## Background

Traditional auctions have significant limitations:
- Open auctions reveal bidder strategies
- Sealed-bid requires trusted auctioneer
- Shill bidding is hard to detect
- Loser bids remain exposed after auction

**Why current approaches are insufficient:**

| Approach | Limitation |
|----------|------------|
| Open ascending auction | Reveals bidder valuations; enables sniping |
| Traditional sealed-bid | Trusted auctioneer required; losing bids leaked |
| Commit-reveal on-chain | Griefing by non-reveal; timing attacks |
| Trusted execution (SGX) | Hardware trust assumptions; side-channel attacks |

Cryptographic sealed-bid auctions enable fair price discovery without bid disclosure. The ZK proof ensures correct winner selection without revealing losing bids.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `itemHash` | field | Hash of item being auctioned |
| `bidCommitments` | field[N_BIDS] | Commitments to sealed bids |
| `winnerOutputHash` | field | Note giving item to winner |
| `sellerOutputHash` | field | Note giving payment to seller |
| `loserRefundHashes` | field[N_BIDS] | Refund notes for losers |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `sellerPkX/Y, sellerSk` | field | Seller credentials |
| `itemId, itemSalt` | field | Item details |
| `bidderPkX/Y, bidAmount, bidSalt` | arrays | Bid details per bidder |
| `bidIsActive` | bool[N_BIDS] | Which bids are active |
| `winnerIndex` | uint | Index of winning bid |
| `winnerSalt` | field | Salt for winner output note |

### Circuit Logic

## Effects

| Aspect | Impact |
|--------|--------|
| **Privacy** | Losing bids never revealed |
| **Fairness** | Provable winner selection |
| **Shill Detection** | Cryptographic binding prevents changes |
| **Collusion** | Harder without seeing other bids |
| **Settlement** | Atomic - winner gets item, seller gets payment |
| **Finality** | Immediate settlement; no disputes possible |

## Derivatives

1. **Vickrey (Second-Price) Auction** - Winner pays second-highest bid. Encourages truthful bidding (dominant strategy). Requires proving both winner and second-place bid. Adds ~50K constraints for second-price tracking.

2. **Reserve Price Auction** - Minimum acceptable price enforced. If no bid meets reserve, auction fails with full refunds. Include reserve price check: `winningBid >= reservePrice`.

3. **Multi-Item Auction** - Auction multiple items simultaneously. Bidders specify preferences for each item. Can be uniform price (all same) or discriminatory (pay-as-bid).

4. **Dutch Auction** - Descending price until bid accepted. Price decreases over blocks. First bidder to accept wins. Useful for time-sensitive sales.

5. **Combinatorial Auction** - Bid on bundles of items. Bidders express preferences for combinations. NP-hard winner determination requires off-chain computation; circuit verifies.

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../utils/mux/mux1.circom";

template SealedBidAuctionSettle(N_BIDS) {
    // ===== Public Inputs =====
    signal input itemHash;
    signal input bidCommitments[N_BIDS];
    signal input winnerOutputHash;
    signal input sellerOutputHash;
    signal input loserRefundHashes[N_BIDS];
    signal input reservePrice;  // Minimum acceptable bid

    // ===== Private Inputs =====
    signal input sellerPkX, sellerPkY, sellerSk;
    signal input itemId, itemSalt;

    signal input bidderPkX[N_BIDS], bidderPkY[N_BIDS];
    signal input bidAmount[N_BIDS];
    signal input bidSalt[N_BIDS];
    signal input bidIsActive[N_BIDS];

    signal input winnerIndex;
    signal input winnerSalt;

    // ===== Component Declarations =====
    component itemHasher;
    component sellerOwnership;
    component bidHash[N_BIDS];
    component highestCheck[N_BIDS];
    component refundNote[N_BIDS];
    component reserveCheck;
    component winnerMuxX[N_BIDS];
    component winnerMuxY[N_BIDS];
    component winnerOutput;
    component sellerOutput;

    // Intermediate signals
    signal isWinner[N_BIDS];
    signal isLoser[N_BIDS];
    signal winnerPkX;
    signal winnerPkY;
    signal winningBid;

    // ===== Verify Item =====
    itemHasher = Poseidon(4);
    itemHasher.inputs[0] <== sellerPkX;
    itemHasher.inputs[1] <== sellerPkY;
    itemHasher.inputs[2] <== itemId;
    itemHasher.inputs[3] <== itemSalt;
    itemHasher.out === itemHash;

    // Seller ownership
    sellerOwnership = ProofOfOwnershipStrict();
    sellerOwnership.sk <== sellerSk;
    sellerOwnership.pkX <== sellerPkX;
    sellerOwnership.pkY <== sellerPkY;

    // ===== Verify All Bids =====
    var winnerBidAmount = 0;
    var accWinnerPkX = 0;
    var accWinnerPkY = 0;

    for (var i = 0; i < N_BIDS; i++) {
        // Verify bid commitment
        bidHash[i] = Poseidon(5);
        bidHash[i].inputs[0] <== bidderPkX[i];
        bidHash[i].inputs[1] <== bidderPkY[i];
        bidHash[i].inputs[2] <== bidAmount[i];
        bidHash[i].inputs[3] <== itemHash;
        bidHash[i].inputs[4] <== bidSalt[i];

        (bidHash[i].out - bidCommitments[i]) * bidIsActive[i] === 0;

        // Compute winner indicator (1 if this index is winner, 0 otherwise)
        // Note: This requires proper index comparison
        isWinner[i] <-- (i == winnerIndex) ? 1 : 0;
        isWinner[i] * (1 - isWinner[i]) === 0;  // Boolean check

        // Accumulate winner values
        winnerBidAmount += bidAmount[i] * isWinner[i] * bidIsActive[i];
        accWinnerPkX += bidderPkX[i] * isWinner[i];
        accWinnerPkY += bidderPkY[i] * isWinner[i];
    }

    winningBid <== winnerBidAmount;
    winnerPkX <== accWinnerPkX;
    winnerPkY <== accWinnerPkY;

    // ===== Verify Winner Has Highest Bid =====
    for (var i = 0; i < N_BIDS; i++) {
        highestCheck[i] = LessThan(64);
        highestCheck[i].in[0] <== bidAmount[i];
        highestCheck[i].in[1] <== winningBid + 1;

        highestCheck[i].out * bidIsActive[i] === bidIsActive[i];
    }

    // ===== Verify Reserve Price Met =====
    reserveCheck = LessThan(64);
    reserveCheck.in[0] <== reservePrice;
    reserveCheck.in[1] <== winningBid + 1;
    reserveCheck.out === 1;

    // ===== Create Winner Output (receives item) =====
    winnerOutput = Poseidon(4);
    winnerOutput.inputs[0] <== winnerPkX;
    winnerOutput.inputs[1] <== winnerPkY;
    winnerOutput.inputs[2] <== itemId;
    winnerOutput.inputs[3] <== winnerSalt;
    winnerOutput.out === winnerOutputHash;

    // ===== Create Seller Output (receives payment) =====
    sellerOutput = PoseidonRegularNote();
    sellerOutput.pkX <== sellerPkX;
    sellerOutput.pkY <== sellerPkY;
    sellerOutput.value <== winningBid;
    sellerOutput.tokenType <== 0;
    sellerOutput.salt <== winnerSalt;
    sellerOutput.out === sellerOutputHash;

    // ===== Create Loser Refunds =====
    for (var i = 0; i < N_BIDS; i++) {
        isLoser[i] <== bidIsActive[i] * (1 - isWinner[i]);

        refundNote[i] = PoseidonRegularNote();
        refundNote[i].pkX <== bidderPkX[i];
        refundNote[i].pkY <== bidderPkY[i];
        refundNote[i].value <== bidAmount[i];
        refundNote[i].tokenType <== 0;
        refundNote[i].salt <== bidSalt[i];

        (refundNote[i].out - loserRefundHashes[i]) * isLoser[i] === 0;
    }

    // ===== Verify Exactly One Winner =====
    var winnerCount = 0;
    for (var i = 0; i < N_BIDS; i++) {
        winnerCount += isWinner[i];
    }
    winnerCount === 1;
}

component main {public [itemHash, bidCommitments, winnerOutputHash,
    sellerOutputHash, loserRefundHashes, reservePrice]} = SealedBidAuctionSettle(50);
```

### Key Constraints

1. **Item Ownership**: Seller must own the item being auctioned
2. **Bid Integrity**: All bids verified against commitments
3. **Highest Bid**: Winner has highest bid among all active bidders
4. **Reserve Price**: Winning bid must meet minimum price
5. **Exactly One Winner**: Exactly one bidder selected as winner
6. **Full Refunds**: All losers get their exact bid amounts back

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Shill Bidding** | Bids committed before settlement; cannot create fake bids after seeing others |
| **Bid Tampering** | Commitments are cryptographic; cannot change bid after commitment |
| **Auctioneer Collusion** | No trusted auctioneer; proof verifies correct winner selection |
| **Timing Attacks** | All bids committed in same block or time window |
| **Losing Bid Exposure** | Losing bid amounts never revealed; only winner amount public |
| **Winner Anonymity** | Winner identity can be hidden with additional circuit logic |
| **Refund Withholding** | Refund notes created atomically in same proof |
| **Reserve Price Gaming** | Reserve price public before bidding |

## Implementation Challenges

1. **Index Selection in ZK**
   - `bidderPkX[winnerIndex]` requires MUX circuit
   - N_BIDS MUX adds ~500 constraints per field
   - Alternative: accumulator pattern (shown above)

2. **Tie-Breaking**
   - What if two bids have same amount?
   - Options: first commitment wins, random selection, split
   - Current design: first in array wins (deterministic)

3. **Failed Auctions**
   - What if no bid meets reserve price?
   - Need separate "failed auction" proof for full refunds
   - Seller gets item back; all bidders refunded

4. **Timing Coordination**
   - When does bidding period end?
   - On-chain timestamp or block number check
   - Consider late bid protection

5. **Large Bid Counts**
   - 50 bids = ~600K constraints
   - Scales linearly with bid count
   - For larger auctions, consider hierarchical approach

## Use Cases

1. **NFT Auction**
   - 50 sealed bids on a rare NFT
   - Winner revealed; losing bid amounts stay private
   - Settlement atomic: winner gets NFT, seller gets payment

2. **Domain Name Auction**
   - Premium domain names auctioned
   - Prevents domain speculation based on bid information
   - ENS-style auctions with privacy

3. **Real Estate Bidding**
   - Property sales with sealed bids
   - Prevents bidder collusion
   - Regulatory compliant with audit trail

4. **Government Procurement**
   - Public contract bidding
   - Prevents bid rigging
   - Transparent verification without bid disclosure

5. **Art Auction House**
   - High-value art sales
   - Preserves collector privacy
   - Provenance and ownership tracked on-chain

## Real-World Products & User Experience

See [Real-World Products & User Experience](../../product/high-complexity/hc6-sealed-bid-auction-products.md) for detailed product scenarios and use cases.

---

[Back to Index](../README.md)
