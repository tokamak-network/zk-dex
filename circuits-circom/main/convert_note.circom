pragma circom 2.1.0;

include "../utils/sha256/sha256_1536bit.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/is_smart.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// ConvertNote Circuit
// Converts a smart note to a normal note
//
// Smart notes have owner0 = original note hash (first 126 bits = 0)
// This circuit verifies:
// 1. Smart note is indeed a smart note
// 2. Smart note's owner links to the origin note
// 3. Origin note ownership
// 4. Value and type preservation
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
    signal input smartOwner0;  // Should be origin note hash (part 0)
    signal input smartOwner1;  // Should be origin note hash (part 1)
    signal input smartValue;
    signal input smartType;
    signal input smartVk0;
    signal input smartVk1;
    signal input smartSalt;

    // Private inputs - Origin note
    signal input originOwner0;
    signal input originOwner1;
    signal input originValue;
    signal input originType;
    signal input originVk0;
    signal input originVk1;
    signal input originSalt;

    // Private inputs - New note
    signal input nOwner0;
    signal input nOwner1;
    signal input nValue;
    signal input nType;
    signal input nVk0;
    signal input nVk1;
    signal input nSalt;

    // Private inputs
    signal input sk;           // Secret key for origin note

    // Output
    signal output out;

    // 1. Verify smart note is a smart note
    component isSmart = IsSmartStrict();
    isSmart.owner0 <== smartOwner0;

    // 2. Verify smart note's owner links to origin note
    // smartOwner0 should equal originH0, smartOwner1 should equal originH1
    component linkEq0 = IsEqual();
    linkEq0.in[0] <== smartOwner0;
    linkEq0.in[1] <== originH0;
    linkEq0.out === 1;

    component linkEq1 = IsEqual();
    linkEq1.in[0] <== smartOwner1;
    linkEq1.in[1] <== originH1;
    linkEq1.out === 1;

    // 3. Verify smart note hash
    component smartHash = Sha256_1536bit();
    smartHash.in[0] <== smartOwner0;
    smartHash.in[1] <== smartOwner1;
    smartHash.in[2] <== smartValue;
    smartHash.in[3] <== smartType;
    smartHash.in[4] <== smartVk0;
    smartHash.in[5] <== smartVk1;
    smartHash.in[6] <== smartSalt;

    smartHash.out[0] === smartH0;
    smartHash.out[1] === smartH1;

    // 4. Verify origin note hash
    component originHash = Sha256_1536bit();
    originHash.in[0] <== originOwner0;
    originHash.in[1] <== originOwner1;
    originHash.in[2] <== originValue;
    originHash.in[3] <== originType;
    originHash.in[4] <== originVk0;
    originHash.in[5] <== originVk1;
    originHash.in[6] <== originSalt;

    originHash.out[0] === originH0;
    originHash.out[1] === originH1;

    // 5. Verify ownership of origin note
    component ownership = ProofOfOwnershipStrict();
    ownership.pk[0] <== originOwner0;
    ownership.pk[1] <== originOwner1;
    ownership.sk <== sk;

    // 6. Verify new note hash
    component newHash = Sha256_1536bit();
    newHash.in[0] <== nOwner0;
    newHash.in[1] <== nOwner1;
    newHash.in[2] <== nValue;
    newHash.in[3] <== nType;
    newHash.in[4] <== nVk0;
    newHash.in[5] <== nVk1;
    newHash.in[6] <== nSalt;

    newHash.out[0] === nh0;
    newHash.out[1] === nh1;

    // 7. Value preservation: smart value == new value
    component valueEq = IsEqual();
    valueEq.in[0] <== smartValue;
    valueEq.in[1] <== nValue;
    valueEq.out === 1;

    // 8. Type preservation: smart type == new type
    component typeEq = IsEqual();
    typeEq.in[0] <== smartType;
    typeEq.in[1] <== nType;
    typeEq.out === 1;

    out <== 1;
}

component main {public [smartH0, smartH1, originH0, originH1, nh0, nh1]} = ConvertNote();
