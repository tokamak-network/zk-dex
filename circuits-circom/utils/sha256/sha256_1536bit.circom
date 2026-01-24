pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/sha256/sha256.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../pack/pack128.circom";
include "../pack/unpack256.circom";

// SHA256 for note hashing: 7 field inputs (1536 bits after packing)
// Input format: [owner0, owner1, value, type, vk0, vk1, salt]
// - owner0, owner1: 256 bits each
// - value, type: 256 bits each
// - vk0, vk1: 128 bits each (concatenated to 256 bits)
// - salt: 256 bits
// Total: 6 x 256 = 1536 bits
//
// Output: Hash split into 2 x 128-bit field elements
template Sha256_1536bit() {
    signal input in[7];      // 7 field elements
    signal output out[2];    // Hash split into 2 x 128-bit

    // Unpack each input to bits
    component unpack[7];
    for (var i = 0; i < 7; i++) {
        unpack[i] = Num2Bits(254);
        unpack[i].in <== in[i];
    }

    // Build 1536-bit message:
    // owner0 (256) | owner1 (256) | value (256) | type (256) | vk0||vk1 (256) | salt (256)
    signal bits[1536];

    // owner0: bits 0-255 (use 254 bits, pad with 2 zeros at MSB)
    bits[0] <== 0;
    bits[1] <== 0;
    for (var i = 0; i < 254; i++) {
        bits[2 + i] <== unpack[0].out[253 - i];
    }

    // owner1: bits 256-511
    bits[256] <== 0;
    bits[257] <== 0;
    for (var i = 0; i < 254; i++) {
        bits[258 + i] <== unpack[1].out[253 - i];
    }

    // value: bits 512-767
    bits[512] <== 0;
    bits[513] <== 0;
    for (var i = 0; i < 254; i++) {
        bits[514 + i] <== unpack[2].out[253 - i];
    }

    // type: bits 768-1023
    bits[768] <== 0;
    bits[769] <== 0;
    for (var i = 0; i < 254; i++) {
        bits[770 + i] <== unpack[3].out[253 - i];
    }

    // vk0 (128 bits) || vk1 (128 bits): bits 1024-1279
    // vk0 goes to bits 1024-1151, vk1 goes to bits 1152-1279
    for (var i = 0; i < 128; i++) {
        bits[1024 + i] <== unpack[4].out[127 - i];  // vk0 (lower 128 bits)
    }
    for (var i = 0; i < 128; i++) {
        bits[1152 + i] <== unpack[5].out[127 - i];  // vk1 (lower 128 bits)
    }

    // salt: bits 1280-1535
    bits[1280] <== 0;
    bits[1281] <== 0;
    for (var i = 0; i < 254; i++) {
        bits[1282 + i] <== unpack[6].out[253 - i];
    }

    // SHA256 with 1536 bits of data
    // circomlib's Sha256 handles padding internally
    component sha = Sha256(1536);
    for (var i = 0; i < 1536; i++) {
        sha.in[i] <== bits[i];
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

// SHA256 for smart note hashing (1024 bits)
// Smart notes have different owner format
template Sha256_1024bit() {
    signal input in[4];      // 4 x 256-bit field elements
    signal output out[2];    // Hash split into 2 x 128-bit

    component unpack[4];
    for (var i = 0; i < 4; i++) {
        unpack[i] = Num2Bits(254);
        unpack[i].in <== in[i];
    }

    // Build 1024-bit message
    signal bits[1024];
    for (var j = 0; j < 4; j++) {
        bits[j * 256] <== 0;
        bits[j * 256 + 1] <== 0;
        for (var i = 0; i < 254; i++) {
            bits[j * 256 + 2 + i] <== unpack[j].out[253 - i];
        }
    }

    component sha = Sha256(1024);
    for (var i = 0; i < 1024; i++) {
        sha.in[i] <== bits[i];
    }

    component pack0 = Pack128();
    component pack1 = Pack128();
    for (var i = 0; i < 128; i++) {
        pack0.bits[i] <== sha.out[i];
        pack1.bits[i] <== sha.out[128 + i];
    }

    out[0] <== pack0.out;
    out[1] <== pack1.out;
}
