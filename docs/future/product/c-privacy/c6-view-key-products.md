# C6. View Key Delegation - Real-World Products & User Experience

[← Back to Technical Specification](../../circuit-addons/c-privacy/c6-view-key.md)

---

## 1. "Privacy-Protected Tax Agency" - Tax Filing Service without Asset Exposure

**Product Description**:
A service that provides tax accountants with only the transaction information necessary for tax calculations while completely hiding overall asset status or other account information. Traditional methods required disclosing all financial information to tax accountants.

**User Experience**:
Su-bin Choi (33, self-employed) has many cryptocurrency transactions, making tax filing complex. Without privacy: she must give the tax accountant full wallet access or export and share all transaction history as CSV. The accountant learns Ms. Choi's total asset scale, investment strategy, and other wallet addresses. If this information leaks, she could become a target for cyber attacks.

With view key delegation: Ms. Choi generates a restricted view key that can only see "taxable transactions for 2024." The tax accountant can verify only transactions needed for tax calculation and cannot know Ms. Choi's current holdings, other wallets, or total asset scale. Without fund transfer authority, embezzlement risk is fundamentally eliminated.

**Observable Benefits**:
- Prevents targeted attacks by completely blocking asset information unnecessary for tax calculation
- Current asset status remains safe even if accountant's information leaks
- Automatic access blocking after period expiry prevents permanent information exposure

## 2. "Audit Response Privacy System" - Selective Disclosure Audit Service

**Product Description**:
A service that allows companies or funds undergoing audits to disclose only specific transaction records necessary for the audit while hiding trade secrets or strategic positions.

**User Experience**:
Do-hyun Kim, portfolio manager at ABC Investment Fund, must undergo annual external audits. Without privacy: he must provide complete transaction logs to auditors. Auditors learn all of the fund's investment strategies, trading timing, and returns. If auditors switch to competing funds, this information could leak. Some audit firms simultaneously handle multiple competing firms.

With view key delegation: Mr. Kim issues scope-limited view keys that can only access "transactions necessary for compliance verification." Auditors can verify absence of illegal transactions but cannot see specific investment strategies or undisclosed positions. Keys automatically expire after audit completion.

**Observable Benefits**:
- Can prove regulatory compliance without exposing investment strategies
- Core trade secrets protected even if auditor information leaks
- Clearly limits audit scope to prevent excessive information requests

## 3. "Divorce Litigation Asset Protection" - Privacy Service for Legal Disputes

**Product Description**:
A service that selectively discloses only necessary property information to courts or opposing attorneys during legal disputes such as divorce, while protecting assets unrelated to the dispute.

**User Experience**:
Hyun-woo Park (50, doctor) is going through divorce proceedings. The court requires asset disclosure for property division. Without privacy: he must disclose all wallet addresses, transaction history, and holdings. Opposing counsel can use this information to track hidden assets or exploit disclosed information in negotiations. Due to blockchain transparency, all past and future transactions of disclosed addresses are permanently exposed.

With view key delegation: Mr. Park provides a restricted view key to the court-appointed accountant that can only see "assets formed during marriage." The accountant can verify only assets subject to property division and cannot see pre-marital assets or inherited property. The opposing party also cannot know specific wallet addresses, making future tracking impossible.

**Observable Benefits**:
- Prevents excessive exposure by disclosing only information necessary for legal disputes
- Blocks opposing party's continuous asset tracking
- Maintains financial privacy even after dispute resolution

---

[← Back to Technical Specification](../../circuit-addons/c-privacy/c6-view-key.md)
