# Collateral Deposit/Withdraw - Real-World Products

**Technical Specification**: [E14. Collateral Deposit/Withdraw](../../circuit-addons/e-defi/e14-collateral.md)

---

## 1. "Liquidation Hunting Defense" - Collateral Liquidation Price Protection

**Product Description**:
Defense against "liquidation hunting" attacks where whales manipulate oracles or push markets to liquidation prices when collateral position liquidation prices are exposed.

**Typical User Experience**:
- Without Privacy: 155% collateral ratio, 150% liquidation line exposed → Oracle manipulation induces 3% collateral value decline → Forced liquidation + penalty
- With ZK DeFi: Collateral ratio and liquidation price private → Attacker doesn't know "how far to push for liquidation"
- Result: Liquidation hunting attacks neutralized, autonomous management at reasonable price

**Observable Benefits**:
- Complete blocking of liquidation price targeting attacks
- Reduced oracle manipulation incentives
- Stable collateral position management enabled

## 2. "Asset Size Concealment" - Wealth Exposure Prevention Through Collateral

**Product Description**:
Solving the problem where collateral size exposure allows estimation of borrower's total asset size, becoming target of targeted attacks, phishing, and social engineering attacks.

**Typical User Experience**:
- Without Privacy: $5M ETH collateral exposed → "High-value target" identified → Personal information tracking, phishing attacks, extortion attempts
- With ZK DeFi: Collateral size private, only adequate collateralization proven → Asset size estimation impossible
- Result: DeFi lending use without wealth exposure

**Observable Benefits**:
- Blocking asset size reverse-estimation through collateral
- Prevention of high-value wallet targeting attacks
- Financial service use with privacy maintained

## 3. "Cascade Liquidation Prevention" - Collateral Liquidation Concentration Attack Blocking

**Product Description**:
Defense against attacks that intentionally push to specific price levels to trigger chain liquidations when collateral liquidation concentration at specific price levels is exposed.

**Typical User Experience**:
- Without Privacy: "$100M liquidation volume concentrated at $1,800" exposed → Attacker induces price decline to $1,800 → Chain liquidation crashes to $1,500
- With ZK DeFi: Liquidation price distribution opaque → Cannot identify liquidation concentration points
- Result: Cascade liquidation attacks neutralized, improved system stability

**Observable Benefits**:
- Prevention of liquidation volume concentration point exposure
- Elimination of intentional price manipulation incentives
- Reduced systemic risk across protocol
