# C7. Compliance Proof (AML) - Real-World Products & User Experience

[← Back to Technical Specification](../../circuit-addons/c-privacy/c7-compliance.md)

---

## 1. "International Remittance Privacy Service" - Compliant Remittance without Amount Exposure

**Product Description**:
A service that complies with AML regulations during international remittances without disclosing exact remittance amounts or purposes to financial institutions. Traditionally, all information for remittances over $10,000 was recorded in databases.

**User Experience**:
Tae-young Kang (37, overseas worker) sends monthly living expenses from abroad to his family domestically. Without privacy: with each remittance, exact amount, recipient information, and purpose are recorded in the bank system. This data is retained for years and accessible to bank employees. Like the 2024 incident where a major bank employee illegally sold customer remittance records, if this information leaks, Mr. Kang's income level, dependent family situation, and spending patterns are all exposed.

With ZK compliance proof: Mr. Kang cryptographically proves only the fact of "remittance under $10,000." The bank verifies AML compliance but cannot know the exact amount (whether $3,500 or $8,000). Only "compliance verified" is recorded in the database, protecting sensitive financial information even in future data breaches.

**Observable Benefits**:
- Protects exact amount information even during financial institution data breaches
- Fundamentally blocks bank employees' personal information viewing and exploitation
- Hides sensitive information while maintaining compliance records

## 2. "Exchange Withdrawal Tracking Prevention" - Privacy Recovery Service After KYC

**Product Description**:
A service that prevents centralized exchanges from tracking subsequent fund flows when KYC-completed users withdraw, while maintaining AML compliance.

**User Experience**:
Ji-hye Yoon (29, office worker) wants to withdraw cryptocurrency from Upbit for DeFi investing. Without privacy: the exchange links Ms. Yoon's KYC information (name, resident number, address) with withdrawal address. Blockchain analysis tools can track which DeFi protocols Ms. Yoon uses, how much profit she makes, and what NFTs she purchases. Some exchanges use this data for marketing or sell it to third parties.

With ZK compliance proof: during withdrawal, Ms. Yoon proves "AML-compliant withdrawal." The exchange meets regulatory requirements, and funds move to Ms. Yoon's new wallet through a privacy pool. The exchange only knows Ms. Yoon "legally withdrew" and cannot track any subsequent DeFi activities.

**Observable Benefits**:
- Liberation from exchange's indefinite behavior tracking
- Severs connection between KYC information and on-chain activities
- Fundamentally blocks exchange's data selling or marketing utilization

## 3. "Corporate Transaction Confidentiality Protection" - B2B Payment Amount Anonymization Service

**Product Description**:
A service that proves compliance during corporate cryptocurrency transactions while preventing transaction amounts from being exposed to competitors or blockchain analysis firms.

**User Experience**:
Min-su Kim, CFO of ABC startup, must pay license fees to an overseas AI solution provider. Without privacy: once ABC's wallet address becomes known on the blockchain, anyone can see all payment history. Competitors analyze how much ABC pays to which companies to understand cost structures. VC investors calculate fund burn rate. Even headhunters estimate executive salaries.

With ZK compliance proof: Mr. Kim proves "legal transaction fulfilling AML reporting obligations" and makes payment. Regulatory authorities can verify if necessary, but transaction amounts are hidden on the blockchain. Competitors can see ABC "made a payment" but cannot specify the amount or counterparty.

**Observable Benefits**:
- Blocks competitors' cost structure reverse engineering and business information capture
- Protection from unauthorized financial analysis by investors/analysts
- Perfect balance of regulatory compliance and business confidentiality

---

[← Back to Technical Specification](../../circuit-addons/c-privacy/c7-compliance.md)
