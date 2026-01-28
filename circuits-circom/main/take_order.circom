pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/is_smart.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// TakeOrder Circuit
// Faithful port of Zokrates takeOrder.code
//
// Note = (owner0, owner1, value, type, vk0, vk1, salt)
//
// The taker takes an order by:
// 1. Proving ownership of their old (parent) note
// 2. Creating a smart (stake) note linked to the maker's note via parentHash
//
// For smart notes:
//   owner0 = parentHash >> 128, owner1 = parentHash & MASK_128
//   The isSmart check verifies owner0 < 2^128
//   The Solidity contract verifies parentHash matches the maker's note hash
//
// Public inputs: [oldNoteHash, oldType, newNoteHash, newParentHash, newType]
// Private inputs: old note fields, new note fields (vk0, vk1, salt), sk
template TakeOrder() {
    // Public inputs - Old (parent) note
    signal input oldNoteHash;
    signal input oldType;

    // Public inputs - New (stake/smart) note
    signal input newNoteHash;
    signal input newParentHash;    // = maker note hash (full field element)
    signal input newType;

    // Private inputs - Old note (regular note)
    signal input oldOwner0;        // pkX
    signal input oldOwner1;        // pkY
    signal input oldValue;
    signal input oldVk0;
    signal input oldVk1;
    signal input oldSalt;

    // Private inputs - New note (smart note)
    signal input newValue;
    signal input newVk0;
    signal input newVk1;
    signal input newSalt;

    // Private inputs
    signal input sk;

    // Output
    signal output out;

    // 1. Verify ownership of old note
    component ownership = ProofOfOwnershipStrict();
    ownership.pk[0] <== oldOwner0;
    ownership.pk[1] <== oldOwner1;
    ownership.sk <== sk;

    // 2. Value conservation: old value == new value
    oldValue === newValue;

    // 3. Verify old note hash (regular note)
    component oldHash = PoseidonNote();
    oldHash.owner0 <== oldOwner0;
    oldHash.owner1 <== oldOwner1;
    oldHash.value <== oldValue;
    oldHash.tokenType <== oldType;
    oldHash.vk0 <== oldVk0;
    oldHash.vk1 <== oldVk1;
    oldHash.salt <== oldSalt;
    oldHash.out === oldNoteHash;

    // 4. Split parentHash into (owner0, owner1) for new (smart) note
    component split = SplitTo128();
    split.in <== newParentHash;

    // 5. Verify new note hash (smart note)
    component newHash = PoseidonNote();
    newHash.owner0 <== split.hi;
    newHash.owner1 <== split.lo;
    newHash.value <== newValue;
    newHash.tokenType <== newType;
    newHash.vk0 <== newVk0;
    newHash.vk1 <== newVk1;
    newHash.salt <== newSalt;
    newHash.out === newNoteHash;

    // 6. isSmart check: verify new note IS a smart note
    // SplitTo128 already constrains hi < 2^128, which means isSmart(owner0) == 1
    // But let's make it explicit using IsSmartStrict for clarity
    component smartCheck = IsSmartStrict();
    smartCheck.owner0 <== split.hi;

    out <== 1;
}

component main {public [oldNoteHash, oldType, newNoteHash, newParentHash, newType]} = TakeOrder();
