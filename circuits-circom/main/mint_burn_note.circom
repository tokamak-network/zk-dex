pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";

// MintNBurnNote Circuit (Poseidon-based, Address-based ownership)
// Proves ownership of a note and verifies correct hash computation
//
// Public inputs: [noteHash, value, tokenType]
// Private inputs: [ownerAddress, vk0, vk1, salt, sk]
// Output: 1 (success)
template MintNBurnNote() {
    // Public inputs
    signal input noteHash;     // Note hash (single field element)
    signal input value;        // Note value
    signal input tokenType;    // Token type (0=ETH, 1=DAI)

    // Private inputs
    signal input ownerAddress; // Owner address (160 bits, derived from Poseidon(pk))
    signal input vk0;          // Viewing key part 0 (128 bits)
    signal input vk1;          // Viewing key part 1 (128 bits)
    signal input salt;         // Random salt
    signal input sk;           // Secret key

    // Output
    signal output out;

    // 1. Verify ownership: prove sk corresponds to ownerAddress
    // sk -> pk -> Poseidon(pk) -> truncate(160) -> address must match ownerAddress
    component ownership = VerifyOwnershipByAddressStrict();
    ownership.address <== ownerAddress;
    ownership.sk <== sk;

    // 2. Compute note hash using Poseidon
    // hash = Poseidon(ownerAddress, value, type, vk0, vk1, salt)
    component hash = PoseidonNoteWithAddress();
    hash.ownerAddress <== ownerAddress;
    hash.value <== value;
    hash.tokenType <== tokenType;
    hash.vk0 <== vk0;
    hash.vk1 <== vk1;
    hash.salt <== salt;

    // 3. Verify hash matches public input
    hash.out === noteHash;

    // Success
    out <== 1;
}

component main {public [noteHash, value, tokenType]} = MintNBurnNote();
