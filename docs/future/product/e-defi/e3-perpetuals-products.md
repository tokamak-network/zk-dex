# Perpetual Position Open/Close - Real-World Products

**Technical Specification**: [E3. Perpetual Position Open/Close](../../circuit-addons/e-defi/e3-perpetuals.md)

---

## 1. "Liquidation Shield" - Liquidation Hunting Attack Defense Service

**Product Description**:
Service defending against "liquidation hunting" where whales push prices to liquidation levels when leveraged positions' liquidation prices are exposed.

**Typical User Experience**:
- Without Privacy: 10x leverage long position's liquidation price $2,800 exposed → Whale mass sells to push to $2,799 → Forced liquidation + 5% penalty loss
- With ZK DeFi: Leverage multiplier and liquidation price private → Attacker cannot identify target price
- Result: Liquidation hunting attacks neutralized, autonomous position management

**Observable Benefits**:
- Blocking targeted attacks from liquidation price exposure
- Prevention of market manipulation based on leverage size
- Guaranteed autonomy in trader's risk management

## 2. "Ghost Trading" - Strategy Replication Prevention for Perpetual Trading

**Product Description**:
Solving the problem where algorithmic traders immediately take opposite trades to extract profits when perpetual futures positions are exposed on-chain.

**Typical User Experience**:
- Without Privacy: Large long position entry detected → Algorithm bots enter same direction then liquidate first → Unfavorable price formation for original trader
- With ZK DeFi: Position size and direction undetectable → Front-running bots neutralized
- Result: Protection of proprietary trading strategies, fair entry/exit

**Observable Benefits**:
- Blocking signal-detection-based front-running by HFT bots
- Protection of trading strategies and signals
- Equal environment for small and large traders

## 3. "Funding Rate Exploit Defense" - Funding Rate Attack Blocking

**Product Description**:
Defense against attacks where large positions are exposed and counterparties intentionally stack positions to drive funding rates to extremes, forcing losses.

**Typical User Experience**:
- Without Privacy: Large long position exposed → Attacker adds massive long entries → Funding rate spikes to 0.1%/8h → Position holding cost explodes
- With ZK DeFi: Total OI (open interest) distribution opaque → Funding rate manipulation targeting impossible
- Result: Funding rate attacks neutralized, reasonable position holding costs

**Observable Benefits**:
- Prevention of indirect liquidation through funding rate manipulation
- Blocking selective attacks based on position size
- Predictability secured for long-term position holding
