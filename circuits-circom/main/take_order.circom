pragma circom 2.1.0;

include "../utils/sha256/sha256_note_address.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// TakeOrder Circuit (Address-based ownership)
// Taker takes an order by creating a stake note for the maker
//
// The taker proves:
// 1. Ownership of parent (old) note via address verification
// 2. New note (stake) has owner = truncated maker's note hash (160-bit)
// 3. Value conservation: old note value == new note value
//
// For smart notes: ownerAddress = SHA256(makerNoteHash)[96:256] (last 160 bits)
// This allows the settle circuit to link the stake note back to the maker's order
//
// Public inputs: [oh0, oh1, oType, nh0, nh1, nOwnerAddress, nType]
// Private inputs: parent note fields, new note fields, sk
template TakeOrder() {
    // Public inputs - Old (parent) note hash
    signal input oh0;              // Old note hash part 0
    signal input oh1;              // Old note hash part 1
    signal input oType;            // Old note token type

    // Public inputs - New (stake) note
    signal input nh0;              // New note hash part 0
    signal input nh1;              // New note hash part 1
    signal input nOwnerAddress;    // New note owner (160-bit, derived from maker's note hash)
    signal input nType;            // New note token type

    // Private inputs - Old note
    signal input oOwnerAddress;    // Old note owner address (160-bit)
    signal input oValue;           // Old note value
    signal input oVk0;             // Old note viewing key 0
    signal input oVk1;             // Old note viewing key 1
    signal input oSalt;            // Old note salt

    // Private inputs - New note
    signal input nValue;           // New note value
    signal input nVk0;             // New note viewing key 0
    signal input nVk1;             // New note viewing key 1
    signal input nSalt;            // New note salt

    // Private inputs
    signal input sk;               // Taker's secret key

    // Output
    signal output out;

    // 1. Verify ownership of old note (address-based)
    component ownership = VerifyOwnershipByAddressStrict();
    ownership.address <== oOwnerAddress;
    ownership.sk <== sk;

    // 2. Verify old note hash
    component oldHash = Sha256NoteWithAddress();
    oldHash.ownerAddress <== oOwnerAddress;
    oldHash.value <== oValue;
    oldHash.tokenType <== oType;
    oldHash.vk0 <== oVk0;
    oldHash.vk1 <== oVk1;
    oldHash.salt <== oSalt;

    oldHash.out[0] === oh0;
    oldHash.out[1] === oh1;

    // 3. Verify new (stake) note hash
    // The owner address is the truncated maker's note hash (public input)
    // This links the stake note to the maker's order
    component newHash = Sha256NoteWithAddress();
    newHash.ownerAddress <== nOwnerAddress;
    newHash.value <== nValue;
    newHash.tokenType <== nType;
    newHash.vk0 <== nVk0;
    newHash.vk1 <== nVk1;
    newHash.salt <== nSalt;

    newHash.out[0] === nh0;
    newHash.out[1] === nh1;

    // 4. Value conservation: old value == new value
    component valueEq = IsEqual();
    valueEq.in[0] <== oValue;
    valueEq.in[1] <== nValue;
    valueEq.out === 1;

    out <== 1;
}

component main {public [oh0, oh1, oType, nh0, nh1, nOwnerAddress, nType]} = TakeOrder();
