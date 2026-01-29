# Escrow with Timeout - Products & User Experience

**Technical Specification**: [B5. Escrow with Timeout](../../circuit-addons/b-time-conditions/b5-escrow.md)

---

## 1. "Confidential Negotiation Escrow" - Private Terms for B2B Contracts

**Product Description**:
An escrow service where contract amounts and terms in business transactions remain absolutely unexposed externally. Solves the problem where disclosed transaction terms become disadvantageous in future negotiations or provide information to competitors.

**General User Experience**:
- Hyun-soo Lee (45), Purchasing Manager at semiconductor equipment company "ChipTech," is in raw material supplier negotiations
- Negotiation result: $50 per kilogram (23% discount vs. market price of $65)
- If this price becomes known → other suppliers demand identical terms, competitors approach same supplier
- Existing escrow exposes amounts on-chain, allowing competitors to immediately identify
- Uses ZK escrow: deposits 500M KRW contract amount, amount and terms completely private
- Automatically pays upon delivery confirmation; externally only "transaction occurred between ChipTech and supplier" is visible
- Maintains negotiation advantage, competitors cannot determine ChipTech's cost structure

**Observable Benefits**:
- Prevents favorable negotiation terms from becoming disadvantageous in future transactions
- Blocks competitors from approaching same suppliers after learning transaction terms
- Prevents leakage of core business information like cost structure and margin rates

## 2. "Anonymous Dispute Arbitration" - Escrow Where Arbitrator Doesn't Know Parties

**Product Description**:
An anonymous arbitration system where arbitrators judge based only on evidence without knowing the parties' identities when transaction disputes arise. Arbitrator bias or external pressure intervention impossible.

**General User Experience**:
- Famous influencer "BeautyQueen" (real name undisclosed) is in sponsorship contract dispute with cosmetics brand
- 30M KRW contract amount locked in escrow, disagreement over content quality
- In regular arbitration, arbitrator may think "since it's BeautyQueen, let's favor her" or "it's a big company, let's support them"
- ZK escrow dispute arbitration: arbitrator only sees "Party A, Party B" and contract/evidence
- Judges purely based on evidence without knowing if party is celebrity or corporation
- Arbitration result: 70% to brand, 30% to influencer → automatically distributes
- Both sides accept as "fair judgment"

**Observable Benefits**:
- Completely eliminates arbitrator's status/reputation bias
- Makes external pressure on arbitrator by one party impossible
- Celebrities/corporations don't have unfair advantages or disadvantages in disputes

## 3. "Sensitive Transaction Protection" - Escrow for Transactions Where Identity Exposure is Dangerous

**Product Description**:
Escrow enabling safe anonymous transactions for both parties when disclosure of transaction party identities would be dangerous. Used for whistleblower information trading, sensitive artwork transactions, etc.

**General User Experience**:
- Corporate insider knowing accounting fraud considers providing materials to investigative journalism outlet
- Requests 50M KRW legal cost support in exchange for materials
- Problem: if materials provided first, payment may not come; if payment received first, materials may not be provided
- Bigger problem: if transaction becomes known, whistleblower's safety threatened
- Uses ZK escrow: outlet deposits 50M KRW, whistleblower submits encrypted materials
- After outlet confirms materials, releases escrow → anonymously delivers 50M KRW to whistleblower
- Blockchain only records "transaction completed between anonymous A and anonymous B," both identities untraceable

**Observable Benefits**:
- Enables safe transactions even when the transaction itself is dangerous
- Guarantees transaction fulfillment even when both parties don't know each other's identities
- Facilitates socially necessary but risky transactions like whistleblowing and sensitive information trading
