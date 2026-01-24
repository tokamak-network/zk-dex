pragma circom 2.1.0;

include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// Check if a note is a "smart note"
// Smart notes have the first 126 bits of owner0 set to 0
// This means owner0 value must be < 2^128 (fits in lower 128 bits)
template IsSmart() {
    signal input owner0;       // First owner field of note
    signal output isSmart;     // 1 if smart note, 0 otherwise

    // Decompose owner0 to bits
    component n2b = Num2Bits(254);
    n2b.in <== owner0;

    // Check if bits 128-253 (126 bits) are all zero
    // If they are all zero, then owner0 < 2^128
    signal sum[127];
    sum[0] <== n2b.out[128];
    for (var i = 1; i < 126; i++) {
        sum[i] <== sum[i-1] + n2b.out[128 + i];
    }

    // If sum == 0, all checked bits are 0, meaning it's a smart note
    component isZero = IsZero();
    isZero.in <== sum[125];

    isSmart <== isZero.out;
}

// Strict version that constrains the result
template IsSmartStrict() {
    signal input owner0;

    component check = IsSmart();
    check.owner0 <== owner0;
    check.isSmart === 1;
}

// Check if a note is NOT a smart note (normal note)
template IsNormalNote() {
    signal input owner0;
    signal output isNormal;

    component check = IsSmart();
    check.owner0 <== owner0;

    isNormal <== 1 - check.isSmart;
}
