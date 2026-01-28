pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";

// MintNBurnNote Circuit
// Faithful port of Zokrates mintNBurnNote.code
//
// Note = (owner0, owner1, value, type, vk0, vk1, salt)
//
// Proves:
// 1. Ownership: sk corresponds to the note's public key (owner0, owner1)
// 2. Hash: Poseidon(owner0, owner1, value, type, vk0, vk1, salt) == noteHash
//
// For regular notes: owner0=pkX, owner1=pkY, vk0=pkX, vk1=pkY
//
// Public inputs: [noteHash, value, tokenType]
// Private inputs: [owner0, owner1, vk0, vk1, salt, sk]
template MintNBurnNote() {
    // Public inputs
    signal input noteHash;
    signal input value;
    signal input tokenType;

    // Private inputs
    signal input owner0;       // pkX
    signal input owner1;       // pkY
    signal input vk0;          // viewing key part 0
    signal input vk1;          // viewing key part 1
    signal input salt;
    signal input sk;

    // Output
    signal output out;

    // 1. Check ownership: sk -> pk -> compare with (owner0, owner1)
    component ownership = ProofOfOwnershipStrict();
    ownership.pk[0] <== owner0;
    ownership.pk[1] <== owner1;
    ownership.sk <== sk;

    // 2. Compute note hash and verify
    component hash = PoseidonNote();
    hash.owner0 <== owner0;
    hash.owner1 <== owner1;
    hash.value <== value;
    hash.tokenType <== tokenType;
    hash.vk0 <== vk0;
    hash.vk1 <== vk1;
    hash.salt <== salt;

    hash.out === noteHash;

    out <== 1;
}

component main {public [noteHash, value, tokenType]} = MintNBurnNote();
