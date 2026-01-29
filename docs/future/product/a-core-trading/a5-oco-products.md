# OCO Order (One-Cancels-Other) - Product Applications

[← Back to Technical Specification](../../circuit-addons/a-core-trading/a5-oco.md)

---

## Real-World Products & User Experience

### 1. "Fully Private Bracket Order" - Complete Trading Strategy Concealment Service

**Product Description**:
A service that protects both stop-loss and take-profit prices from market exposure when traders set them simultaneously. On regular DEXs, both triggers of OCO orders are public, revealing the trader's entire risk/reward strategy. Competitors can reverse-engineer position size, leverage level, and risk tolerance from this information.

**User Experience**:
- Quant Trader Choi (38) operates sophisticated risk/reward strategies
- Setting OCO orders on regular DEX exposes both triggers publicly
- Competing traders analyze: "This wallet uses risk 1: reward 3 strategy, estimated 5x leverage"
- Competitors can use this information to build reverse positions and induce liquidation
- Using ZK OCO orders, both stop-loss and take-profit prices are encrypted
- Trader's strategy, position size, and risk profile completely private

**Observable Benefits**:
- Keeps entire trading strategy and risk management approach private
- Prevents competitors from inducing liquidation with reverse positions
- Protects alpha from algorithmic/quant strategies

### 2. "Institutional Position Full Protection" - Fund Bilateral Order Concealment Service

**Product Description**:
A service that prevents the bracket itself from being known to the market when institutional investors simultaneously set stop-loss and take-profit on large positions. When institutional OCO orders are public, market participants' behavior changes as they anticipate large volume at those price levels.

**User Experience**:
- CIO Park (52, crypto fund) manages $50M BTC position
- Setting OCO on regular DEX publicly reveals "stop-loss at $35K, take-profit at $50K"
- Market participants anticipate large sell volume at these levels and act preemptively
- Buy pressure decreases just before $50K (anticipating large sell), suppressing price rise
- Sell pressure accelerates near $35K (profit from inducing large stop-loss)
- Using ZK OCO, both bracket prices and quantities are private
- Market moves naturally without distortion from institutional orders

**Observable Benefits**:
- Prevents institutional orders from distorting market price formation
- Blocks price suppression/acceleration from anticipated large volume
- More fair and efficient market price discovery

### 3. "Complete MEV Block Bracket" - Bilateral Trigger Attack Prevention Service

**Product Description**:
A service that prevents MEV bots from exploiting whichever OCO order trigger executes. On regular OCO orders, MEV bots can employ various attack strategies depending on which trigger executes first.

**User Experience**:
- Investor Han (44) sets OCO order on high volatility token
- MEV bots identify stop-loss trigger price and temporarily push price to induce stop-loss
- Or front-run just before take-profit trigger to buy at better price first
- Either way, Han fills at unfavorable conditions
- Using ZK OCO, both triggers are encrypted, preventing MEV bot attacks
- Whichever trigger executes, fairly fills at set price

**Observable Benefits**:
- Protects both stop-loss/take-profit directions from MEV attacks
- Prevents both stop-hunting and front-running simultaneously
- Ensures reliability of executing exactly as strategy is set
