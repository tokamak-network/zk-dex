# J6. Witness Encryption

Cryptographic primitive enabling encryption to arbitrary conditions where decryption requires proving the condition is satisfied.

**Requirements**: Witness encryption scheme | Condition circuits | Decryption protocol | Integration with ZK systems

---

## Background

Traditional encryption has limitations for conditional access:

- **Key Management**: Requires pre-shared keys or PKI
- **Trust Requirements**: Often needs trusted parties for conditions
- **Timing Constraints**: Hard to encrypt to future conditions
- **Composability**: Difficult to combine multiple conditions

Witness encryption addresses these by:
- Encrypting directly to a condition (e.g., "can decrypt if you know x such that f(x) = y")
- No trusted setup for condition enforcement
- Natural integration with ZK proof systems
- Enables novel time-lock and conditional access patterns

For ZK-DEX, this enables advanced conditional trading and time-locked mechanisms.

## Technical Specification

### Architecture Overview

```
Encryptor                     Witness Encryption                 Decryptor
+-------------+               +------------------------+         +-------------+
|             |  Encrypt to   |                        |         |             |
| Message M   |  Condition C  |  Ciphertext CT         |  Prove  | Recovered   |
|             |-------------->|  (bound to C)          |<--------|  M          |
| Condition:  |               |                        |  Witness|             |
| "x: f(x)=y" |               +------------------------+         +-------------+
+-------------+                        |
                                       | Anyone with valid
                                       | witness can decrypt
                                       v
                              +------------------------+
                              |  Decryption requires:  |
                              |  - Valid witness w     |
                              |  - Proof that f(w) = y |
                              +------------------------+
```

### Component List

| Component | Description |
|-----------|-------------|
| **Encryption Scheme** | Core witness encryption algorithm |
| **Condition Compiler** | Converts conditions to encryption parameters |
| **Witness Verifier** | Validates witnesses against conditions |
| **Decryption Engine** | Performs decryption given valid witness |
| **Time-Lock Module** | Specialization for time-based conditions |
| **Composition Layer** | Combines multiple conditions |

### Data Flows

1. **Encryption**
   - Define condition as NP statement
   - Encrypt message to the condition
   - Ciphertext can only be decrypted with witness

2. **Witness Acquisition**
   - Decryptor obtains witness (e.g., through computation, time passing)
   - Witness must satisfy condition
   - May involve ZK proof generation

3. **Decryption**
   - Submit witness to decryption algorithm
   - Algorithm verifies witness satisfies condition
   - Message recovered if witness valid

### Witness Encryption Integration

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";

template WitnessDecryption() {
    // Public inputs
    signal input ciphertextCommitment;  // Commitment to encrypted data
    signal input conditionHash;          // Hash of the condition
    signal input decryptedCommitment;    // Commitment to decrypted result

    // Private inputs
    signal input witness[10];            // The witness satisfying condition
    signal input encryptedData[10];      // Encrypted message
    signal input decryptionKey;          // Derived from witness
    signal input decryptedData[10];      // Resulting plaintext
    signal input salt;

    // Verify witness satisfies condition
    // (condition-specific verification would go here)
    component conditionCheck = ConditionVerifier();
    for (var i = 0; i < 10; i++) {
        conditionCheck.witness[i] <== witness[i];
    }
    conditionCheck.conditionHash <== conditionHash;
    conditionCheck.satisfied === 1;

    // Derive decryption key from witness
    component keyDerivation = Poseidon(10);
    for (var i = 0; i < 10; i++) {
        keyDerivation.inputs[i] <== witness[i];
    }
    keyDerivation.out === decryptionKey;

    // Verify decryption is correct
    component decryptVerify = SymmetricDecrypt();
    decryptVerify.key <== decryptionKey;
    for (var i = 0; i < 10; i++) {
        decryptVerify.ciphertext[i] <== encryptedData[i];
        decryptVerify.plaintext[i] <== decryptedData[i];
    }

    // Commit to decrypted data
    component decryptCommit = Poseidon(11);
    for (var i = 0; i < 10; i++) {
        decryptCommit.inputs[i] <== decryptedData[i];
    }
    decryptCommit.inputs[10] <== salt;
    decryptCommit.out === decryptedCommitment;
}

component main {public [ciphertextCommitment, conditionHash, decryptedCommitment]} = WitnessDecryption();
```

## Effects

| Aspect | Impact |
|--------|--------|
| **Conditional Access** | Encryption to arbitrary computable conditions |
| **Trustlessness** | No trusted party needed for condition enforcement |
| **Time-Lock Capability** | Natural support for future-contingent encryption |
| **Composability** | Conditions can be combined logically |
| **Privacy** | Condition revealed only to decryptor |
| **Programmability** | Any NP condition can be used |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Scheme Security** | Use well-analyzed witness encryption constructions |
| **Witness Leakage** | Minimize witness exposure during decryption |
| **Condition Ambiguity** | Precisely specify conditions; formal verification |
| **Timing Attacks** | Constant-time decryption implementations |
| **Quantum Threats** | Consider post-quantum constructions |
| **Implementation Bugs** | Extensive testing; security audits |

## Implementation Challenges

1. **Efficient Constructions**
   - Pure witness encryption is theoretical/inefficient
   - Practical constructions use assumptions (e.g., obfuscation, multilinear maps)
   - Consider functional encryption as practical alternative

2. **Condition Expressiveness**
   - Not all conditions efficiently expressible
   - Circuit size limits practical conditions
   - Trade-off between expressiveness and efficiency

3. **Witness Generation**
   - Decryptor must be able to obtain witness
   - Some conditions have hard-to-obtain witnesses
   - Consider witness availability in design

4. **Integration Complexity**
   - Must integrate with existing ZK infrastructure
   - Witness encryption adds overhead
   - Balance features vs. complexity

5. **Standardization**
   - No widely adopted standards
   - Interoperability challenges
   - Need industry collaboration

## Derivatives

1. **Time-Lock Encryption** - Encrypt to future blockchain state (e.g., block hash). Decryption possible only after time passes. Useful for sealed-bid auctions.

2. **Condition-Based Decryption** - Decrypt when arbitrary condition met. Price reaches threshold, event occurs, etc. Programmable conditional access.

3. **Threshold Decryption** - Require M-of-N witnesses for decryption. Distributed trust model. Combines with witness encryption.

4. **Functional Encryption** - Decrypt only specific function of plaintext. Weaker than full witness encryption. More efficient constructions available.

5. **Attribute-Based Encryption** - Encrypt to attribute policies. Decryption requires matching attributes. Practical form of conditional encryption.

## Use Cases

1. **Sealed-Bid Auctions**
   - Bidders encrypt bids to future block hash
   - No one can see bids before reveal time
   - Decryption only possible after block is mined
   - Trustless sealed-bid mechanism

2. **Conditional Orders**
   - Encrypt order to price condition
   - "Decrypt and execute when ETH > $5000"
   - Order hidden until condition met
   - MEV-resistant conditional trading

3. **Time-Locked Secrets**
   - Encrypt private key to future time
   - Enables trustless key escrow
   - Dead man's switch applications
   - Scheduled information release

4. **Private Smart Contracts**
   - Encrypt contract state to access conditions
   - Only authorized parties can read
   - Conditions enforced cryptographically
   - No trusted execution environment needed


## Real-World Products & User Experience

See: [../../../product/j-protocol/j6-witness-encryption-products.md](../../../product/j-protocol/j6-witness-encryption-products.md)

---

[Back to Index](../../README.md)
