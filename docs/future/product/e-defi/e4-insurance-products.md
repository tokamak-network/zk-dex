# Insurance Buy/Claim - Real-World Products

**Technical Specification**: [E4. Insurance Buy/Claim](../../circuit-addons/e-defi/e4-insurance.md)

---

## 1. "Hack Insurance Stealth" - Insurance Targeting Attack Defense

**Product Description**:
Solving the problem where hackers prioritize protocols with large DeFi insurance coverage, reasoning "it will be covered anyway" when insurance subscriptions are exposed.

**Typical User Experience**:
- Without Privacy: Protocol's $50M insurance subscription public → Hackers judge "user damage minimal since insured" → Attack priority increases
- With ZK DeFi: Insurance coverage size and conditions private → Hackers cannot use as target selection criteria
- Result: Problem solved where insurance subscription paradoxically becomes attack incentive

**Observable Benefits**:
- Prevention of insurance information being exploited for hacker target selection
- Blocking protocol TVL reverse-estimation from insurance size
- Mitigation of insurance market adverse selection problem

## 2. "Claim Panic Defense" - Insurance Claim Bank Run Prevention

**Product Description**:
Preventing "claim bank runs" where other users panic and rush additional claims when large insurance claims are exposed on-chain.

**Typical User Experience**:
- Without Privacy: Whale's $10M insurance claim exposed → "What's happening?" panic → Other users anxiously rush claims → Insurance pool depleted
- With ZK DeFi: Claim size private → Individual claims don't affect market psychology
- Result: Calm claim processing, insurance pool stability maintained

**Observable Benefits**:
- Prevention of chain panic reactions from large claim exposure
- Blocking unnecessary doubt about insurance pool's payment capacity
- Creating environment for rational individual claim decisions

## 3. "Exploit Detection Defense" - Vulnerability Information Leak Prevention

**Product Description**:
Solving the problem where hackers infer "there must be a vulnerability" when spikes in insurance subscriptions for specific risk types are exposed.

**Typical User Experience**:
- Without Privacy: Spike in specific protocol oracle risk insurance subscriptions exposed → Hackers concentrate search on oracle vulnerabilities → Attack succeeds
- With ZK DeFi: Which risk types insurance is concentrating on opaque → Blocking vulnerability hint provision
- Result: Prevention of insurance market becoming hackers' information source

**Observable Benefits**:
- Blocking insurance subscription patterns from becoming vulnerability hints
- Equal information environment for both white hat and black hat
- Guaranteed neutrality of insurance market
