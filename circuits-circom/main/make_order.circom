pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";

// MakeOrder Circuit (Poseidon-based, Address-based ownership)
// Proves maker owns a note for creating an order
//
// Public inputs: [noteHash, tokenType]
// Private inputs: [ownerAddress, value, vk0, vk1, salt, sk]
// Output: 1 (success)
template MakeOrder() {
    // Public inputs
    signal input noteHash;     // Note hash (single field element)
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

    // 2. Compute note hash using Poseidon
    component hash = PoseidonNoteWithAddress();
    hash.ownerAddress <== ownerAddress;
    hash.value <== value;
    hash.tokenType <== tokenType;
    hash.vk0 <== vk0;
    hash.vk1 <== vk1;
    hash.salt <== salt;

    // 3. Verify hash matches
    hash.out === noteHash;

    out <== 1;
}

component main {public [noteHash, tokenType]} = MakeOrder();
