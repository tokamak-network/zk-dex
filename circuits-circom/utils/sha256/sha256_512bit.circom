pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/sha256/sha256.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../pack/pack128.circom";
include "../pack/unpack256.circom";

// SHA256 for 512-bit input (2 x 256-bit field elements)
// Returns 256-bit hash split into 2 x 128-bit field elements
template Sha256_512bit() {
    signal input in[2];      // 2 field elements (each ~254 bits, treated as 256-bit)
    signal output out[2];    // Hash split into 2 x 128-bit

    // Unpack inputs to bits
    component unpack0 = Unpack256();
    component unpack1 = Unpack256();
    unpack0.in <== in[0];
    unpack1.in <== in[1];

    // SHA256 expects 512 bits
    component sha = Sha256(512);
    for (var i = 0; i < 256; i++) {
        sha.in[i] <== unpack0.bits[i];
        sha.in[256 + i] <== unpack1.bits[i];
    }

    // Pack output to 2 x 128-bit field elements
    component pack0 = Pack128();
    component pack1 = Pack128();
    for (var i = 0; i < 128; i++) {
        pack0.bits[i] <== sha.out[i];
        pack1.bits[i] <== sha.out[128 + i];
    }

    out[0] <== pack0.out;
    out[1] <== pack1.out;
}
