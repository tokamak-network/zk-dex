pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/sha256/sha256.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../pack/pack160.circom";

// Derive address from public key
// address = pack160(sha256(pk_x || pk_y)[96:256])
// Takes last 160 bits of SHA256 hash
template GetAddress() {
    signal input pk[2];        // Public key [x, y]
    signal output address;     // 160-bit address as field element

    // Unpack public key coordinates to bits
    component unpackX = Num2Bits(254);
    component unpackY = Num2Bits(254);
    unpackX.in <== pk[0];
    unpackY.in <== pk[1];

    // Build 512-bit input for SHA256: pk_x (256 bits) || pk_y (256 bits)
    signal bits[512];

    // pk_x: pad with 2 zeros at MSB to get 256 bits
    bits[0] <== 0;
    bits[1] <== 0;
    for (var i = 0; i < 254; i++) {
        bits[2 + i] <== unpackX.out[253 - i];
    }

    // pk_y: pad with 2 zeros at MSB
    bits[256] <== 0;
    bits[257] <== 0;
    for (var i = 0; i < 254; i++) {
        bits[258 + i] <== unpackY.out[253 - i];
    }

    // SHA256
    component sha = Sha256(512);
    for (var i = 0; i < 512; i++) {
        sha.in[i] <== bits[i];
    }

    // Take last 160 bits (bits 96-255) and pack to address
    component pack = Pack160();
    for (var i = 0; i < 160; i++) {
        pack.bits[i] <== sha.out[96 + i];
    }

    address <== pack.out;
}
