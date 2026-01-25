pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/sha256/sha256.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../pack/pack128.circom";
include "../pack/pack160.circom";

// SHA256 for note hashing with address-based ownership
// Input format: [ownerAddress, value, type, vk0, vk1, salt]
// - ownerAddress: 160 bits (Ethereum-style address)
// - value: 256 bits
// - type: 256 bits
// - vk0, vk1: 128 bits each
// - salt: 256 bits
// Total: 160 + 256 + 256 + 128 + 128 + 256 = 1184 bits
//
// Output: Hash split into 2 x 128-bit field elements
template Sha256NoteWithAddress() {
    signal input ownerAddress;   // 160-bit address
    signal input value;          // 256-bit value
    signal input tokenType;      // 256-bit token type
    signal input vk0;            // 128-bit viewing key part 0
    signal input vk1;            // 128-bit viewing key part 1
    signal input salt;           // 256-bit salt
    signal output out[2];        // Hash split into 2 x 128-bit

    // Unpack ownerAddress to 160 bits
    component unpackAddr = Unpack160();
    unpackAddr.in <== ownerAddress;

    // Unpack 256-bit fields
    component unpackValue = Num2Bits(254);
    unpackValue.in <== value;

    component unpackType = Num2Bits(254);
    unpackType.in <== tokenType;

    component unpackSalt = Num2Bits(254);
    unpackSalt.in <== salt;

    // Unpack 128-bit viewing key parts
    component unpackVk0 = Num2Bits(128);
    unpackVk0.in <== vk0;

    component unpackVk1 = Num2Bits(128);
    unpackVk1.in <== vk1;

    // Build 1184-bit message
    signal bits[1184];
    var idx = 0;

    // ownerAddress: bits 0-159 (160 bits)
    for (var i = 0; i < 160; i++) {
        bits[idx + i] <== unpackAddr.bits[i];
    }
    idx += 160;

    // value: bits 160-415 (256 bits, pad with 2 zeros at MSB)
    bits[idx] <== 0;
    bits[idx + 1] <== 0;
    for (var i = 0; i < 254; i++) {
        bits[idx + 2 + i] <== unpackValue.out[253 - i];
    }
    idx += 256;

    // type: bits 416-671 (256 bits)
    bits[idx] <== 0;
    bits[idx + 1] <== 0;
    for (var i = 0; i < 254; i++) {
        bits[idx + 2 + i] <== unpackType.out[253 - i];
    }
    idx += 256;

    // vk0: bits 672-799 (128 bits)
    for (var i = 0; i < 128; i++) {
        bits[idx + i] <== unpackVk0.out[127 - i];
    }
    idx += 128;

    // vk1: bits 800-927 (128 bits)
    for (var i = 0; i < 128; i++) {
        bits[idx + i] <== unpackVk1.out[127 - i];
    }
    idx += 128;

    // salt: bits 928-1183 (256 bits)
    bits[idx] <== 0;
    bits[idx + 1] <== 0;
    for (var i = 0; i < 254; i++) {
        bits[idx + 2 + i] <== unpackSalt.out[253 - i];
    }

    // SHA256 with 1184 bits of data
    component sha = Sha256(1184);
    for (var i = 0; i < 1184; i++) {
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
