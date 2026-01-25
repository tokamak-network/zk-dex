pragma circom 2.1.0;

include "../utils/sha256/sha256_note_address.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";

// MakeOrder Circuit (Address-based ownership)
// Proves maker owns a note for creating an order
// Similar to MintNBurnNote but with different public inputs
//
// Public inputs: [nh0, nh1, tokenType]
// Private inputs: [ownerAddress, value, vk0, vk1, salt, sk]
// Output: 1 (success)
template MakeOrder() {
    // Public inputs
    signal input nh0;          // Note hash part 0 (128 bits)
    signal input nh1;          // Note hash part 1 (128 bits)
    signal input tokenType;    // Token type (public for order matching)

    // Private inputs
    signal input ownerAddress; // Owner address (160 bits)
    signal input value;        // Note value (private)
    signal input vk0;          // Viewing key part 0
    signal input vk1;          // Viewing key part 1
    signal input salt;         // Random salt
    signal input sk;           // Secret key

    // Output
    signal output out;

    // 1. Verify ownership (address-based)
    component ownership = VerifyOwnershipByAddressStrict();
    ownership.address <== ownerAddress;
    ownership.sk <== sk;

    // 2. Compute note hash
    component noteHash = Sha256NoteWithAddress();
    noteHash.ownerAddress <== ownerAddress;
    noteHash.value <== value;
    noteHash.tokenType <== tokenType;
    noteHash.vk0 <== vk0;
    noteHash.vk1 <== vk1;
    noteHash.salt <== salt;

    // 3. Verify hash matches
    noteHash.out[0] === nh0;
    noteHash.out[1] === nh1;

    out <== 1;
}

component main {public [nh0, nh1, tokenType]} = MakeOrder();
