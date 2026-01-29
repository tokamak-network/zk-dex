# H3. Wrapped Asset Bridge - Real-World Products

**Technical Specification**: [H3. Wrapped Asset Bridge](../../infrastructure/h-cross-chain/h3-wrapped-asset.md)

---

## Real-World Products & User Experience

### 1. "Hidden Wrapping Amount" - Wrapping Amount Privacy Service

**Product Description**:
A privacy wrapping service where the amount wrapped is not publicly exposed. Regular WBTC and WETH wrapping amounts are completely public.

**User Experience**:
- Mr. Kim (40, entrepreneur) wants to use 10 BTC on ZK-DEX
- Regular wrapping: "Kim's address wrapped 10 BTC into WBTC" is public
- Private wrapping: Amount is wrapped while hidden in commitment
- Externally only wrapping event is visible, amount is unknown
- Kim's asset size is not exposed during wrapping process

**Observable Benefits**:
- Prevention of asset size estimation through wrapping amounts
- Avoidance of "whale" tracking during large wrapping
- Blocks inference of financial situation from bridge usage patterns

### 2. "Origin Concealment Wrapping" - Source Chain Anonymization

**Product Description**:
A privacy wrapping service where tracking which chain wrapped assets came from and when they were wrapped becomes impossible.

**User Experience**:
- Ms. Lee (33) holds ETH on Ethereum, Polygon, and Arbitrum
- Regular wrapping: Source chain is distinguishable for each
- Origin concealment wrapping: All wrapped assets appear identical
- Lee's zkETH origin chain cannot be distinguished
- Chain-specific holdings cannot be reverse-tracked

**Observable Benefits**:
- Multi-chain portfolio composition remains private
- Complete fungibility between wrapped assets
- Removal of "tainted" labels from specific chain assets

### 3. "Selective Disclosure Wrapping" - Compliance-Friendly Private Bridge

**Product Description**:
An institutional privacy wrapping that hides wrapping amounts by default but allows selective disclosure to specific auditors when necessary.

**User Experience (Institutional Perspective)**:
- ABC Fund wraps and manages $50M on ZK-DEX
- Competitors: Cannot see wrapping amount, unable to determine AUM
- Auditors: Can verify wrapping amount with viewing key provided by fund
- Regulators: Can audit complete history with separate key when needed
- Achieves both privacy and regulatory compliance

**Observable Benefits**:
- Keeps AUM private from competitors
- Can provide immediate proof when regulations require
- "How much is being managed" protected as trade secret
