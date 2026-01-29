# Range Order - Real-World Products

**Technical Specification**: [E11. Range Order](../../circuit-addons/e-defi/e11-range-order.md)

---

## 1. "Hidden Limit" - Large Limit Order Protection

**Product Description**:
Defense against attacks that front-run just before target prices when range order price ranges are exposed, inducing unfavorable execution.

**Typical User Experience**:
- Without Privacy: 100 ETH buy order at $2,000 exposed → Bot front-runs buy at $2,001 → When price reaches, bot sells at $2,000 → Unfavorable execution for orderer
- With ZK DeFi: Order price and size private → Front-running impossible
- Result: Fair price execution, zero MEV loss

**Observable Benefits**:
- Complete blocking of limit order front-running
- Minimized market impact of large orders
- Strategy execution without order intent exposure

## 2. "Range Strategy Protection" - Market Maker Range Concealment

**Product Description**:
Solving the problem where competing MMs replicate the same range or attack at range ends when Uniswap V3 style concentrated liquidity price ranges are exposed.

**Typical User Experience**:
- Without Privacy: MM's $1,900-$2,100 liquidity range exposed → Competitor replicates same range → Fee competition reduces profits
- With ZK DeFi: Liquidity range private → Strategy replication impossible
- Result: Proprietary market making strategy protected, alpha preserved

**Observable Benefits**:
- Confidentiality of concentrated liquidity strategy maintained
- Blocking range attacks
- Protection of professional market makers' competitive advantage

## 3. "Support/Resistance Concealment" - Technical Analysis Exploitation Prevention

**Product Description**:
Solving the problem where large range orders become unintended market signals when exposed, being recognized as support/resistance levels.

**Typical User Experience**:
- Without Privacy: Large buy order at $1,800 exposed → Market recognizes as "support level" → Decline induced to that price + sell positions waiting just above
- With ZK DeFi: Order price private → Cannot be exploited in technical analysis
- Result: Large orders don't affect market structure

**Observable Benefits**:
- Prevention of large orders becoming market signals
- Blocking technical analysis-based manipulation
- Price formation by pure supply and demand
