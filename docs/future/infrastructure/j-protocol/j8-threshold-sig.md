# J8. Threshold Signatures

Distributed key management enabling M-of-N multi-party signing without reconstructing the private key, essential for secure protocol operations.

**Requirements**: Distributed key generation | Threshold signing protocol | Key refresh mechanism | Integration with ZK proofs

---

## Background

Single-key control creates critical vulnerabilities:

- **Single Point of Failure**: Key compromise means total loss
- **Insider Risk**: Key holder has absolute control
- **Availability**: Key holder unavailability blocks operations
- **Accountability**: Hard to track who authorized what

Threshold signatures address these by:
- Splitting key across multiple parties
- Requiring M-of-N parties to sign
- Never reconstructing the full key
- Enabling secure distributed operations

For ZK-DEX, threshold signatures enable secure protocol administration, bridge operations, and emergency controls.

## Technical Specification

### Architecture Overview

```
Signing Request               Threshold Signing                  Final Signature
+-------------+               +------------------------+         +-------------+
|             |               |                        |         |             |
| Message M   |               |  Party 1 (share s1)    |         |  Valid      |
|             |-------------->|  Party 2 (share s2)    |-------->|  Signature  |
| Requires    |               |  Party 3 (share s3)    |         |  (on M)     |
| 2-of-3      |               |  ...                   |         |             |
+-------------+               |  Party N (share sN)    |         +-------------+
                              |                        |
                              |  Each party:           |
                              |  1. Computes partial   |
                              |  2. Shares partial     |
                              |  3. Combines M partials|
                              |                        |
                              |  Key never assembled   |
                              +------------------------+
```

### Component List

| Component | Description |
|-----------|-------------|
| **DKG Protocol** | Distributed Key Generation for initial setup |
| **Signing Coordinator** | Orchestrates threshold signing sessions |
| **Partial Signature Generator** | Computes party's signature share |
| **Signature Combiner** | Aggregates partial signatures |
| **Key Refresh** | Updates shares without changing public key |
| **ZK Integration** | Proves threshold signature validity |

### Data Flows

1. **Key Generation (DKG)**
   - N parties participate in distributed key generation
   - Each party receives private share
   - Public key published; no one knows full private key

2. **Signing Protocol**
   - Message to sign distributed to parties
   - M parties compute partial signatures
   - Partial signatures combined into valid signature

3. **Key Refresh**
   - Periodically update shares
   - Old shares become invalid
   - Public key remains unchanged

### Threshold Signature Circuit

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/eddsa/eddsa_verify.circom";

template ThresholdSignatureProof(numParties, threshold) {
    // Public inputs
    signal input message;             // Signed message
    signal input publicKey[2];        // Combined public key
    signal input signature[2];        // Final threshold signature
    signal input participantMask;     // Bitmap of participating parties

    // Private inputs
    signal input partialSignatures[numParties][2];  // Each party's partial sig
    signal input participantShares[numParties];     // Public key shares
    signal input participantIndices[numParties];    // Lagrange indices

    // Count participants
    signal participantCount;
    signal countBits[numParties];
    signal runningCount[numParties + 1];
    runningCount[0] <== 0;

    for (var i = 0; i < numParties; i++) {
        countBits[i] <== (participantMask >> i) & 1;
        runningCount[i + 1] <== runningCount[i] + countBits[i];
    }
    participantCount <== runningCount[numParties];

    // Verify threshold met
    component thresholdCheck = GreaterEqThan(8);
    thresholdCheck.in[0] <== participantCount;
    thresholdCheck.in[1] <== threshold;
    thresholdCheck.out === 1;

    // Verify signature combines correctly
    // (Simplified - real TSS uses Lagrange interpolation)
    component sigVerify = EdDSAVerify();
    sigVerify.message <== message;
    sigVerify.pubKey[0] <== publicKey[0];
    sigVerify.pubKey[1] <== publicKey[1];
    sigVerify.signature[0] <== signature[0];
    sigVerify.signature[1] <== signature[1];
    sigVerify.valid === 1;
}

component main {public [message, publicKey, signature, participantMask]} = ThresholdSignatureProof(5, 3);
```

### TSS Schemes

| Scheme | Curve | Rounds | Features |
|--------|-------|--------|----------|
| **FROST** | Ed25519/secp256k1 | 2 | Flexible, efficient |
| **GG20** | secp256k1 | 4-5 | Robust, widely implemented |
| **CGGMP** | secp256k1 | 4 | Identifiable abort |
| **Lindell17** | secp256k1 | 2 | Simple 2-of-2 |

## Effects

| Aspect | Impact |
|--------|--------|
| **Security** | No single point of failure |
| **Availability** | Tolerates up to N-M unavailable parties |
| **Accountability** | Know which parties signed |
| **Flexibility** | Adjustable threshold parameters |
| **Compatibility** | Standard signatures; chain-agnostic |
| **Privacy** | Key shares remain private |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Collusion (M parties)** | Careful party selection; diverse custody |
| **Share Exposure** | Secure key management; HSMs |
| **Protocol Attacks** | Use well-analyzed TSS protocols |
| **Liveness Attacks** | Sufficient margin above threshold |
| **Malicious Abort** | Identifiable abort protocols (CGGMP) |
| **Key Refresh Failure** | Redundant refresh mechanisms |

## Implementation Challenges

1. **Coordination Overhead**
   - Signing requires coordinating M parties
   - Network latency adds to signing time
   - Asynchronous protocols help

2. **Party Availability**
   - Need M parties online simultaneously
   - Geographic distribution complicates timing
   - Consider availability requirements carefully

3. **Key Generation Security**
   - DKG is most sensitive operation
   - All parties must participate honestly
   - Consider multiple DKG ceremonies

4. **Refresh Logistics**
   - Regular refresh needed for security
   - Coordination burden on parties
   - Automate where possible

5. **Threshold Selection**
   - Higher threshold = more security, less availability
   - Lower threshold = more availability, less security
   - Context-dependent optimization

## Derivatives

1. **TSS Key Generation** - Distributed key generation protocol. No trusted dealer. Each party contributes randomness.

2. **Signing Ceremonies** - Coordinated signing sessions. Defined protocol for message approval. Audit trail of participation.

3. **Key Refresh** - Proactive security through share rotation. Old shares invalid after refresh. Limits compromise window.

4. **Proactive Security** - Regular refresh without changing threshold. Eliminates mobile adversary concerns. Essential for long-term security.

5. **Cross-Chain TSS** - Same TSS group signs for multiple chains. Unified key management. Efficient multi-chain operations.

## Use Cases

1. **Protocol Treasury**
   - Protocol funds held in TSS wallet
   - 3-of-5 multisig for spending
   - No single admin can steal funds
   - Transparent governance integration

2. **Bridge Signing**
   - Cross-chain bridge needs signatures
   - TSS committee authorizes transfers
   - Decentralized bridge security
   - No trusted custodian

3. **Emergency Operations**
   - Protocol pause requires TSS signature
   - Prevents unilateral emergency actions
   - Quick response with M-of-N agreement
   - Accountable emergency governance

4. **Oracle Signing**
   - Price feed signed by TSS committee
   - No single oracle can manipulate
   - Fault tolerance for oracle availability
   - Verifiable data authenticity


## Real-World Products & User Experience

See: [../../product/j-protocol/j8-threshold-sig-products.md](../../product/j-protocol/j8-threshold-sig-products.md)

---

[Back to Index](../../README.md)
