pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

// Poseidon-based note hash (7 inputs)
// Faithful port of the Zokrates SHA256-based note hash structure.
//
// Note = (owner0, owner1, value, tokenType, vk0, vk1, salt)
//
// Regular notes:
//   owner0 = pkX, owner1 = pkY (BabyJubJub public key)
//   vk0 = pkX, vk1 = pkY (viewing key = public key)
//
// Smart notes:
//   owner0 = parentHash >> 128, owner1 = parentHash & MASK_128
//   vk0 = owner0, vk1 = owner1 (viewing key = parent hash split)
//
// Output: Single field element
template PoseidonNote() {
    signal input owner0;         // Regular: pkX, Smart: parentHash_hi
    signal input owner1;         // Regular: pkY, Smart: parentHash_lo
    signal input value;          // Note value
    signal input tokenType;      // Token type (0=ETH, 1=DAI)
    signal input vk0;            // Viewing key part 0
    signal input vk1;            // Viewing key part 1
    signal input salt;           // Salt for uniqueness
    signal output out;           // Hash output

    component poseidon = Poseidon(7);
    poseidon.inputs[0] <== owner0;
    poseidon.inputs[1] <== owner1;
    poseidon.inputs[2] <== value;
    poseidon.inputs[3] <== tokenType;
    poseidon.inputs[4] <== vk0;
    poseidon.inputs[5] <== vk1;
    poseidon.inputs[6] <== salt;

    out <== poseidon.out;
}

// Split a field element into two 128-bit halves
// Used for encoding parentHash into (owner0, owner1) for smart notes
//
// in = hi * 2^128 + lo
// hi < 2^128, lo < 2^128
template SplitTo128() {
    signal input in;
    signal output hi;
    signal output lo;

    var SPLIT = 2**128;

    // Witness computation
    hi <-- in \ SPLIT;
    lo <-- in % SPLIT;

    // Constraint: in == hi * 2^128 + lo
    signal reconstructed;
    reconstructed <== hi * SPLIT + lo;
    in === reconstructed;

    // Range constraints: both halves fit in 128 bits
    component hiBits = Num2Bits(128);
    hiBits.in <== hi;

    component loBits = Num2Bits(128);
    loBits.in <== lo;
}

// Empty note hash (all zeros)
// EMPTY_NOTE_HASH = Poseidon(0, 0, 0, 0, 0, 0, 0)
template EmptyNoteHash() {
    signal output out;

    component poseidon = Poseidon(7);
    for (var i = 0; i < 7; i++) {
        poseidon.inputs[i] <== 0;
    }

    out <== poseidon.out;
}
