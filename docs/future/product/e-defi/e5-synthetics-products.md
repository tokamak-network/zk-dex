# Synthetic Asset Mint/Burn - Real-World Products

**Technical Specification**: [E5. Synthetic Asset Mint/Burn](../../circuit-addons/e-defi/e5-synthetics.md)

---

## 1. "Stealth Mint" - Preventing Market Impact of Large Synthetic Asset Issuance

**Product Description**:
Solving the problem where front-running occurs in underlying asset markets when large synthetic asset issuance is exposed. Example: sETH large mint → ETH front-running buy → unfavorable price for issuer.

**Typical User Experience**:
- Without Privacy: $5M sGOLD mint intent exposed → Arbitrageurs front-run gold futures buying → Synthetic asset issuance price rises
- With ZK DeFi: Mint size and underlying asset private → Front-running impossible
- Result: Synthetic asset issuance at fair price, zero market impact

**Observable Benefits**:
- Prevention of underlying asset market manipulation during large mints
- Protection of synthetic asset issuance strategies
- Elimination of information asymmetry between issuers and traders

## 2. "Liquidation Price Concealment" - Synthetic Asset Collateral Liquidation Hunting Defense

**Product Description**:
Defense against attacks inducing forced liquidation through oracle manipulation when synthetic asset collateral ratios and liquidation prices are exposed.

**Typical User Experience**:
- Without Privacy: 155% collateral ratio position exposed (liquidation line 150%) → Oracle attack induces temporary underlying asset price drop → Forced liquidation
- With ZK DeFi: Collateral ratio and liquidation price private → Attacker doesn't know how far to push
- Result: Oracle manipulation-based liquidation hunting neutralized

**Observable Benefits**:
- Blocking collateral position targeting liquidation attacks
- Reduced oracle manipulation incentives
- Improved stability for synthetic asset issuers' positions

## 3. "Inverse Strategy Protection" - Short Synthetic Asset Strategy Leak Prevention

**Product Description**:
Solving the problem where inverse (reverse) synthetic asset large issuance exposure becomes a "big player betting on decline" signal, neutralizing the strategy.

**Typical User Experience**:
- Without Privacy: Large fund's sETH-inverse large issuance exposed → Market interprets "fund expects decline" → Other traders also short → Fund's entry price becomes unfavorable
- With ZK DeFi: Synthetic asset type and size private → Directional betting signal blocked
- Result: Protection of independent investment judgment, alpha preserved

**Observable Benefits**:
- Prevention of directional betting strategies becoming market signals
- Confidentiality maintained for institutional investor investment decisions
- Blocking market herding induction
