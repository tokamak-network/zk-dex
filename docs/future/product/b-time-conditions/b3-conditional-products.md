# Conditional Payment (Oracle) - Products & User Experience

**Technical Specification**: [B3. Conditional Payment (Oracle)](../../circuit-addons/b-time-conditions/b3-conditional.md)

---

## 1. "Confidential M&A Conditional Payment" - Private Terms for Mergers & Acquisitions

**Product Description**:
A system where payment is automatically released when specific conditions are met in corporate M&A (regulatory approval, due diligence completion, stock price conditions, etc.). Condition details and amounts remain completely private, preventing damage from information leaks during negotiations.

**General User Experience**:
- Hyun-soo Kim (48), CEO of tech company "CloudOne," is in competitor acquisition negotiations
- Acquisition terms: "If regulatory approval completed + target company stock price stays below $50, pay $800M"
- Using existing public smart contracts → market identifies conditions → price manipulation attempts, competitor sabotage
- Sets up ZK conditional payment: condition type, threshold, amount all private
- When oracle confirms conditions met, automatically executes; outsiders cannot know "which conditions were met"
- M&A completed safely without interference from competitors or speculators

**Observable Benefits**:
- Prevents price manipulation and market disruption due to M&A condition disclosure
- Maintains negotiation leverage (counterparty cannot infer "what conditions trigger payment")
- Blocks competitors from preemptive acquisition attempts under identical terms

## 2. "Anonymous Political Pledge Deposit" - Private Donations Tied to Promise Fulfillment

**Product Description**:
A conditional donation system where contributions are delivered only if politicians fulfill specific pledges. Donor identity and donation amounts remain completely private, preventing political retaliation or social pressure.

**General User Experience**:
- Businessman Jin-woo Park (55) is interested in environmental policy but fears business repercussions if political donations become known
- Sets condition for mayoral candidate: "50M KRW donation if carbon-neutral ordinance passes"
- Existing political funds require disclosure of donor lists, inevitably exposing political leanings
- ZK conditional payment: donor, amount, conditions all private
- After mayor elected and carbon-neutral ordinance passes → automatically delivers 50M KRW
- Mayor's office only knows "someone donated for environmental pledge fulfillment," cannot identify Park Jin-woo
- Park Jin-woo financially supports desired policy without exposing political orientation

**Observable Benefits**:
- Prevents business and social disadvantages from political donations
- Blocks suspicion of collusion between donor and politician (condition-based, so no quid pro quo)
- Enables diverse political orientations of citizens to participate in policy-based donations without burden

## 3. "Confidential Trade Trigger" - Private Price-Condition Automated Trading

**Product Description**:
A service where trades automatically execute when specific price conditions are met. Target price and trade size remain private, preventing market participants' front-running or price manipulation.

**General User Experience**:
- Trader Seo-yeon Lee (35) at asset management firm "AlphaCapital" plans large-scale ETH purchase
- Condition: "If ETH drops below $3,000, buy $5M"
- Existing public orders are exposed to market → other traders front-run just before $3,000, driving price up and preventing condition fulfillment
- Sets up ZK conditional payment: price condition and quantity both private
- ETH reaches $2,950 → automatic buy execution, market only aware "someone bought"
- Successfully purchases large quantity at desired price without front-running

**Observable Benefits**:
- Minimizes market impact of large orders
- Neutralizes other traders' front-running and back-running strategies
- Investment strategy and position size not exposed to competitors
