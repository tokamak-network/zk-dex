# C8. Income Range Proof - Real-World Products & User Experience

[← Back to Technical Specification](../../circuit-addons/c-privacy/c8-income-range.md)

---

## 1. "Income-Based Discrimination Prevention Loan" - Fair Interest Rate Guarantee Loan Service

**Product Description**:
A service that prevents banks from proposing unfavorable interest rates based on income by not disclosing exact income amounts during loan screening.

**User Experience**:
Seo-jun Lim (34, freelancer) wants to get a mortgage loan. Without privacy: he submits all financial information to the bank including tax returns and transaction statements. The bank determines Mr. Lim's exact income (85 million won annually). With this information, the bank judges "this customer has capacity to bear somewhat higher interest" and proposes an interest rate 0.3% higher than the base rate. Additionally, submitted financial information is stored in bank systems for years and utilized for marketing analysis or credit evaluation.

With ZK income range proof: Mr. Lim proves only "annual income in 50-100 million won range." The bank verifies repayment capacity but cannot know whether it's exactly 50 million or 90 million won. The bank applies the same standard interest rate to all "50-100 million won range" customers. Income-based discriminatory interest rate setting becomes fundamentally impossible.

**Observable Benefits**:
- Prevents customized high-interest rate setting through exact income determination
- Blocks financial institutions' long-term financial data accumulation
- Ensures fair interest rate application among customers with same conditions

## 2. "Rent Negotiation Power Protection" - Rental Qualification Proof without Income Exposure

**Product Description**:
A service that proves only payment capacity to landlords during rent contracts while hiding exact income, preventing disadvantage in rent increase negotiations.

**User Experience**:
Ye-jin Han (27, new employee) is looking for an apartment with 1.5 million won monthly rent. Without privacy: she submits salary statements to the landlord. The landlord learns Ms. Han's annual salary is 55 million won. After 1 year at renewal time, the landlord thinks "salary must have increased from last year, so rent should increase too." Information like "this tenant's salary is at this level, so you can charge more" can spread to other landlords in the neighborhood.

With ZK income range proof: Ms. Han proves only "monthly income over 4.5 million won." The landlord verified payment capacity but cannot know exact annual salary. Even at renewal, there's no basis for judging "this tenant has room to spare," making it difficult to demand unreasonable rent increases.

**Observable Benefits**:
- Prevents rent increase pressure through exact income determination
- Blocks income information dissemination through landlord networks
- Maintains negotiating power even at renewal time

## 3. "Dignity-Protecting Welfare Application" - Qualification Proof Service without Shame

**Product Description**:
A service that protects applicants' dignity when applying for low-income subsidies or scholarships by proving only that income is below threshold without disclosing exact financial situation.

**User Experience**:
Seong-ho Park (22, college student) wants to apply for a low-income scholarship. Without privacy: he submits parents' income certificates, property tax assessment certificates, and health insurance payment confirmations. The school scholarship officer views the Park family's exact annual income (28 million won), parents' occupations, and all holdings. This information may be unintentionally mentioned to other staff by the officer, or viewed by multiple people with system access. At small schools, it may become known "who receives low-income scholarships."

With ZK income range proof: Mr. Park proves only meeting the condition of "household income below median 50%." The school verifies eligibility but cannot know whether exact income is 28 million or 15 million won, or what work parents do. Officers only confirm "this student meets eligibility conditions," fundamentally eliminating possibilities of unnecessary information viewing or leakage.

**Observable Benefits**:
- Removes shame from detailed financial situation exposure during welfare application
- Prevents officers' excessive personal information viewing
- Privacy protection by separating welfare benefit fact from specific poverty level

---

[← Back to Technical Specification](../../circuit-addons/c-privacy/c8-income-range.md)
