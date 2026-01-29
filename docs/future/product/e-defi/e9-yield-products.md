# Yield Claim - Real-World Products

**Technical Specification**: [E9. Yield Claim](../../circuit-addons/e-defi/e9-yield.md)

---

## 1. "Yield Reverse-Tracking Blocking" - Principal Size Protection

**Product Description**:
Solving the problem where principal size is reverse-estimated by dividing claim amounts by public APY when yield claim amounts are exposed.

**Typical User Experience**:
- Without Privacy: $50,000 interest claim exposed + public APY 10% → Principal $500,000 reverse-calculated → Whale targeting
- With ZK DeFi: Claim amount private → Principal size estimation impossible
- Result: Yield claiming doesn't lead to asset size exposure

**Observable Benefits**:
- Blocking principal reverse-estimation through interest receipt amounts
- Privacy protection for large depositors
- Asset information protected even during profit realization

## 2. "Strategy Leak Prevention" - Yield Farming Strategy Protection

**Product Description**:
Solving the problem where competitors reverse-track and replicate strategies when high-yield farming yield claim patterns are exposed.

**Typical User Experience**:
- Without Privacy: Repeated high-yield claim pattern from specific pool exposed → Analysts reverse-track strategy → Strategy publicized and yield declines
- With ZK DeFi: Which pool and how much profit is private → Strategy reverse-tracking impossible
- Result: Proprietary yield farming alpha maintained

**Observable Benefits**:
- Confidentiality of high-yield strategies maintained
- Prevention of yield decline from strategy replication
- Protection of professional yield farmers' competitive advantage

## 3. "Claim Rush Prevention" - Protocol Bank Run Blocking

**Product Description**:
Solving the problem where large yield claims exposure causes other users to panic with "is there a problem with the protocol?", simultaneously claiming and causing protocol liquidity crisis.

**Typical User Experience**:
- Without Privacy: Whale's $1M yield claim exposed → "Why withdrawing everything suddenly?" suspicion → Chain claims → Protocol liquidity depletion
- With ZK DeFi: Individual claim size private → Panic signal blocked
- Result: Only rational individual claims exist, bank runs prevented

**Observable Benefits**:
- Blocking market psychology impact of large claims
- Maintained protocol stability
- Guaranteed individual free profit realization
