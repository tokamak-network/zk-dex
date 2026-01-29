# Partial Fill Orders - Product Applications

[← Back to Technical Specification](../../circuit-addons/a-core-trading/a2-partial-fill.md)

---

## Real-World Products & User Experience

### 1. "Whale Stealth Trading System" - Large Order Exposure Prevention Service

**Product Description**:
A service that executes large buy/sell orders through partial fills for institutional investors or large traders, preventing the full order size from being exposed to the market. Protects against front-running and MEV attacks that occur when complete order sizes are revealed.

**User Experience**:
- Fund Manager Han (42, hedge fund) needs to buy 10,000 ETH
- Placing this order on a regular DEX publicly reveals "10,000 ETH buy order pending"
- MEV bots detect this and buy ETH first to raise the price, then sell back at a premium (sandwich attack)
- Using ZK partial fill system, executes 500 ETH at a time over 20 fills, keeping total size private
- Remaining order quantity is encrypted each time, MEV bots cannot determine full size

**Observable Benefits**:
- Prevents front-running/sandwich attacks on large orders
- Eliminates price disadvantages from full order size exposure
- Institutional investors can use DEX with confidence

### 2. "Corporate Acquisition Silent Accumulation Service" - M&A Stake Acquisition Privacy Tool

**Product Description**:
A service that prevents accumulation progress from being exposed to the market when a company preparing for M&A quietly accumulates tokens/equity of a target company. Prevents the problem where prices surge dramatically when accumulation becomes known, significantly increasing acquisition costs.

**User Experience**:
- Strategist Lee (48, corporate M&A team) aims to secure 30% of competing protocol governance tokens
- Buying in volume on regular exchanges leads to analysis reports: "Specific wallet is continuously buying"
- Market senses acquisition possibility, token price surges 50%, acquisition costs explode
- Using ZK partial fills to buy small amounts, cumulative purchases and buyer identity completely private
- Market doesn't detect acquisition movement until 30% is secured

**Observable Benefits**:
- Prevents price increases from market reaction during strategic stake accumulation
- Blocks exposure of intentions to competing acquirers
- Achieves acquisition goals at reasonable cost

### 3. "OTC Trade Information Shield" - Over-the-Counter Trading Privacy Protection Service

**Product Description**:
A service that prevents sale volume and counterparty information from being exposed when large project team members, early investors, and VCs sell held tokens through OTC (over-the-counter) trading. Prevents market panic and price crashes caused by disclosure of insider selling information.

**User Experience**:
- Founder Park (35, DeFi protocol founder) needs to liquidate some vested tokens
- Regular on-chain trading triggers alerts: "Large token movement from founder wallet" detected by on-chain analysis services
- Twitter spreads rumors of "founder dumping," token price drops 30%
- Using ZK partial fills to split-sell to multiple OTC buyers, keeping trade size and counterparties private
- Secures funds as planned without unnecessary market panic

**Observable Benefits**:
- Prevents market panic from insider trading exposure
- Enables legitimate asset management while protecting project reputation
- Protects counterparty information in OTC trades, ensuring safety for both sides
