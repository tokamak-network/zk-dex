# H7. Rollup Settlement - Real-World Products & User Experience

**Technical Specification**: [../../infrastructure/h-cross-chain/h7-rollup.md](../../infrastructure/h-cross-chain/h7-rollup.md)

---

## 1. "Sequencer Blind Rollup" - Privacy from Operator

**Product Description**:
A privacy rollup where even the rollup sequencer cannot see transaction content. Regular rollups allow sequencers to see all transactions and extract MEV.

**User Experience**:
- Ms. Han (24) wants to execute large buy on rollup
- Regular rollup: Sequencer sees transaction and can front-run
- Blind rollup: Transaction encrypted when delivered to sequencer
- Sequencer only orders, cannot see content
- Transaction only processed during batch proof generation

**Observable Benefits**:
- Fundamentally blocks sequencer MEV extraction
- No need to trust rollup operator
- Transaction intent completely private until execution

## 2. "In-Batch Privacy" - Transaction Connection Blocking

**Product Description**:
A privacy layer that prevents multiple transactions included in same batch from being connected. Prevents batch analysis from determining user patterns.

**User Experience (Trader Perspective)**:
- Mr. Kim (30) trades hundreds of times daily
- Regular rollup: "These transactions in same batch are same person" analysis possible
- Privacy batch: Each transaction processed as independent note
- No linkage between transactions within batch
- Kim's high-frequency trading pattern remains hidden

**Observable Benefits**:
- Prevention of trading pattern inference from batch analysis
- Blocks high-frequency trader identification
- Complete secrecy of trading strategy

## 3. "DA Layer Privacy" - Data Availability Also Private

**Product Description**:
A service that encrypts data stored on rollup's data availability layer so even DA nodes cannot see transaction content.

**User Experience**:
- Ms. Yoon (26) uses private payments on rollup
- Regular rollup: Plain transaction data stored on DA layer
- Private DA: Only encrypted data published to DA
- DA node operators also cannot see transaction content
- Only commitments necessary for verification are public

**Observable Benefits**:
- Blocks transaction analysis through DA layer
- Removes "rollup data = public data" assumption
- Complete end-to-end privacy

---

[Back to Index](../../README.md)
