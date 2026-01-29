# C5. Selective Disclosure - Real-World Products & User Experience

[← Back to Technical Specification](../../circuit-addons/c-privacy/c5-selective-disclosure.md)

---

## 1. "Identity Verification without Full Disclosure" - Minimal Information Authentication Service

**Product Description**:
A service that allows selective disclosure of only necessary information in situations requiring identity verification, hiding the rest. For example, during age verification, it proves only "over 19 years old" rather than the full date of birth.

**User Experience**:
Min-jae Song (25, graduate student) wants to join an adult-only NFT marketplace. Previously, he had to submit his entire resident registration number or ID card. With this service, Mr. Song cryptographically proves only the fact that he is "over 19 years old." The marketplace can confirm age verification, but cannot know Mr. Song's exact age, name, address, or other information. The necessary verification is completed with minimal information.

**Observable Benefits**:
- Discloses only information essential for verification, perfectly protecting the rest
- Eliminates identity theft risks from full ID exposure
- Enables customized information disclosure for various services

## 2. "Token Holding Authentication" - NFT/Token Ownership Proof Service

**Product Description**:
A service that proves only the fact of holding specific tokens or NFTs while hiding holding amounts or other asset information.

**User Experience**:
Yu-jin Jung (30, office worker) wants to join a popular NFT community. The membership condition is holding at least 1 of the specific NFT. Using the selective disclosure feature, Ms. Jung proves only the fact of being a "holder of the NFT." The community can verify membership eligibility, but cannot know how many she holds, what other NFTs she owns, or the total value of her wallet. She can participate in the community while maintaining privacy.

**Observable Benefits**:
- Proves only eligibility conditions while keeping entire portfolio private
- Prevents discrimination or targeting based on NFT holding amounts
- Prevents disclosure of more information than necessary for community membership

## 3. "Transaction Range Proof" - Anonymous Investment Scale Verification Service

**Product Description**:
A service that proves only that an investment amount is within a specific range without disclosing the exact amount.

**User Experience**:
Dong-hyun Hwang (38, investor) wants to join a private investment club. The club's condition is "total investment between 50 million and 500 million won." Using the selective disclosure service, Mr. Hwang proves only that his investment falls within this range. The club verifies eligibility, but cannot know exactly how much Mr. Hwang has or what assets he's invested in. Mr. Hwang can access the club's investment information without exposing his asset scale.

**Observable Benefits**:
- Privacy protection by disclosing only range instead of exact asset scale
- Prevents wealthy targeting attacks or fraud
- Minimizes unnecessary information exposure when participating in investment communities

---

[← Back to Technical Specification](../../circuit-addons/c-privacy/c5-selective-disclosure.md)
