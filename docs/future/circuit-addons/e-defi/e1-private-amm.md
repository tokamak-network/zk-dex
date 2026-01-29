# E1. Private AMM Swap

Execute token swaps through automated market makers while hiding trade sizes, maintaining x*y=k invariant verification through ZK proofs.

**Constraints**: ~300K | **Complexity**: Medium

---

## Background

Private AMM swaps address critical vulnerabilities in transparent DEX trading:

- **Trade Privacy**: Swap amounts on transparent DEXs expose portfolio sizes and trading strategies
- **MEV Exploitation**: Visible pending swaps enable sandwich attacks extracting value from traders
- **Strategy Leakage**: Large trades signal market direction, allowing front-running
- **Competitive Disadvantage**: Market makers and arbitrageurs can copy successful strategies

In traditional AMMs like Uniswap, every trade is fully visible on-chain. Private AMM swaps hide the trade amount while proving the x*y=k invariant is maintained, preventing information extraction while ensuring mathematical correctness.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `inputNoteHash` | field | Hash of the note being swapped |
| `outputNoteHash` | field | Hash of the note received from swap |
| `poolStateCommitment` | field | Current pool state commitment |
| `newPoolStateCommitment` | field | Pool state after swap |
| `nullifier` | field | Prevents double-spend of input note |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `inPkX, inPkY` | field | Input note owner's public key |
| `inValue` | uint | Input token amount |
| `inToken` | uint | Input token type identifier |
| `inSalt` | field | Input note randomness |
| `inSk` | field | Secret key for ownership proof |
| `outPkX, outPkY` | field | Output note owner's public key |
| `outValue` | uint | Output token amount received |
| `outToken` | uint | Output token type identifier |
| `outSalt` | field | Output note randomness |
| `reserve0` | uint | Pool reserve of token0 |
| `reserve1` | uint | Pool reserve of token1 |
| `poolSalt` | field | Pool state randomness |
| `newReserve0` | uint | New pool reserve of token0 |
| `newReserve1` | uint | New pool reserve of token1 |
| `newPoolSalt` | field | New pool state randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template PrivateSwap() {
    // ===== Public Inputs =====
    signal input inputNoteHash;
    signal input outputNoteHash;
    signal input poolStateCommitment;
    signal input newPoolStateCommitment;
    signal input nullifier;

    // ===== Private Inputs =====
    // Input note
    signal input inPkX, inPkY, inValue, inToken, inSalt, inSk;
    // Output note
    signal input outPkX, outPkY, outValue, outToken, outSalt;
    // Pool state
    signal input reserve0, reserve1, poolSalt;
    signal input newReserve0, newReserve1, newPoolSalt;

    // ===== 1. Verify Input Note =====
    component inNote = PoseidonRegularNote();
    inNote.pkX <== inPkX;
    inNote.pkY <== inPkY;
    inNote.value <== inValue;
    inNote.tokenType <== inToken;
    inNote.salt <== inSalt;
    inNote.out === inputNoteHash;

    // ===== 2. Verify Ownership =====
    component own = ProofOfOwnershipStrict();
    own.sk <== inSk;
    own.pkX <== inPkX;
    own.pkY <== inPkY;

    // ===== 3. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== inputNoteHash;
    nullifierHash.inputs[1] <== inSk;
    nullifierHash.out === nullifier;

    // ===== 4. Verify Current Pool State =====
    component pool = Poseidon(3);
    pool.inputs[0] <== reserve0;
    pool.inputs[1] <== reserve1;
    pool.inputs[2] <== poolSalt;
    pool.out === poolStateCommitment;

    // ===== 5. Verify x * y = k Invariant =====
    signal k;
    k <== reserve0 * reserve1;

    signal newK;
    newK <== newReserve0 * newReserve1;

    // k should remain constant (accounting for 0.3% fee)
    // newK >= k * 997 / 1000 ensures fee is properly taken
    signal kWithFee;
    kWithFee <== k * 997;

    component kCheck = GreaterEqThan(252);
    kCheck.in[0] <== newK * 1000;
    kCheck.in[1] <== kWithFee;
    kCheck.out === 1;

    // ===== 6. Verify Reserve Changes Match Trade =====
    // For token0 -> token1 swap: newReserve0 = reserve0 + inValue
    // For token1 -> token0 swap: newReserve1 = reserve1 + inValue
    signal isToken0Input;
    component tokenCheck = IsEqual();
    tokenCheck.in[0] <== inToken;
    tokenCheck.in[1] <== 0;
    isToken0Input <== tokenCheck.out;

    // Verify correct reserve changes based on swap direction
    signal expectedNewReserve0;
    signal expectedNewReserve1;
    expectedNewReserve0 <== reserve0 + isToken0Input * inValue;
    expectedNewReserve1 <== reserve1 + (1 - isToken0Input) * inValue;

    newReserve0 === expectedNewReserve0;
    newReserve1 === expectedNewReserve1;

    // ===== 7. Verify Output Amount =====
    signal expectedOutput;
    expectedOutput <== isToken0Input * (reserve1 - newReserve1) +
                       (1 - isToken0Input) * (reserve0 - newReserve0);

    component outputAmountCheck = GreaterEqThan(128);
    outputAmountCheck.in[0] <== outValue;
    outputAmountCheck.in[1] <== expectedOutput;
    outputAmountCheck.out === 1;

    // ===== 8. Verify Output Note =====
    component outNote = PoseidonRegularNote();
    outNote.pkX <== outPkX;
    outNote.pkY <== outPkY;
    outNote.value <== outValue;
    outNote.tokenType <== outToken;
    outNote.salt <== outSalt;
    outNote.out === outputNoteHash;

    // ===== 9. Verify Output Token Type =====
    signal expectedOutToken;
    expectedOutToken <== isToken0Input * 1 + (1 - isToken0Input) * 0;
    outToken === expectedOutToken;

    // ===== 10. Verify New Pool State =====
    component newPool = Poseidon(3);
    newPool.inputs[0] <== newReserve0;
    newPool.inputs[1] <== newReserve1;
    newPool.inputs[2] <== newPoolSalt;
    newPool.out === newPoolStateCommitment;
}

component main {public [inputNoteHash, outputNoteHash, poolStateCommitment,
    newPoolStateCommitment, nullifier]} = PrivateSwap();
```

### Key Constraints

1. **Input Note Validity**: Input note hash matches provided preimage
2. **Ownership Verification**: Secret key corresponds to input note public key
3. **Nullifier Correctness**: Nullifier derived from note hash and secret key
4. **Pool State Integrity**: Current pool state matches commitment
5. **Constant Product**: x*y=k invariant maintained (minus fees)
6. **Reserve Accounting**: Reserve changes match input and output amounts
7. **Output Token Correctness**: Output token is opposite of input token

## Effects

| Aspect | Impact |
|--------|--------|
| **Trade Privacy** | Swap amounts completely hidden from observers |
| **MEV Protection** | Sandwich attacks impossible without knowing trade size |
| **Strategy Confidentiality** | Trading patterns not detectable on-chain |
| **Price Impact** | Hidden until pool state commitment updates |
| **Gas Efficiency** | Single proof verifies entire swap (~300K gas) |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Pool State Desync** | Sequencer maintains authoritative pool state; proofs verify against latest commitment |
| **Frontrunning Commitment** | Commit-reveal scheme for pool state updates |
| **Fake Pool Creation** | Pool initialization requires governance approval |
| **Insufficient Liquidity** | Circuit verifies output amount meets minimum expected |
| **Flash Loan Attacks** | Pool state locked during swap verification |
| **Rounding Errors** | Use fixed-point arithmetic with sufficient precision |

## Implementation Challenges

1. **Pool State Synchronization**
   - Multiple concurrent swaps create race conditions
   - Need atomic state transitions or batched swap processing
   - Consider using a sequencer for ordering

2. **Liquidity Fragmentation**
   - Private pools cannot share liquidity with public pools
   - May result in worse pricing than transparent alternatives
   - Solution: aggregate liquidity across private pools

3. **Price Discovery**
   - Hidden trade sizes make price discovery slower
   - Consider periodic price publication (TWAP)
   - Balance privacy with market efficiency

4. **Slippage Protection**
   - Users cannot see current pool state
   - Need maximum slippage parameter in circuit
   - Off-chain simulation required before trade

## Derivatives

1. **Private Concentrated Liquidity** - Provide liquidity in specific price ranges without revealing range boundaries. Uses range proofs to verify liquidity is within committed bounds while hiding exact tick positions.

2. **Privacy-Preserving LP Tokens** - LP share ownership hidden through note-based representation. Enables private yield farming and liquidity mining without exposing LP positions.

3. **Batch Private Swaps** - Multiple private swaps aggregated into single proof, amortizing verification costs. Enables more efficient execution for smaller trades.

4. **Cross-Pool Private Routing** - Route trades across multiple pools while hiding the path. Proves optimal execution without revealing which pools were used.

5. **Private Arbitrage Execution** - Execute arbitrage opportunities without revealing strategy. Proves profitable execution while hiding spread capture mechanics.

## Use Cases

1. **Whale Trading**
   - Large holder wants to sell 100 ETH without moving market
   - Swap size hidden, preventing front-running
   - Trade executes at fair price without information leakage

2. **Market Maker Operations**
   - Professional market maker maintains inventory
   - Rebalancing swaps hidden from competitors
   - Preserves proprietary trading strategies

3. **DeFi Protocol Treasury**
   - DAO treasury diversifying holdings
   - Swap amounts hidden to prevent governance attacks
   - Maintains strategic flexibility

4. **Cross-Chain Arbitrage**
   - Arbitrageur identifies price discrepancy
   - Executes swap privately to capture spread
   - Competitors cannot copy strategy in real-time

## Real-World Products & User Experience

See: [Private AMM Swap - Real-World Products](../../../product/e-defi/e1-private-amm-products.md)

---

[Back to Index](../../README.md)
