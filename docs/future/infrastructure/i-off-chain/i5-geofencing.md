# I5. Geofencing

Privacy-preserving geographic compliance infrastructure enabling jurisdiction-based access control without exposing exact user locations.

**Requirements**: Location attestation | ZK location proofs | Jurisdiction mapping | Compliance oracle network

---

## Background

DeFi protocols face increasing regulatory pressure around geographic restrictions:

- **Regulatory Requirements**: Many jurisdictions require blocking certain users
- **Sanctions Compliance**: OFAC and similar lists mandate geographic screening
- **License Limitations**: Some services only licensed in specific regions
- **Privacy Concerns**: Traditional geofencing exposes exact user location

Privacy-preserving geofencing solves these by:
- Proving jurisdiction membership without revealing exact location
- Enabling compliance without centralized location databases
- Supporting traveling users with dynamic attestations
- Balancing regulatory compliance with user privacy

For ZK-DEX, this enables regulatory-compliant operation while preserving user privacy.

## Technical Specification

### Architecture Overview

```
User Device                   Attestation Layer                  ZK-DEX
+------------+                +------------------------+         +-----------+
|            |  Location      |                        |         |           |
| GPS/IP     |  Claim         |  Attestation Oracle 1  |         | Access    |
| Data       |--------------->|  Attestation Oracle 2  |-------->| Control   |
|            |                |  Attestation Oracle 3  |         | Contract  |
+------------+                |         |              |         |           |
      |                       |         v              |         +-----------+
      |                       |  +----------------+    |              |
      v                       |  | Location       |    |              v
+------------+                |  | Aggregator     |    |         +-----------+
| Location   |                |  +----------------+    |         | Allowed   |
| Proof      |                |         |              |         | Juris.    |
| Generator  |--------------->|         v              |         | List      |
+------------+   ZK Proof     |  Jurisdiction Proof    |         +-----------+
                              |  (region, not exact)   |
                              +------------------------+
```

### Component List

| Component | Description |
|-----------|-------------|
| **Location Attestor** | Trusted oracles attesting user location |
| **Proof Generator** | Creates ZK proofs of jurisdiction membership |
| **Jurisdiction Mapper** | Maps coordinates to regulatory regions |
| **Compliance Contract** | Enforces access based on jurisdiction proofs |
| **Update Service** | Handles changing regulations and user travel |
| **Audit Trail** | Privacy-preserving compliance records |

### Data Flows

1. **Attestation Flow**
   - User's device provides location data (GPS, IP, etc.)
   - Multiple attestation oracles verify location
   - Threshold agreement on approximate region

2. **Proof Generation**
   - Location attested to a regulatory region (not exact coordinates)
   - ZK proof generated: "user is in allowed jurisdiction"
   - Proof submitted to access control contract

3. **Access Control**
   - Contract verifies ZK proof validity
   - Checks jurisdiction against allowed list
   - Grants or denies access accordingly

### Geofence Proof Circuit

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/comparators.circom";

template GeofenceProof(numOracles) {
    // Public inputs
    signal input jurisdictionCommitment;  // Commitment to jurisdiction
    signal input userCommitment;          // Hidden user identity
    signal input timestamp;               // Freshness
    signal input allowedJurisdictions[10]; // List of allowed regions

    // Private inputs
    signal input jurisdiction;            // User's actual jurisdiction
    signal input userPk;                  // User public key
    signal input oracleAttestations[numOracles]; // Oracle signatures
    signal input salt;

    // Verify jurisdiction commitment
    component jurisHash = Poseidon(3);
    jurisHash.inputs[0] <== jurisdiction;
    jurisHash.inputs[1] <== timestamp;
    jurisHash.inputs[2] <== salt;
    jurisHash.out === jurisdictionCommitment;

    // Verify user commitment
    component userHash = Poseidon(2);
    userHash.inputs[0] <== userPk;
    userHash.inputs[1] <== salt;
    userHash.out === userCommitment;

    // Check jurisdiction is in allowed list
    signal isAllowed[10];
    signal anyAllowed;
    signal allowedSum[11];
    allowedSum[0] <== 0;

    for (var i = 0; i < 10; i++) {
        component eq = IsEqual();
        eq.in[0] <== jurisdiction;
        eq.in[1] <== allowedJurisdictions[i];
        isAllowed[i] <== eq.out;
        allowedSum[i + 1] <== allowedSum[i] + isAllowed[i];
    }

    // At least one match required
    component allowed = GreaterThan(8);
    allowed.in[0] <== allowedSum[10];
    allowed.in[1] <== 0;
    allowed.out === 1;
}

component main {public [jurisdictionCommitment, userCommitment, timestamp, allowedJurisdictions]} = GeofenceProof(3);
```

## Effects

| Aspect | Impact |
|--------|--------|
| **Compliance** | Meets regulatory requirements for geographic restrictions |
| **Privacy** | Exact location never revealed; only region membership |
| **User Experience** | Seamless access for allowed jurisdictions |
| **Flexibility** | Regulations can update without protocol changes |
| **Auditability** | Compliance provable without exposing user data |
| **Decentralization** | Multiple attestors prevent single point of failure |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **VPN/Proxy Bypass** | Multiple attestation methods; IP + GPS + device |
| **Oracle Collusion** | Threshold requirements; diverse oracle operators |
| **Attestation Spoofing** | Secure enclaves; TEE-based attestation |
| **Stale Proofs** | Short validity periods; timestamp verification |
| **Jurisdiction Changes** | Dynamic allowed list updates; grace periods |
| **Privacy Correlation** | Timing obfuscation; batched attestation |

## Implementation Challenges

1. **Accurate Location Determination**
   - GPS can be spoofed
   - IP geolocation is imprecise
   - Need multiple corroborating signals

2. **Mobile User Handling**
   - Users travel across jurisdictions
   - Need efficient re-attestation
   - Consider validity windows

3. **Regulatory Complexity**
   - Jurisdictions have different requirements
   - Regulations change frequently
   - Need flexible compliance rules

4. **Oracle Trust**
   - Location oracles have significant power
   - Need decentralized oracle network
   - Consider reputation systems

5. **Edge Cases**
   - Users near borders
   - International waters/airspace
   - Disputed territories

## Derivatives

1. **Multi-Zone Compliance** - Support different rules per jurisdiction. EU vs. US vs. Asia requirements. Automated compliance switching.

2. **Traveling Users** - Seamless re-attestation for mobile users. Quick proof updates on jurisdiction change. No service interruption.

3. **VPN Detection** - Identify and handle VPN usage appropriately. Either block or require additional verification. Configurable policy.

4. **Jurisdiction Arbitrage** - Users seeking favorable regulations. Detect jurisdiction shopping. Implement cooling periods.

5. **Location Proofs** - Reusable location credentials. Portable across protocols. Time-bounded validity.

## Use Cases

1. **US Sanctions Compliance**
   - Protocol cannot serve OFAC-listed jurisdictions
   - User proves they're in allowed region
   - Access granted without revealing city/address
   - Compliant operation with user privacy

2. **Licensed Service Access**
   - Derivatives trading licensed in specific jurisdictions
   - User proves eligible jurisdiction membership
   - Trades on licensed platform legally
   - Regulatory requirements satisfied

3. **Regional Token Launch**
   - Token launch excludes US residents (Reg S)
   - Non-US users prove jurisdiction
   - Participate in compliant offering
   - Issuer protected from regulatory risk

4. **Traveling Trader**
   - User normally in US, traveling to EU
   - Re-attests location while abroad
   - Accesses EU-only features temporarily
   - Returns to normal access at home


## Real-World Products & User Experience

See: [../../product/i-off-chain/i5-geofencing-products.md](../../product/i-off-chain/i5-geofencing-products.md)

---

[Back to Index](../../README.md)
