# C9. Sanctions Compliance - Real-World Products & User Experience

[← Back to Technical Specification](../../circuit-addons/c-privacy/c9-sanctions.md)

---

## 1. "Transaction History Protection Sanctions Verification" - Privacy-Protected Sanctions Compliance Service

**Product Description**:
A service that proves all transaction counterparties are not sanctioned entities while never disclosing who the actual counterparties are. Traditionally, complete transaction history had to be disclosed to financial institutions for sanctions verification.

**User Experience**:
Do-yun Kwon (40, trader) conducts business with multiple partners in Vietnam, Thailand, and Indonesia. Without privacy: when making international transfers at banks, he must submit all partner information. The bank determines Mr. Kwon's entire supply chain network, transaction volume with each partner, and transaction frequency. If this information leaks, competitors can directly approach Mr. Kwon's key suppliers. There have been actual cases of bank employees selling corporate customer information to competitors.

With ZK sanctions verification: Mr. Kwon proves "all transaction counterparties in the past year are not on OFAC or EU sanctions lists." The bank verifies sanctions compliance but cannot know who the counterparties are, how many companies he trades with, or transaction volumes with each. Core trade secrets of supply chain information are protected.

**Observable Benefits**:
- Complete protection of core trade secrets like supply chain network information
- Prevents business damage even if bank transaction information leaks
- Balances sanctions compliance proof with transaction relationship confidentiality

## 2. "DeFi Participant Privacy Protection" - Institutional Anonymous DeFi Entry Service

**Product Description**:
A service that proves sanctions compliance when institutional investors participate in DeFi without externally exposing which protocols or amounts they invested in.

**User Experience**:
Ji-eun Lee, fund manager at ABC Asset Management, invests company funds in DeFi protocols. Without privacy: to report sanctions compliance to regulators, she must submit all DeFi interaction records. These reports become subject to freedom of information requests, allowing competing funds to understand ABC's strategy. Additionally, if DeFi investment scale is disclosed, market actors can launch liquidation attacks targeting ABC's positions.

With ZK sanctions verification: Ms. Lee proves quarterly that "all DeFi interactions are sanctions compliant." Regulators verify compliance but cannot know which protocols ABC invested in, position sizes, or strategies used. Competitors also cannot determine strategy through freedom of information requests.

**Observable Benefits**:
- Proves regulatory compliance without exposing investment strategy
- Protects trade secrets from freedom of information requests
- Blocks liquidation attack risks from DeFi position disclosure

## 3. "Trading Partner Mutual Anonymous Verification" - B2B Privacy-Protected Due Diligence Service

**Product Description**:
A service that verifies counterparties are not sanctioned entities in corporate transactions while allowing both sides to hide their other trading relationships from each other.

**User Experience**:
Hyun-woo Kim, purchasing manager at global manufacturer DEF, wants to contract with new Chinese supplier XYZ. Without privacy: DEF requests sanctions compliance evidence from XYZ, and XYZ submits its major customer list. DEF learns that XYZ also supplies to competitors. Conversely, XYZ also learns about DEF's other suppliers and can use this information in future negotiations.

With ZK sanctions verification: both DEF and XYZ prove only "no transactions with sanctioned entities." DEF cannot know XYZ's other customers, and XYZ cannot know DEF's other suppliers. Both sides verify sanctions compliance while protecting their respective trading networks as trade secrets.

**Observable Benefits**:
- Prevents exposing company's trading relationships to counterparties
- Blocks information leakage that could lead to weakened negotiating power
- Builds business relationships based on mutual trust

---

[← Back to Technical Specification](../../circuit-addons/c-privacy/c9-sanctions.md)
