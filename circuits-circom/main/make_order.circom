pragma circom 2.1.0;

include "../utils/sha256/sha256_1536bit.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";

// MakeOrder Circuit
// Proves maker owns a note for creating an order
// Similar to MintNBurnNote but with different public inputs
//
// Public inputs: [nh0, nh1, tokenType]
// Private inputs: [owner0, owner1, value, vk0, vk1, salt, sk]
// Output: 1 (success)
template MakeOrder() {
    // Public inputs
    signal input nh0;          // Note hash part 0 (128 bits)
    signal input nh1;          // Note hash part 1 (128 bits)
    signal input tokenType;    // Token type (public for order matching)

    // Private inputs
    signal input owner0;       // Owner public key X
    signal input owner1;       // Owner public key Y
    signal input value;        // Note value (private)
    signal input vk0;          // Viewing key part 0
    signal input vk1;          // Viewing key part 1
    signal input salt;         // Random salt
    signal input sk;           // Secret key

    // Output
    signal output out;

    // 1. Verify ownership
    component ownership = ProofOfOwnershipStrict();
    ownership.pk[0] <== owner0;
    ownership.pk[1] <== owner1;
    ownership.sk <== sk;

    // 2. Compute note hash
    component noteHash = Sha256_1536bit();
    noteHash.in[0] <== owner0;
    noteHash.in[1] <== owner1;
    noteHash.in[2] <== value;
    noteHash.in[3] <== tokenType;
    noteHash.in[4] <== vk0;
    noteHash.in[5] <== vk1;
    noteHash.in[6] <== salt;

    // 3. Verify hash matches
    noteHash.out[0] === nh0;
    noteHash.out[1] === nh1;

    out <== 1;
}

component main {public [nh0, nh1, tokenType]} = MakeOrder();
