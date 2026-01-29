# Snapshot Voting - Real-World Products & User Experience

**Technical Specification**: [D7. Snapshot Voting](../../circuit-addons/d-governance/d7-snapshot.md)

---

## 1. "Whale Holdings Confidentiality Snapshot" - Voting Eligibility Proof with Hidden Holdings

**Product Description**:
A system proving token holdings at snapshot time for DAO voting, while hiding exact holding amounts. When large holders' stake sizes are exposed, they become hacking targets, or other participants analyze whale influence to act strategically.

**End-User Experience**:
- Important DAO vote, snapshot at block #15000000
- Park holds 1M tokens at that time (5% of total supply)
- Public snapshot: exact holdings public -> whale address identified -> hacking/fraud target
- ZK snapshot: proves only "held tokens at snapshot time," exact amount remains secret
- Voting power applied, but externally unknowable how much Park holds

**Observable Benefits**:
- Prevents targeted attacks from large holder identity/size exposure
- Blocks strategic voting behavior based on whale analysis
- Flash loan attacks still prevented (snapshot-based)

## 2. "Historical Holdings Anonymous Proof" - Participation Eligibility Privacy

**Product Description**:
A system proving only the fact of holding tokens at specific times, while hiding current holding status or transaction history. For cases requiring proof of past participation, but wanting to keep current position private.

**End-User Experience**:
- DeFi protocol migration vote: only existing users eligible to participate
- Lee held LP tokens at snapshot time, but sold afterward
- Publicly: "Lee sold" -> market signal, personal investment strategy exposed
- ZK snapshot: proves only past holding fact - current state and transaction history remain secret
- Result: Exercises voting rights as past participant, maintains current position privacy

**Observable Benefits**:
- Maintains personal investment/trading strategy secrecy
- Separates past participation proof from current state
- Achieves both legitimate eligibility proof and privacy

## 3. "Multi-Chain Anonymous Aggregated Voting" - Cross-Chain Holdings Secret Aggregation

**Product Description**:
A system proving distributed token holdings across multiple chains, while hiding per-chain holdings or totals. When chain-specific distribution is exposed, investment strategy or fund size can be revealed.

**End-User Experience**:
- Multi-chain DAO: tokens distributed across Ethereum, Arbitrum, Polygon
- Kim holds tokens on all 3 chains, total is substantial
- Publicly: distribution analysis -> fund size, preferred chains, bridge patterns exposed
- ZK multi-chain snapshot: proves "sufficient tokens across all chains combined," distribution remains secret
- Result: Exercises combined voting power while maintaining fund distribution strategy privacy

**Observable Benefits**:
- Maintains cross-chain fund distribution pattern secrecy
- Protects large holders' multi-chain strategies
- Achieves both flash loan prevention and privacy
