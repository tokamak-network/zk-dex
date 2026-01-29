# Auction (Dutch/English) - Product Applications

[← Back to Technical Specification](../../circuit-addons/a-core-trading/a7-auction.md)

---

## Real-World Products & User Experience

### 1. "Sealed Bid Auction" - Bid Price Leakage Prevention High-Value Asset Auction Service

**Product Description**:
A sealed bid service where bid amounts are not exposed to other participants when auctioning NFTs, large token blocks, or rare digital assets. On regular on-chain auctions, bids are public, enabling competitors to use "just one more" sniping strategies or price manipulation using bid information.

**User Experience**:
- Collector Lee (45) intends to bid 50 ETH on rare NFT
- On regular on-chain auctions, bid amounts are revealed in real-time
- Competitors snipe with 50.1 ETH at the last moment, or collude using bid information
- Using ZK sealed bidding, all bids are submitted in encrypted form
- At closing time, ZK proof verifies highest bid and determines winner
- No one can see other bids, competing purely on value assessment

**Observable Benefits**:
- Completely prevents sniping and last-minute manipulation
- Impossible to share bid information for collusion
- Fair auction where participants bid based on true value assessment

### 2. "Liquidation Auction Privacy" - Collateral Liquidation Bidder Protection Service

**Product Description**:
A service that prevents liquidator bid amounts and strategies from being exposed during collateral liquidation auctions in DeFi protocols. When liquidation bids are public, MEV bots can front-run to steal liquidation opportunities or manipulate using bidding competition information.

**User Experience**:
- Liquidator Park (38) operates DeFi liquidation bot for profit
- Regular protocols expose liquidation bid information in mempool when submitted
- MEV bots steal same liquidation opportunity with higher gas fees
- Or compete with more favorable terms after seeing bid price
- Using ZK liquidation auction, bid price and conditions are submitted encrypted
- Front-running impossible, ensures fair liquidation competition environment

**Observable Benefits**:
- Prevents liquidation MEV snatching
- Fair competition environment among liquidators
- More participants in liquidation improves protocol stability

### 3. "DAO Asset Sale Private Auction" - Project Asset Disposal Privacy Service

**Product Description**:
A service that prevents bid information from being prematurely exposed to the market when DAOs or projects sell large-scale assets (tokens, NFTs, protocol assets). When sale size and bidding status are public, markets react in advance, resulting in sales at unfavorable prices.

**User Experience**:
- DeFi DAO decides to sell tokens worth $1M USDC accumulated from protocol revenue
- Regular public auction spreads information "large-scale sale in progress" to market
- Token price drops + bidders think "they have to sell anyway, can bid low"
- Expected sale price $1M → actual winning bid $750K
- Using ZK sealed auction, sale size, bidders, and bid amounts all remain private
- Completes sale at fair price without market reaction

**Observable Benefits**:
- Prevents price drops from large asset sale information leakage
- Blocks bidder collusion and low-bid inducement
- Realizes fair value for DAO and project assets
