pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/bitify.circom";

// Pack 160 bits into a single field element (for addresses)
template Pack160() {
    signal input bits[160];
    signal output out;

    component b2n = Bits2Num(160);
    for (var i = 0; i < 160; i++) {
        b2n.in[i] <== bits[159 - i];  // MSB first
    }
    out <== b2n.out;
}

// Unpack a field element to 160 bits
template Unpack160() {
    signal input in;
    signal output bits[160];

    component n2b = Num2Bits(254);
    n2b.in <== in;

    // Verify upper 94 bits are 0
    signal sum;
    var acc = 0;
    for (var i = 160; i < 254; i++) {
        acc += n2b.out[i];
    }
    sum <== acc;
    sum === 0;

    // Return lower 160 bits
    for (var i = 0; i < 160; i++) {
        bits[i] <== n2b.out[159 - i];  // MSB first
    }
}
