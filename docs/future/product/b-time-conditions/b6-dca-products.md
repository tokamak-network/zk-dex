# DCA (Dollar-Cost Averaging) - Products & User Experience

**Technical Specification**: [B6. DCA (Dollar-Cost Averaging)](../../circuit-addons/b-time-conditions/b6-dca.md)

---

## 1. "Whale Tracking Prevention DCA" - Large-Scale Investment Strategy Privacy System

**Product Description**:
A service where institutional investors or high-net-worth individuals' purchase schedules and amounts are not exposed to the market when regularly buying large-scale assets. Existing on-chain DCA immediately exposes strategies through "whale tracking."

**General User Experience**:
- Sung-ho Kim (50), CIO of family office "Hangang Asset Management," decides on long-term ETH accumulation
- Plan: 1B KRW weekly for 1 year, total 52B KRW purchase
- Using existing on-chain DCA → whale tracking bots immediately detect → rumor "Hangang Asset Management accumulating ETH"
- Traders front-run by pre-buying then selling at higher prices, accumulation costs surge
- Sets up ZK DCA: purchase intervals, amounts, total budget all private
- Weekly transactions occur but "who's buying how much" cannot be determined externally
- After 1 year, completes 52B KRW accumulation, maintains average cost without front-running damage

**Observable Benefits**:
- Prevents prices from rising prematurely due to exposed large purchase strategy
- Neutralizes other investors' copy-trading and front-running strategies
- Investment scale and positions not exposed to competing funds

## 2. "DAO Treasury Diversification Anonymization" - Private Project Token Selling Strategy

**Product Description**:
A reverse DCA service where selling schedules are not exposed to the market when DAOs or project foundations convert holdings to stablecoins. Disclosing selling plans triggers panic selling and price crashes.

**General User Experience**:
- DeFi protocol "UniswapClone" foundation needs to sell tokens for operating expenses
- Plan: sell 1M tokens monthly, 12M tokens total over 1 year (5% of total supply)
- Existing public DCA: announcing "foundation sells 1M monthly" → community panic → token price crashes 50%
- Sets up ZK reverse DCA: selling schedule and quantity completely private
- Market only sees "someone selling," cannot determine if it's foundation or how much
- Gradual selling minimizes market shock, secures operating funds while maintaining price stability

**Observable Benefits**:
- Prevents unnecessary price crashes due to foundation selling fear (FUD)
- Blocks short position attacks targeting selling timing
- Project's financial situation not exposed to competing protocols

## 3. "Anonymous Political Fund Accumulation" - Untraceable Supporter Regular Donations

**Product Description**:
A service where supporter identity, donation amount, and patterns remain completely private when regularly supporting politicians or civic groups. Blocks reverse-tracking of supporters through regular donation pattern analysis.

**General User Experience**:
- SME CEO Young-jin Park (58) wants to regularly support opposition politician
- Problem: has business relationship with current administration; if support becomes known, business disadvantages feared
- Existing political funds require donor disclosure; cryptocurrency also traceable through regular pattern analysis
- ZK DCA donations: monthly support, amounts/timing all randomized and private
- Not a pattern like "5M KRW on the 1st every month," but varying amounts at varying times
- Even blockchain analysis cannot determine "regular supporter" status
- Completes 60M KRW donation over 1 year without political orientation exposure

**Observable Benefits**:
- Makes reverse-tracking of supporters through regular donation pattern analysis impossible
- Prevents business and social disadvantages from donation activities
- Guarantees privacy in democratic participation, encouraging more citizen involvement
