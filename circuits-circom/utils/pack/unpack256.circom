pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/bitify.circom";

// Unpack a field element to 256 bits (for values that fit in field)
// Note: Field prime is ~254 bits, so this assumes input < 2^254
template Unpack256() {
    signal input in;
    signal output bits[256];

    component n2b = Num2Bits(254);
    n2b.in <== in;

    // First 2 bits are 0 (since field < 2^254)
    bits[0] <== 0;
    bits[1] <== 0;

    // Remaining 254 bits from decomposition
    for (var i = 0; i < 254; i++) {
        bits[i + 2] <== n2b.out[253 - i];  // MSB first
    }
}

// Pack 256 bits into two 128-bit field elements
template Pack256To128x2() {
    signal input bits[256];
    signal output out[2];

    component pack0 = Bits2Num(128);
    component pack1 = Bits2Num(128);

    for (var i = 0; i < 128; i++) {
        pack0.in[i] <== bits[127 - i];    // First 128 bits (MSB)
        pack1.in[i] <== bits[255 - i];    // Last 128 bits (LSB)
    }

    out[0] <== pack0.out;
    out[1] <== pack1.out;
}

// Unpack two 128-bit field elements to 256 bits
template Unpack128x2To256() {
    signal input in[2];
    signal output bits[256];

    component n2b0 = Num2Bits(128);
    component n2b1 = Num2Bits(128);

    n2b0.in <== in[0];
    n2b1.in <== in[1];

    for (var i = 0; i < 128; i++) {
        bits[i] <== n2b0.out[127 - i];        // First 128 bits
        bits[128 + i] <== n2b1.out[127 - i];  // Last 128 bits
    }
}
