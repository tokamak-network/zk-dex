# Invoice Factoring - Real-World Products

[Technical Specification](../../circuit-addons/g-enterprise/g3-invoice.md)

---

## Real-World Products & User Experience

### 1. "Transaction Scale Confidentiality" - Hiding Revenue from Competitors/Investors

**Product Description**:
When inter-company invoice amounts are public, transaction scale, negotiating power, and dependencies are exposed. Competitors can strategize to steal major customers, investors can negotiate unfavorable valuations. ZK proves only legitimate receivables while keeping amounts completely confidential.

**User Experience**:
- Without Privacy: Company A's monthly 1 billion won revenue to large enterprise B becomes known, competitor C offers better terms to B and wins the account
- With ZK Solution: During factoring, prove only "verified quality receivables held", client name/amount undisclosed even to banks
- Result: Competitors cannot identify major clients and transaction scales, protecting core revenue sources

**Observable Benefits**:
- Blocks major client information leaks to competitors
- Prevents negotiating power analysis based on transaction scale
- Prevents unfavorable negotiations due to revenue dependency exposure

### 2. "Pricing Policy Protection" - Maintaining Client-Specific Unit Price Confidentiality

**Product Description**:
Applying different prices to different customers for the same product is common practice, but public invoices expose price discrimination policies. Customers receiving lower prices demand renegotiation if they find out, high-price customers may leave.

**User Experience**:
- Without Privacy: Software company sells same product to customer A for 100 million won, customer B for 50 million won. B demands same terms if they discover A's price
- With ZK Solution: Each invoice shows only "legitimate transaction completed" proof, amounts not comparable by any third party
- Result: Safely maintains differential pricing policy per customer, maximizing revenue

**Observable Benefits**:
- Protects customer-specific price discrimination policies
- Prevents renegotiation pressure from price information leaks
- Enables flexible pricing strategies

### 3. "Cash Flow Status Concealment" - Preventing Financial Situation Exposure

**Product Description**:
When companies urgently factor invoices, it signals "cash shortage". If clients know, they change payment terms unfavorably, competitors intensify attacks. ZK enables fundraising while hiding urgency.

**User Experience**:
- Without Privacy: SME A's accounts receivable fire sale becomes known, client B judges "A has cash flow problems" and changes payment terms from cash to 60-day deferred
- With ZK Solution: Factoring as normal cash management, no external exposure of who factored when and how much
- Result: Secures liquidity without exposing financial status, maintains negotiating power with clients

**Observable Benefits**:
- Prevents disadvantages from cash shortage signal exposure
- Perceived as normal financial management
- Protects credit relationships with clients

---

[Back to Enterprise Solutions](../../circuit-addons/g-enterprise/)
