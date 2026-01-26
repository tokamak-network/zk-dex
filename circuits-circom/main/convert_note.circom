pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// ConvertNote Circuit (Poseidon-based, Address-based ownership)
// Converts a smart note to a normal note
//
// Smart notes have ownerAddress = truncated origin note hash (160 bits)
// This circuit verifies:
// 1. Smart note's owner links to the origin note (truncated hash match)
// 2. Origin note ownership
// 3. Value and type preservation
//
// Public inputs: [smartHash, originHash, newHash]
template ConvertNote() {
    // Public inputs
    signal input smartHash;       // Smart note hash (single field element)
    signal input originHash;      // Origin note hash (single field element)
    signal input newHash;         // New (converted) note hash (single field element)

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
    // smartOwnerAddress should be the last 160 bits of originHash
    // Using TruncateHashToAddress component
    component truncate = TruncateHashToAddress();
    truncate.hash <== originHash;

    // Verify smart note owner matches expected (truncated origin hash)
    component ownerMatch = IsEqual();
    ownerMatch.in[0] <== smartOwnerAddress;
    ownerMatch.in[1] <== truncate.address;
    ownerMatch.out === 1;

    // 2. Verify smart note hash
    component smartHashComp = PoseidonNoteWithAddress();
    smartHashComp.ownerAddress <== smartOwnerAddress;
    smartHashComp.value <== smartValue;
    smartHashComp.tokenType <== smartType;
    smartHashComp.vk0 <== smartVk0;
    smartHashComp.vk1 <== smartVk1;
    smartHashComp.salt <== smartSalt;

    smartHashComp.out === smartHash;

    // 3. Verify origin note hash
    component originHashComp = PoseidonNoteWithAddress();
    originHashComp.ownerAddress <== originOwnerAddress;
    originHashComp.value <== originValue;
    originHashComp.tokenType <== originType;
    originHashComp.vk0 <== originVk0;
    originHashComp.vk1 <== originVk1;
    originHashComp.salt <== originSalt;

    originHashComp.out === originHash;

    // 4. Verify ownership of origin note (address-based)
    component ownership = VerifyOwnershipByAddressStrict();
    ownership.address <== originOwnerAddress;
    ownership.sk <== sk;

    // 5. Verify new note hash
    component newHashComp = PoseidonNoteWithAddress();
    newHashComp.ownerAddress <== nOwnerAddress;
    newHashComp.value <== nValue;
    newHashComp.tokenType <== nType;
    newHashComp.vk0 <== nVk0;
    newHashComp.vk1 <== nVk1;
    newHashComp.salt <== nSalt;

    newHashComp.out === newHash;

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

component main {public [smartHash, originHash, newHash]} = ConvertNote();
