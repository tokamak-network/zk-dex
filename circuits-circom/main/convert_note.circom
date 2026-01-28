pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/is_smart.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// ConvertNote Circuit
// Faithful port of Zokrates convertNote.code
//
// Note = (owner0, owner1, value, type, vk0, vk1, salt)
//
// Converts a smart note back to a regular note.
//
// Smart note's owner = parentHash split (= origin note hash split)
// Prover must own the origin note (via sk -> pk -> compare)
//
// Constraints:
// 1. Smart note IS a smart note (isSmart check)
// 2. Smart note's parentHash == origin note hash
// 3. Origin note ownership proof
// 4. Value and type preservation
//
// Public inputs: [smartHash, originHash, newHash]
template ConvertNote() {
    // Public inputs
    signal input smartHash;
    signal input originHash;
    signal input newHash;

    // Private inputs - Smart note
    signal input smartOwner0;      // parentHash_hi
    signal input smartOwner1;      // parentHash_lo
    signal input smartValue;
    signal input smartType;
    signal input smartVk0;
    signal input smartVk1;
    signal input smartSalt;

    // Private inputs - Origin note (regular note)
    signal input originOwner0;     // pkX
    signal input originOwner1;     // pkY
    signal input originValue;
    signal input originType;
    signal input originVk0;
    signal input originVk1;
    signal input originSalt;

    // Private inputs - New note (regular note)
    signal input nOwner0;          // pkX
    signal input nOwner1;          // pkY
    signal input nValue;
    signal input nType;
    signal input nVk0;
    signal input nVk1;
    signal input nSalt;

    // Private inputs
    signal input sk;

    // Output
    signal output out;

    // 1. isSmart check: verify smart note IS a smart note
    component smartCheck = IsSmartStrict();
    smartCheck.owner0 <== smartOwner0;

    // 2. Verify smart note's parentHash == origin note hash
    // Reconstruct parentHash from (smartOwner0, smartOwner1)
    signal smartParentReconstructed;
    smartParentReconstructed <== smartOwner0 * (2**128) + smartOwner1;
    smartParentReconstructed === originHash;

    // 3. Verify ownership of origin note
    component ownership = ProofOfOwnershipStrict();
    ownership.pk[0] <== originOwner0;
    ownership.pk[1] <== originOwner1;
    ownership.sk <== sk;

    // 4. Value preservation: smart value == new value
    smartValue === nValue;

    // 5. Type preservation: smart type == new type
    smartType === nType;

    // 6. Verify smart note hash
    component smartHashComp = PoseidonNote();
    smartHashComp.owner0 <== smartOwner0;
    smartHashComp.owner1 <== smartOwner1;
    smartHashComp.value <== smartValue;
    smartHashComp.tokenType <== smartType;
    smartHashComp.vk0 <== smartVk0;
    smartHashComp.vk1 <== smartVk1;
    smartHashComp.salt <== smartSalt;
    smartHashComp.out === smartHash;

    // 7. Verify origin note hash
    component originHashComp = PoseidonNote();
    originHashComp.owner0 <== originOwner0;
    originHashComp.owner1 <== originOwner1;
    originHashComp.value <== originValue;
    originHashComp.tokenType <== originType;
    originHashComp.vk0 <== originVk0;
    originHashComp.vk1 <== originVk1;
    originHashComp.salt <== originSalt;
    originHashComp.out === originHash;

    // 8. Verify new note hash
    component newHashComp = PoseidonNote();
    newHashComp.owner0 <== nOwner0;
    newHashComp.owner1 <== nOwner1;
    newHashComp.value <== nValue;
    newHashComp.tokenType <== nType;
    newHashComp.vk0 <== nVk0;
    newHashComp.vk1 <== nVk1;
    newHashComp.salt <== nSalt;
    newHashComp.out === newHash;

    out <== 1;
}

component main {public [smartHash, originHash, newHash]} = ConvertNote();
