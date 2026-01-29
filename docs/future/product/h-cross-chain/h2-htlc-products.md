# H2. HTLC Atomic Swap - Real-World Products

**Technical Specification**: [H2. HTLC Atomic Swap](../../infrastructure/h-cross-chain/h2-htlc.md)

---

## Real-World Products & User Experience

### 1. "Chain Link Breaker" - Cross-Chain Transaction Link Blocking Service

**Product Description**:
A privacy swap using ZK-HTLC that prevents transactions on two chains from being connected. Regular HTLC uses the same hash to link transactions on both chains, making them trackable.

**User Experience**:
- Mr. Choi (31) wants to exchange Bitcoin for ZK-DEX tokens
- Regular HTLC: Same preimage is revealed on both chains, linking the transactions
- ZK-HTLC: Knowledge of preimage is proven with ZK, not revealed on-chain
- Bitcoin transaction and ZK-DEX transaction appear as separate, unrelated transactions
- Blockchain analysts cannot track Choi's cross-chain activities

**Observable Benefits**:
- Complete blocking of transaction linkage between two chains
- Prevention of cross-chain asset flow tracking
- Hides activities on other chains even from counterparty

### 2. "Secret Cross-Chain OTC" - Large Transaction Complete Privacy

**Product Description**:
An institutional-grade privacy service where transaction amount, participants, and timing are all hidden during large cross-chain swaps.

**User Experience**:
- Ms. Jung (35) wants to exchange $500,000 worth of ETH for BTC
- Regular swap: "This wallet made a large swap" is public on both chains
- Secret OTC: Amount is hidden in commitment, with ZK proof of accurate exchange
- Transaction amounts are not visible on either chain
- The fact that Jung is a large trader remains private

**Observable Benefits**:
- Transaction size not exposed to market, eliminating price impact
- Prevention of "whale" labeling and tracking
- Asset size remains private even from counterparty

### 3. "Private Onramp" - Transparent Asset to Private Conversion

**Product Description**:
A service that hides the conversion process itself when converting stablecoins from public chains to private assets on ZK-DEX.

**User Experience**:
- Mr. Park (27) wants to privately manage his USDC salary
- Regular bridge: "Park sent USDC to private chain" is public
- Private onramp: Exchange via HTLC with no linkage
- On Ethereum: "USDC transfer to someone", on ZK-DEX: "New private asset"
- Two events are not connected, hiding the privacy conversion itself

**Observable Benefits**:
- Movement to privacy chain itself remains private
- Hides the signal "this person wants privacy"
- Blocks connection between private and public assets
