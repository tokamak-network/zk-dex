pragma circom 2.1.0;

include "../utils/sha256/sha256_note_address.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/pack/pack160.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

// ConvertNote Circuit (Address-based ownership)
// Converts a smart note to a normal note
//
// Smart notes have ownerAddress = truncated origin note hash (160 bits)
// This circuit verifies:
// 1. Smart note's owner links to the origin note (truncated hash match)
// 2. Origin note ownership
// 3. Value and type preservation
//
// Public inputs: [smartH0, smartH1, originH0, originH1, nh0, nh1]
template ConvertNote() {
    // Public inputs - Smart note hash
    signal input smartH0;
    signal input smartH1;

    // Public inputs - Origin note hash
    signal input originH0;
    signal input originH1;

    // Public inputs - New (converted) note hash
    signal input nh0;
    signal input nh1;

    // Private inputs - Smart note
    signal input smartOwnerAddress;  // Should be truncated origin note hash (160 bits)
    signal input smartValue;
    signal input smartType;
    signal input smartVk0;
    signal input smartVk1;
    signal input smartSalt;

    // Private inputs - Origin note
    signal input originOwnerAddress; // 160-bit address
    signal input originValue;
    signal input originType;
    signal input originVk0;
    signal input originVk1;
    signal input originSalt;

    // Private inputs - New note
    signal input nOwnerAddress;      // 160-bit address
    signal input nValue;
    signal input nType;
    signal input nVk0;
    signal input nVk1;
    signal input nSalt;

    // Private inputs
    signal input sk;                 // Secret key for origin note

    // Output
    signal output out;

    // 1. Compute expected smart note owner from origin hash
    // smartOwnerAddress should be the last 160 bits of (originH0 || originH1)
    // = originH1 (128 bits) || first 32 bits of originH0
    // For simplicity, we verify: smartOwnerAddress == pack160(originH0[low32] || originH1[all128])

    // Unpack originH0 and originH1 to bits
    component unpackH0 = Num2Bits(128);
    unpackH0.in <== originH0;

    component unpackH1 = Num2Bits(128);
    unpackH1.in <== originH1;

    // Build 160-bit expected owner: last 160 bits of the 256-bit hash
    // originH0 || originH1 = 256 bits, we want bits [96:256] = last 160 bits
    // That's: bits [96:128) from H0 (32 bits) + all of H1 (128 bits)
    component packExpected = Pack160();
    // First 32 bits come from originH0 (bits 96-127 of the full hash, which is bits 0-31 of H0)
    for (var i = 0; i < 32; i++) {
        packExpected.bits[i] <== unpackH0.out[127 - i];  // MSB first
    }
    // Remaining 128 bits come from originH1
    for (var i = 0; i < 128; i++) {
        packExpected.bits[32 + i] <== unpackH1.out[127 - i];  // MSB first
    }

    // Verify smart note owner matches expected
    component ownerMatch = IsEqual();
    ownerMatch.in[0] <== smartOwnerAddress;
    ownerMatch.in[1] <== packExpected.out;
    ownerMatch.out === 1;

    // 2. Verify smart note hash
    component smartHash = Sha256NoteWithAddress();
    smartHash.ownerAddress <== smartOwnerAddress;
    smartHash.value <== smartValue;
    smartHash.tokenType <== smartType;
    smartHash.vk0 <== smartVk0;
    smartHash.vk1 <== smartVk1;
    smartHash.salt <== smartSalt;

    smartHash.out[0] === smartH0;
    smartHash.out[1] === smartH1;

    // 3. Verify origin note hash
    component originHash = Sha256NoteWithAddress();
    originHash.ownerAddress <== originOwnerAddress;
    originHash.value <== originValue;
    originHash.tokenType <== originType;
    originHash.vk0 <== originVk0;
    originHash.vk1 <== originVk1;
    originHash.salt <== originSalt;

    originHash.out[0] === originH0;
    originHash.out[1] === originH1;

    // 4. Verify ownership of origin note (address-based)
    component ownership = VerifyOwnershipByAddressStrict();
    ownership.address <== originOwnerAddress;
    ownership.sk <== sk;

    // 5. Verify new note hash
    component newHash = Sha256NoteWithAddress();
    newHash.ownerAddress <== nOwnerAddress;
    newHash.value <== nValue;
    newHash.tokenType <== nType;
    newHash.vk0 <== nVk0;
    newHash.vk1 <== nVk1;
    newHash.salt <== nSalt;

    newHash.out[0] === nh0;
    newHash.out[1] === nh1;

    // 6. Value preservation: smart value == new value
    component valueEq = IsEqual();
    valueEq.in[0] <== smartValue;
    valueEq.in[1] <== nValue;
    valueEq.out === 1;

    // 7. Type preservation: smart type == new type
    component typeEq = IsEqual();
    typeEq.in[0] <== smartType;
    typeEq.in[1] <== nType;
    typeEq.out === 1;

    out <== 1;
}

component main {public [smartH0, smartH1, originH0, originH1, nh0, nh1]} = ConvertNote();
