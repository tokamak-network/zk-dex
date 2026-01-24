pragma circom 2.1.0;

include "../utils/sha256/sha256_1536bit.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/is_smart.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// TakeOrder Circuit
// Taker takes an order by creating a stake note for the maker
//
// The taker proves:
// 1. Ownership of parent (old) note
// 2. New note (stake) is a "smart note" with owner = maker's note hash
// 3. Value conservation: old note value == new note value
//
// Public inputs: [oh0, oh1, oType, nh0, nh1, nOwner0, nOwner1, nType]
// Private inputs: parent note fields, new note fields, sk
template TakeOrder() {
    // Public inputs - Old (parent) note hash
    signal input oh0;          // Old note hash part 0
    signal input oh1;          // Old note hash part 1
    signal input oType;        // Old note token type

    // Public inputs - New (stake) note
    signal input nh0;          // New note hash part 0
    signal input nh1;          // New note hash part 1
    signal input nOwner0;      // New note owner0 (maker's note hash part 0)
    signal input nOwner1;      // New note owner1 (maker's note hash part 1)
    signal input nType;        // New note token type

    // Private inputs - Old note
    signal input oOwner0;      // Old note owner X
    signal input oOwner1;      // Old note owner Y
    signal input oValue;       // Old note value
    signal input oVk0;         // Old note viewing key 0
    signal input oVk1;         // Old note viewing key 1
    signal input oSalt;        // Old note salt

    // Private inputs - New note
    signal input nValue;       // New note value
    signal input nVk0;         // New note viewing key 0
    signal input nVk1;         // New note viewing key 1
    signal input nSalt;        // New note salt

    // Private inputs
    signal input sk;           // Taker's secret key

    // Output
    signal output out;

    // 1. Verify ownership of old note
    component ownership = ProofOfOwnershipStrict();
    ownership.pk[0] <== oOwner0;
    ownership.pk[1] <== oOwner1;
    ownership.sk <== sk;

    // 2. Verify old note hash
    component oldHash = Sha256_1536bit();
    oldHash.in[0] <== oOwner0;
    oldHash.in[1] <== oOwner1;
    oldHash.in[2] <== oValue;
    oldHash.in[3] <== oType;
    oldHash.in[4] <== oVk0;
    oldHash.in[5] <== oVk1;
    oldHash.in[6] <== oSalt;

    oldHash.out[0] === oh0;
    oldHash.out[1] === oh1;

    // 3. Verify new note is a smart note (owner0 has specific format)
    component isSmart = IsSmartStrict();
    isSmart.owner0 <== nOwner0;

    // 4. Verify new note hash
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

    // 5. Value conservation: old value == new value
    component valueEq = IsEqual();
    valueEq.in[0] <== oValue;
    valueEq.in[1] <== nValue;
    valueEq.out === 1;

    out <== 1;
}

component main {public [oh0, oh1, oType, nh0, nh1, nOwner0, nOwner1, nType]} = TakeOrder();
