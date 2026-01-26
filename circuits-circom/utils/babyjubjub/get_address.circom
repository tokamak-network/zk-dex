pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

// Derive address from public key using Poseidon
// address = Poseidon(pk_x, pk_y) truncated to 160 bits
// Much more efficient than SHA256 (~300 constraints vs ~30,000)
template GetAddress() {
    signal input pk[2];        // Public key [x, y]
    signal output address;     // 160-bit address as field element

    // Poseidon hash of public key coordinates
    component poseidon = Poseidon(2);
    poseidon.inputs[0] <== pk[0];
    poseidon.inputs[1] <== pk[1];

    // Truncate to 160 bits
    // 2^160 - 1 = 1461501637330902918203684832716283019655932542975
    var MASK_160 = 1461501637330902918203684832716283019655932542975;

    // Compute truncated address (lower 160 bits)
    signal quotient;
    signal remainder;

    // hash = quotient * 2^160 + remainder
    quotient <-- poseidon.out \ (MASK_160 + 1);
    remainder <-- poseidon.out % (MASK_160 + 1);

    // Verify the decomposition
    poseidon.out === quotient * (MASK_160 + 1) + remainder;

    address <== remainder;
}
