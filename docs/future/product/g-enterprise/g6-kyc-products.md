# KYC Verify - Real-World Products

[Technical Specification](../../circuit-addons/g-enterprise/g6-kyc.md)

---

## Real-World Products & User Experience

### 1. "Identity Verification, Identity Not Stored" - KYC Unknown Even to Service Provider

**Product Description**:
Identity verification is necessary for KYC regulatory compliance, but if service providers store identity information, it gets mass leaked during hacking. ZK verifies "regulatory requirements met" but service provider never sees or stores actual identity information.

**User Experience**:
- Without Privacy: After submitting ID card, address, contact info to Exchange A, 3 months later hacking leaks 500,000 people's personal information
- With ZK Solution: Submit only "age 19+, Korea resident, not sanctioned" proof, exchange never receives ID number or address in first place
- Result: Even if exchange gets hacked, no personal information to leak

**Observable Benefits**:
- No personal information leak even if service provider gets hacked
- Eliminates personal information leak lawsuit/compensation risks
- Fundamentally blocks user identity theft damage

### 2. "Anonymous Qualified Investor Certification" - Hide Asset Scale, Prove Only Qualification

**Product Description**:
When asset details are disclosed for qualified investor certification, fund managers, securities firm employees learn asset scale, creating targeted marketing or information leak risks. ZK proves only "net assets above 300 million" condition while keeping actual asset scale private.

**User Experience**:
- Without Privacy: 5 billion won asset holdings become known to fund company, resigned employee sells information to voice phishing organization
- With ZK Solution: Prove only "qualified investor criteria met", fund company doesn't know whether assets are 300 million or 5 billion
- Result: Prevents criminal targeting due to asset scale exposure

**Observable Benefits**:
- Prevents high-net-worth individuals becoming crime targets
- Blocks information leaks through financial institution employees
- Prevents excessive sales contacts

### 3. "Identity Unlinkability Across Services" - Untraceable Even Using Multiple Services

**Product Description**:
When same identity information submitted to multiple financial services, data combination across services can build complete personal financial activity profile. ZK submits different anonymous proofs to each service, tracking whether same person impossible.

**User Experience**:
- Without Privacy: Same ID card submitted to Exchange A, Securities B, Bank C → data broker combines 3 services' information to create complete financial profile
- With ZK Solution: Submit independent ZK proof to each service, cannot link whether same person
- Result: Cannot grasp complete personal financial activity picture, privacy protected

**Observable Benefits**:
- Blocks personal information linking/tracking across services
- Prevents discrimination based on financial profiling
- Protects individual's financial activity self-determination rights

---

[Back to Enterprise Solutions](../../circuit-addons/g-enterprise/)
