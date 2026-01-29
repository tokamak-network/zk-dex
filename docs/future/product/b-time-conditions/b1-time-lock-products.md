# Time-Locked Notes - Products & User Experience

**Technical Specification**: [B1. Time-Locked Notes](../../circuit-addons/b-time-conditions/b1-time-lock.md)

---

## 1. "Private Vesting Schedule" - Employee Token Compensation Privacy Protection

**Product Description**:
A service that keeps each employee's compensation amount and vesting schedule completely private when startups distribute token rewards to employees. Solves the problem where blockchain transparency can actually cause organizational conflicts.

**General User Experience**:
- Jun-hyuk Lee (38), CTO of blockchain startup "ChainLabs," designs different token compensation packages for 5 core developers
- Using existing on-chain vesting (Sablier, etc.) would allow all employees to see each other's compensation amounts, raising serious internal conflict concerns
- Sets up ZK time-lock vesting schedules for each employee: amounts and unlock schedules visible only to the individual
- Competitors cannot determine "how much ChainLabs is paying their key talent"
- Employees focus on work without unnecessary comparisons since they don't know each other's compensation

**Observable Benefits**:
- Prevents organizational conflicts and turnover due to compensation comparisons among employees
- Blocks competitor targeting in recruitment based on compensation information
- Prevents investors or outsiders from reverse-engineering the company's token distribution strategy

## 2. "Anonymous Inheritance" - Family Dispute Prevention Inheritance System

**Product Description**:
A privacy-preserving inheritance service where parents can leave different amounts to their children while keeping each heir's amount hidden from other family members. Eliminates the root cause of inheritance disputes: the perception of unfairness.

**General User Experience**:
- Asset holder Jung-ho Kim (72) wants to leave inheritance to three children, but each has different circumstances making equal distribution difficult
- Sets eldest son 500M KRW (business recovery support), middle son 200M KRW (stable job), youngest 300M KRW (study abroad support)
- Regular inheritance reveals amounts when will is disclosed, inevitably causing sibling conflicts
- ZK time-lock sets separate inheritance for each child, automatically unlocking after Jung-ho Kim's passing
- Each child can only see their own share, cannot know how much siblings received
- Inheritance distributed according to parent's wishes without conflicts over "why did I get less?"

**Observable Benefits**:
- Prevents family disputes and lawsuits due to differential inheritance amounts
- Protects family privacy as inheritance details don't appear in public records
- Prevents distrust relationships where heirs monitor or suspect each other

## 3. "Confidential Investment Lockup" - Private VC Lockup Conditions

**Product Description**:
A service that keeps VC token lockup conditions completely private when investing in startups. Investment amount, lockup period, and unlock schedule are not exposed to competing VCs or the market.

**General User Experience**:
- Seo-yoon Park (45), Partner at VC fund "NextVentures," proceeds with seed investment in promising AI startup
- Investment terms: $1M, 2-year lockup, 25% quarterly unlock
- Using existing on-chain lockup allows competing VCs to immediately know "how much NextVentures invested"
- With this information, competitors can offer better terms and preempt follow-on rounds
- ZK time-lock sets investment lockup: amount and duration both private
- Automatically unlocks 25% quarterly, but outsiders cannot determine unlock timing or amounts
- Investment strategy and portfolio composition not exposed to competitors, maintaining negotiating power

**Observable Benefits**:
- Prevents situations where disclosed investment terms lead follow-on investors to demand favorable conditions
- Blocks VC's investment strategy and valuation judgments from market exposure
- Makes market manipulation targeting lockup unlock schedules (anticipating selling pressure before unlock, etc.) impossible
