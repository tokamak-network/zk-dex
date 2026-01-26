pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// TakeOrder Circuit (Poseidon-based, Address-based ownership)
// Taker takes an order by creating a stake note for the maker
//
// The taker proves:
// 1. Ownership of parent (old) note via address verification
// 2. New note (stake) has owner = truncated maker's note hash (160-bit)
// 3. Value conservation: old note value == new note value
//
// For smart notes: ownerAddress = Poseidon(makerNoteHash) truncated to 160 bits
// This allows the settle circuit to link the stake note back to the maker's order
//
// Public inputs: [oldNoteHash, oldType, newNoteHash, newOwnerAddress, newType]
// Private inputs: parent note fields, new note fields, sk
template TakeOrder() {
    // Public inputs - Old (parent) note
    signal input oldNoteHash;      // Old note hash (single field element)
    signal input oldType;          // Old note token type

    // Public inputs - New (stake) note
    signal input newNoteHash;      // New note hash (single field element)
    signal input newOwnerAddress;  // New note owner (160-bit, derived from maker's note hash)
    signal input newType;          // New note token type

    // Private inputs - Old note
    signal input oldOwnerAddress;  // Old note owner address (160-bit)
    signal input oldValue;         // Old note value
    signal input oldVk0;           // Old note viewing key 0
    signal input oldVk1;           // Old note viewing key 1
    signal input oldSalt;          // Old note salt

    // Private inputs - New note
    signal input newValue;         // New note value
    signal input newVk0;           // New note viewing key 0
    signal input newVk1;           // New note viewing key 1
    signal input newSalt;          // New note salt

    // Private inputs
    signal input sk;               // Taker's secret key

    // Output
    signal output out;

    // 1. Verify ownership of old note (address-based)
    component ownership = VerifyOwnershipByAddressStrict();
    ownership.address <== oldOwnerAddress;
    ownership.sk <== sk;

    // 2. Verify old note hash
    component oldHash = PoseidonNoteWithAddress();
    oldHash.ownerAddress <== oldOwnerAddress;
    oldHash.value <== oldValue;
    oldHash.tokenType <== oldType;
    oldHash.vk0 <== oldVk0;
    oldHash.vk1 <== oldVk1;
    oldHash.salt <== oldSalt;

    oldHash.out === oldNoteHash;

    // 3. Verify new (stake) note hash
    // The owner address is the truncated maker's note hash (public input)
    // This links the stake note to the maker's order
    component newHash = PoseidonNoteWithAddress();
    newHash.ownerAddress <== newOwnerAddress;
    newHash.value <== newValue;
    newHash.tokenType <== newType;
    newHash.vk0 <== newVk0;
    newHash.vk1 <== newVk1;
    newHash.salt <== newSalt;

    newHash.out === newNoteHash;

    // 4. Value conservation: old value == new value
    component valueEq = IsEqual();
    valueEq.in[0] <== oldValue;
    valueEq.in[1] <== newValue;
    valueEq.out === 1;

    out <== 1;
}

component main {public [oldNoteHash, oldType, newNoteHash, newOwnerAddress, newType]} = TakeOrder();
