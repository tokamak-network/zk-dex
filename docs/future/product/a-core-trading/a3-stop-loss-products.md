# Stop-Loss Order - Product Applications

[← Back to Technical Specification](../../circuit-addons/a-core-trading/a3-stop-loss.md)

---

## Real-World Products & User Experience

### 1. "Stop-Hunting Defense System" - Stop Price Exposure Prevention Trading Service

**Product Description**:
A service that protects traders' stop-loss prices from being exposed to the market. On regular DEXs, stop-loss orders are publicly visible on-chain, enabling MEV bots to deliberately push prices to stop-loss levels to trigger liquidations, then revert prices back (stop-hunting attack). ZK stop-loss orders hide trigger prices, neutralizing this attack.

**User Experience**:
- Trader Jung (34, full-time trader) sets 5% stop-loss on ETH long position
- On regular DEX, stop-loss price is publicly visible on-chain
- MEV bots analyze other traders' stop-loss prices, identifying concentrated price levels
- Momentarily pushes price to that level to trigger mass stop-losses, then reverts (stop-hunting)
- Using ZK stop-loss orders, trigger price is encrypted, MEV bots cannot determine stop-loss price
- Stop-hunting attacks become impossible, stop-loss only executes on legitimate market movements

**Observable Benefits**:
- Protection from stop-hunting/stop-running attacks
- Neutralizes artificial liquidation inducement attacks
- Prevents unfair trading from stop-loss information leakage

### 2. "Private Liquidation Price Leverage" - Collateral Loan Liquidation Information Protection Service

**Product Description**:
A service that prevents liquidation prices from being exposed when taking collateral loans in DeFi. When liquidation prices are public, attackers can manipulate oracle prices or temporarily move the market to induce liquidations and profit.

**User Experience**:
- Investor Lee (45) takes stablecoin loan with ETH collateral
- Regular protocols publicly reveal "this wallet liquidates at ETH price $1,500"
- Whale traders temporarily push price to $1,500 to induce liquidation
- Acquire liquidated collateral cheaply, then profit from price recovery
- In ZK stop-loss (liquidation) system, liquidation price is encrypted
- Attackers cannot know liquidation price, making targeted liquidation attacks impossible

**Observable Benefits**:
- Prevents liquidation price targeting attacks
- Protects collateral borrowers' position information
- Provides safer leveraged trading environment

### 3. "Private Position Risk Management" - Trading Strategy Exposure Prevention Service

**Product Description**:
A service that prevents this information from being exposed to competitors or the market when funds or institutional investors set stop-loss orders for risk management. When stop-loss prices are known, the fund's position size, risk tolerance, and trading strategies are revealed.

**User Experience**:
- Fund Manager Park (50, crypto hedge fund) manages positions worth hundreds of millions
- Setting stop-loss orders on public DEX allows competitor funds to analyze
- Pattern of "Fund A always stops out at 10% loss" gets identified, strategy exposed
- Competitors can use this information to pursue reverse profits
- Using ZK stop-loss system keeps both trigger price and quantity private
- Fund's risk management strategy not exposed to market

**Observable Benefits**:
- Keeps institutional trading strategies and risk management patterns private
- Prevents competitors from exploiting information
- Enables competition based on pure skill in fair market environment
