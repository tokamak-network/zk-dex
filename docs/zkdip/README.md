# ZK-DEX Improvement Proposals (ZKDIP)

ZKDIP is the standard format for documenting improvement proposals to the ZK-DEX protocol.

## Purpose

- Systematic documentation of protocol changes
- Facilitate community review and discussion
- Design review before implementation

## ZKDIP List

| Number | Title | Status | Type |
|--------|-------|--------|------|
| [ZKDIP-1](zkdip-1.md) ([KO](zkdip-1_ko.md)) | Fungible Smart Notes | Draft | Standards Track |

## Status Definitions

| Status | Description |
|--------|-------------|
| **Draft** | Initial draft in progress |
| **Review** | Community review in progress |
| **Accepted** | Accepted, awaiting implementation |
| **Implemented** | Implementation complete |
| **Rejected** | Rejected |
| **Superseded** | Replaced by another ZKDIP |

## Type Definitions

| Type | Description |
|------|-------------|
| **Standards Track** | Circuit, contract, or protocol changes |
| **Informational** | Design guidelines, best practices |
| **Meta** | Proposals about the ZKDIP process itself |

## ZKDIP Template

When writing a new ZKDIP, follow this format:

```markdown
# ZKDIP-N: Title

| Field | Value |
|-------|-------|
| **ZKDIP** | N |
| **Title** | Proposal title |
| **Author** | Name/Team |
| **Status** | Draft |
| **Type** | Standards Track / Informational / Meta |
| **Created** | YYYY-MM-DD |
| **Related Issues** | Related issue numbers/links |

## Abstract
One paragraph summary

## Motivation
Why is this change needed?

## Specification
Detailed technical specification

## Rationale
Reasons for design decisions

## Security Considerations
Security-related impacts

## Backwards Compatibility
Compatibility with existing system

## Implementation
Implementation plan/order

## References
Related documents/links
```

## Future Ideas

See [**Future Feature Ideas**](../future/README.md) for 100 feature proposals organized by implementation type:

- **Circuit Add-ons** (65 ideas) - Can be implemented by adding new circuits only
  - [Core Trading](../future/circuit-addons/a-core-trading/) (8)
  - [Time & Conditions](../future/circuit-addons/b-time-conditions/) (6)
  - [Privacy](../future/circuit-addons/c-privacy/) (10)
  - [Governance](../future/circuit-addons/d-governance/) (8)
  - [DeFi](../future/circuit-addons/e-defi/) (15)
  - [NFT & Gaming](../future/circuit-addons/f-nft-gaming/) (10)
  - [Enterprise](../future/circuit-addons/g-enterprise/) (8)

- **Infrastructure Required** (25 ideas) - Need additional off-chain systems
  - [Cross-Chain](../future/infrastructure/h-cross-chain/) (7)
  - [Off-Chain Systems](../future/infrastructure/i-off-chain/) (10)
  - [Protocol Changes](../future/infrastructure/j-protocol/) (8)

- **High Complexity** (10 ideas) - Advanced features with >300K constraints
  - [High Complexity Ideas](../future/high-complexity/)

## Contributing

Anyone can propose a ZKDIP. New proposals start in Draft status and go through a review process before acceptance.
