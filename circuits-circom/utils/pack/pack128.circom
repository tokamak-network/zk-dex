pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/bitify.circom";

// Pack 128 bits into a single field element
template Pack128() {
    signal input bits[128];
    signal output out;

    component b2n = Bits2Num(128);
    for (var i = 0; i < 128; i++) {
        b2n.in[i] <== bits[127 - i];  // MSB first
    }
    out <== b2n.out;
}

// Unpack a field element to 128 bits
template Unpack128() {
    signal input in;
    signal output bits[128];

    component n2b = Num2Bits(128);
    n2b.in <== in;
    for (var i = 0; i < 128; i++) {
        bits[i] <== n2b.out[127 - i];  // MSB first
    }
}

// Non-strict unpack - no range check on upper bits
template NonStrictUnpack128() {
    signal input in;
    signal output bits[128];

    component n2b = Num2Bits(254);
    n2b.in <== in;

    // Return bits 126-253 (128 bits)
    for (var i = 0; i < 128; i++) {
        bits[i] <== n2b.out[253 - i];
    }
}
