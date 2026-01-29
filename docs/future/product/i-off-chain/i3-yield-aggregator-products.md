# I3. Yield Aggregator - Real-World Products & User Experience

**Technical Specification**: [../../infrastructure/i-off-chain/i3-yield-aggregator.md](../../infrastructure/i-off-chain/i3-yield-aggregator.md)

---

## 1. "Hidden Deposit Size" - Fully Private Deposit Amounts

**Product Description**:
Privacy vault where the deposited amount in yield optimization services remains unknown to external observers. Prevents targeting based on asset size.

**User Experience**:
- Ms. Han (33) wants to deposit $100,000 into DeFi
- Regular vault: "This address deposited $100K" exposed → phishing target
- Private vault: Only commitment recorded, amount hidden
- External observers only know "someone deposited," not the amount
- The fact that Ms. Han is a large depositor remains private

**Observable Benefits**:
- Prevents phishing/hacking targeting based on asset size
- Avoids "wealthy address" labeling
- Blocks identification of large depositors

## 2. "Strategy Allocation Privacy" - Hiding Investment Destinations

**Product Description**:
Service that prevents strategy replication by keeping protocol allocation details private from external observers, protecting yield optimization strategies.

**User Experience**:
- Mr. Kim (48) deposits $50,000 into "Alpha Strategy Vault"
- Regular vault: "This vault allocated 40% Aave, 30% Compound..." exposed
- Private vault: Allocation details encrypted, verified only via ZK
- Competitors cannot "copy this vault's strategy"
- Strategy manager's alpha protected

**Observable Benefits**:
- Prevents replication of high-yield strategies
- Maintains sustainable excess returns
- Protects manager's intellectual property

## 3. "Rebalancing Concealment" - Blocking Strategy Change Signals

**Product Description**:
Privacy rebalancing where vault fund movements between protocols remain hidden, preventing market signals.

**User Experience**:
- Safety Vault plans to move $1M from Protocol A to B
- Regular movement: "Large vault exiting A" → FUD for Protocol A
- Private movement: Movement amount and path executed while hidden
- No market signal that "vault is moving"
- Rebalancing doesn't impact the market

**Observable Benefits**:
- Large movements don't become market signals
- Hides rebalancing intent (risk avoidance?)
- Blocks tracking of fund flows between protocols

---

[Back to Index](../../README.md)
