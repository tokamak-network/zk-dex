# F1. Private NFT Transfer

Confidential transfer of NFT ownership while maintaining on-chain provenance verification and preventing double-spending.

**Constraints**: ~120K | **Complexity**: Low

---

## Background

Private NFT transfers address fundamental privacy issues in digital collectibles:

- **Collector Anonymity**: Public transfers expose collector identities, making high-value collectors targets for social engineering and theft
- **Portfolio Concealment**: Visible NFT holdings reveal wealth, trading strategies, and collection preferences
- **Front-Running Prevention**: Announced transfers of valuable NFTs can be front-run by MEV bots to manipulate market prices
- **Provenance Without Exposure**: Art and collectibles require verifiable history without revealing current ownership

In traditional art markets, ownership is often private with provenance verified through trusted intermediaries. ZK NFT transfers bring this privacy model to blockchain while maintaining trustless verification.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `oldNftHash` | field | Hash commitment of the current NFT note |
| `newNftHash` | field | Hash commitment of the new NFT note |
| `nftId` | uint | Unique identifier of the NFT within collection |
| `collectionAddress` | address | Contract address of the NFT collection |
| `nullifier` | field | Nullifier to prevent double-spending |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `oldOwnerPkX, oldOwnerPkY` | field | Current owner's public key (BabyJubJub) |
| `oldOwnerSk` | field | Current owner's secret key for ownership proof |
| `oldSalt` | field | Randomness in current NFT note |
| `newOwnerPkX, newOwnerPkY` | field | New owner's public key |
| `newSalt` | field | Fresh randomness for new NFT note |
| `metadata` | field | Optional encrypted metadata hash |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/nullifier.circom";

template PrivateNFTTransfer() {
    // ===== Public Inputs =====
    signal input oldNftHash;
    signal input newNftHash;
    signal input nftId;
    signal input collectionAddress;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input oldOwnerPkX, oldOwnerPkY, oldOwnerSk, oldSalt;
    signal input newOwnerPkX, newOwnerPkY, newSalt;
    signal input metadata;

    // ===== 1. Verify Old NFT Note =====
    // NFT note structure: Hash(pkX, pkY, nftId, collectionAddress, salt)
    component oldNft = Poseidon(5);
    oldNft.inputs[0] <== oldOwnerPkX;
    oldNft.inputs[1] <== oldOwnerPkY;
    oldNft.inputs[2] <== nftId;
    oldNft.inputs[3] <== collectionAddress;
    oldNft.inputs[4] <== oldSalt;
    oldNft.out === oldNftHash;

    // ===== 2. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== oldOwnerSk;
    ownership.pkX <== oldOwnerPkX;
    ownership.pkY <== oldOwnerPkY;

    // ===== 3. Compute Nullifier =====
    // Nullifier = Hash(nftId, oldSalt, sk) - prevents double-spend
    component nullifierCalc = Poseidon(3);
    nullifierCalc.inputs[0] <== nftId;
    nullifierCalc.inputs[1] <== oldSalt;
    nullifierCalc.inputs[2] <== oldOwnerSk;
    nullifierCalc.out === nullifier;

    // ===== 4. Create New NFT Note =====
    component newNft = Poseidon(5);
    newNft.inputs[0] <== newOwnerPkX;
    newNft.inputs[1] <== newOwnerPkY;
    newNft.inputs[2] <== nftId;
    newNft.inputs[3] <== collectionAddress;
    newNft.inputs[4] <== newSalt;
    newNft.out === newNftHash;

    // ===== 5. Metadata Integrity (Optional) =====
    // Metadata can be zero for basic transfers
    signal metadataSquare;
    metadataSquare <== metadata * metadata;  // Dummy constraint for optional field
}

component main {public [oldNftHash, newNftHash, nftId, collectionAddress, nullifier]} =
    PrivateNFTTransfer();
```

### Key Constraints

1. **Ownership Verification**: Only the holder of the secret key corresponding to the committed public key can transfer
2. **NFT Identity Preservation**: The same nftId and collectionAddress must be in both old and new notes
3. **Nullifier Uniqueness**: Each NFT note can only be spent once via its unique nullifier
4. **Note Format Compliance**: Both notes follow the standard 5-element Poseidon hash structure

## Effects

| Aspect | Impact |
|--------|--------|
| **Ownership Privacy** | Collector identity hidden from public view |
| **Provenance Verification** | Transfer history verifiable through nullifier chain |
| **Double-Spend Prevention** | Nullifier mechanism ensures each note spent once |
| **Collection Privacy** | Holdings not exposed on-chain |
| **MEV Protection** | Transfer details unknown until commitment |
| **Gas Efficiency** | Single proof verification (~200K gas) |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Key Compromise** | Use hardware wallets; implement social recovery for NFT notes |
| **Nullifier Leakage** | Nullifier derived from secret inputs; cannot be predicted without sk |
| **Replay Across Collections** | Include collectionAddress in note hash to prevent cross-collection replay |
| **Front-Running Registration** | Use commit-reveal for initial NFT note creation |
| **Note Grinding** | Salt provides sufficient entropy; recommend 254-bit random salt |
| **Merkle Tree State** | Contract must maintain nullifier set and note commitment tree |

## Implementation Challenges

1. **Initial Note Creation**
   - How to convert standard ERC-721 to private note?
   - Requires escrow contract that locks NFT and emits note commitment
   - Consider commit-reveal to prevent front-running during wrapping

2. **Unwrapping Mechanism**
   - User may want to return to standard ERC-721
   - Need withdrawal circuit that proves ownership and nullifies note
   - Must handle collection royalty requirements on unwrap

3. **Marketplace Integration**
   - Existing NFT marketplaces cannot verify private ownership
   - Need new marketplace contracts that work with note commitments
   - Consider hybrid approach with optional privacy

4. **Metadata Privacy**
   - NFT metadata often stored on IPFS with public links
   - Consider encrypted metadata with viewer keys
   - Balance between discoverability and privacy

## Derivatives

1. **Batch NFT Transfers** - Transfer multiple NFTs in a single proof, reducing gas costs for collection transfers. Circuit proves ownership of N NFTs and creates N new notes with potentially different recipients. Useful for bulk sales or portfolio rebalancing.

2. **NFT Bundles** - Create atomic bundles of multiple NFTs that can only be transferred together. Bundle hash commits to set of NFT IDs; unbundling requires proof of bundle ownership. Enables curated collection sales.

3. **Private Collections** - Maintain a private mapping of NFTs owned by a single key without revealing individual holdings. Prove membership in collection without exposing specific NFT IDs. Useful for high-value collectors.

4. **NFT Wrapping with Attributes** - Wrap NFTs with additional private attributes (e.g., purchase price, provenance notes). Attributes travel with NFT but remain hidden. Enables private appraisal information.

5. **Cross-Chain NFT Bridge** - Transfer private NFT notes between chains using relay proofs. Circuit on destination chain verifies burn proof from source chain. Maintains privacy across chain boundaries.

## Use Cases

1. **High-Value Art Collectors**
   - Collector acquires rare digital art piece for $500K
   - Transfer to private note hides purchase and ownership
   - Can prove ownership to galleries without public exposure
   - Sells privately to another collector; market never sees transaction price

2. **Gaming Guild Asset Management**
   - Guild holds thousands of gaming NFTs across members
   - Private transfers allow internal redistribution without revealing guild strategy
   - Competitors cannot track which guild holds what assets
   - Exit to public market only when strategically beneficial

3. **Celebrity NFT Ownership**
   - Public figure wants to collect NFTs without media attention
   - Uses private transfers to accumulate collection
   - Can selectively reveal ownership for endorsements
   - Avoids price manipulation from fans tracking celebrity wallets

4. **Estate Planning**
   - Collector prepares succession plan for digital art
   - Transfers to heir's address hidden from public
   - Heir can prove ownership when needed
   - Avoids probate complications with publicly visible assets

## Real-World Products & User Experience

See detailed product descriptions and user experiences: [F1. Private NFT Transfer - Products](../../product/f-nft-gaming/f1-nft-transfer-products.md)

---

[Back to Index](../../README.md)
