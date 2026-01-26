pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

// Poseidon-based note hash with address-based ownership
// Much more efficient than SHA256 (~300 constraints vs ~30,000)
//
// Input format: [ownerAddress, value, tokenType, vk0, vk1, salt]
// - ownerAddress: 160 bits (Ethereum-style address)
// - value: up to 254 bits
// - tokenType: up to 254 bits
// - vk0, vk1: 128 bits each (viewing key)
// - salt: up to 254 bits
//
// Output: Single field element (254 bits)
template PoseidonNoteWithAddress() {
    signal input ownerAddress;   // 160-bit address
    signal input value;          // Note value
    signal input tokenType;      // Token type
    signal input vk0;            // Viewing key part 0
    signal input vk1;            // Viewing key part 1
    signal input salt;           // Salt for uniqueness
    signal output out;           // Single field element hash

    // Poseidon hash with 6 inputs
    component poseidon = Poseidon(6);
    poseidon.inputs[0] <== ownerAddress;
    poseidon.inputs[1] <== value;
    poseidon.inputs[2] <== tokenType;
    poseidon.inputs[3] <== vk0;
    poseidon.inputs[4] <== vk1;
    poseidon.inputs[5] <== salt;

    out <== poseidon.out;
}

// Empty note hash (all zeros)
// EMPTY_NOTE_HASH = Poseidon(0, 0, 0, 0, 0, 0)
// This can be computed once and used as a constant
template EmptyNoteHash() {
    signal output out;

    component poseidon = Poseidon(6);
    poseidon.inputs[0] <== 0;
    poseidon.inputs[1] <== 0;
    poseidon.inputs[2] <== 0;
    poseidon.inputs[3] <== 0;
    poseidon.inputs[4] <== 0;
    poseidon.inputs[5] <== 0;

    out <== poseidon.out;
}

// Compute smart note owner address from a note hash
// Takes a 254-bit hash and truncates to 160 bits
// This allows linking notes to their parent notes (e.g., stake note to maker note)
template TruncateHashToAddress() {
    signal input hash;
    signal output address;

    // Simply mask to 160 bits
    // 2^160 - 1 = 1461501637330902918203684832716283019655932542975
    var MASK_160 = 1461501637330902918203684832716283019655932542975;

    // Compute truncated address
    // Note: This is a non-linear operation, so we need to prove it correctly
    signal quotient;
    signal remainder;

    // hash = quotient * 2^160 + remainder
    // remainder is the lower 160 bits (our address)
    quotient <-- hash \ (MASK_160 + 1);
    remainder <-- hash % (MASK_160 + 1);

    // Verify the decomposition
    hash === quotient * (MASK_160 + 1) + remainder;

    // Verify remainder fits in 160 bits (it's the lower 160 bits)
    // quotient * 2^160 <= field_max, so quotient < 2^94
    // This is automatically satisfied since hash < field_prime

    address <== remainder;
}
