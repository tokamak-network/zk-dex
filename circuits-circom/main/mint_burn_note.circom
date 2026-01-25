pragma circom 2.1.0;

include "../utils/sha256/sha256_note_address.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";

// MintNBurnNote Circuit (Address-based ownership)
// Proves ownership of a note and verifies correct hash computation
//
// Public inputs: [nh0, nh1, value, tokenType]
// Private inputs: [ownerAddress, vk0, vk1, salt, sk]
// Output: 1 (success)
template MintNBurnNote() {
    // Public inputs
    signal input nh0;          // Note hash part 0 (128 bits)
    signal input nh1;          // Note hash part 1 (128 bits)
    signal input value;        // Note value
    signal input tokenType;    // Token type (0=ETH, 1=DAI)

    // Private inputs
    signal input ownerAddress; // Owner address (160 bits, derived from SHA256(pk))
    signal input vk0;          // Viewing key part 0 (128 bits)
    signal input vk1;          // Viewing key part 1 (128 bits)
    signal input salt;         // Random salt
    signal input sk;           // Secret key

    // Output
    signal output out;

    // 1. Verify ownership: prove sk corresponds to ownerAddress
    // sk -> pk -> SHA256(pk) -> address must match ownerAddress
    component ownership = VerifyOwnershipByAddressStrict();
    ownership.address <== ownerAddress;
    ownership.sk <== sk;

    // 2. Compute note hash
    // hash = SHA256(ownerAddress || value || type || vk0 || vk1 || salt)
    component noteHash = Sha256NoteWithAddress();
    noteHash.ownerAddress <== ownerAddress;
    noteHash.value <== value;
    noteHash.tokenType <== tokenType;
    noteHash.vk0 <== vk0;
    noteHash.vk1 <== vk1;
    noteHash.salt <== salt;

    // 3. Verify hash matches public inputs
    noteHash.out[0] === nh0;
    noteHash.out[1] === nh1;

    // Success
    out <== 1;
}

component main {public [nh0, nh1, value, tokenType]} = MintNBurnNote();
