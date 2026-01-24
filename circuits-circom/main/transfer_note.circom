pragma circom 2.1.0;

include "../utils/sha256/sha256_1536bit.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/math/safe_math.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/gates.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

// TransferNote Circuit
// Spend 1-2 old notes and create 2 new notes (main + change)
//
// Supports:
// - Single input: old note 1 only (old note 0 is empty)
// - Double input: both old notes
//
// Constraints:
// - Ownership of all non-empty old notes
// - Value conservation: sum(old values) == sum(new values)
// - Type consistency: all notes must have same token type
//
// Public inputs: [o0h0, o0h1, o1h0, o1h1, nh0, nh1, changeH0, changeH1]
template TransferNote() {
    // Public inputs - Old note 0
    signal input o0h0;
    signal input o0h1;

    // Public inputs - Old note 1
    signal input o1h0;
    signal input o1h1;

    // Public inputs - New note
    signal input nh0;
    signal input nh1;

    // Public inputs - Change note
    signal input changeH0;
    signal input changeH1;

    // Private inputs - Old note 0
    signal input o0Owner0;
    signal input o0Owner1;
    signal input o0Value;
    signal input o0Type;
    signal input o0Vk0;
    signal input o0Vk1;
    signal input o0Salt;

    // Private inputs - Old note 1
    signal input o1Owner0;
    signal input o1Owner1;
    signal input o1Value;
    signal input o1Type;
    signal input o1Vk0;
    signal input o1Vk1;
    signal input o1Salt;

    // Private inputs - New note
    signal input nOwner0;
    signal input nOwner1;
    signal input nValue;
    signal input nType;
    signal input nVk0;
    signal input nVk1;
    signal input nSalt;

    // Private inputs - Change note
    signal input cOwner0;
    signal input cOwner1;
    signal input cValue;
    signal input cType;
    signal input cVk0;
    signal input cVk1;
    signal input cSalt;

    // Private inputs - Secret keys
    signal input sk0;          // Secret key for old note 0
    signal input sk1;          // Secret key for old note 1

    // Output
    signal output out;

    // Check if old note 1 is empty (single transfer)
    // Empty note has owner0 == 0 && owner1 == 0
    component isZero0 = IsZero();
    component isZero1 = IsZero();
    isZero0.in <== o1Owner0;
    isZero1.in <== o1Owner1;

    signal isNote1Empty;
    isNote1Empty <== isZero0.out * isZero1.out;

    // 1. Verify ownership of old note 0
    component ownership0 = ProofOfOwnershipStrict();
    ownership0.pk[0] <== o0Owner0;
    ownership0.pk[1] <== o0Owner1;
    ownership0.sk <== sk0;

    // 2. Verify ownership of old note 1 (if not empty)
    // If empty, we skip this check by using a conditional
    component ownership1 = ProofOfOwnership();
    ownership1.pk[0] <== o1Owner0;
    ownership1.pk[1] <== o1Owner1;
    ownership1.sk <== sk1;

    // Either note1 is empty OR ownership is valid
    component orGate = OR();
    orGate.a <== isNote1Empty;
    orGate.b <== ownership1.valid;
    orGate.out === 1;

    // 3. Verify old note 0 hash
    component hash0 = Sha256_1536bit();
    hash0.in[0] <== o0Owner0;
    hash0.in[1] <== o0Owner1;
    hash0.in[2] <== o0Value;
    hash0.in[3] <== o0Type;
    hash0.in[4] <== o0Vk0;
    hash0.in[5] <== o0Vk1;
    hash0.in[6] <== o0Salt;

    hash0.out[0] === o0h0;
    hash0.out[1] === o0h1;

    // 4. Verify old note 1 hash
    component hash1 = Sha256_1536bit();
    hash1.in[0] <== o1Owner0;
    hash1.in[1] <== o1Owner1;
    hash1.in[2] <== o1Value;
    hash1.in[3] <== o1Type;
    hash1.in[4] <== o1Vk0;
    hash1.in[5] <== o1Vk1;
    hash1.in[6] <== o1Salt;

    hash1.out[0] === o1h0;
    hash1.out[1] === o1h1;

    // 5. Verify new note hash
    component hashNew = Sha256_1536bit();
    hashNew.in[0] <== nOwner0;
    hashNew.in[1] <== nOwner1;
    hashNew.in[2] <== nValue;
    hashNew.in[3] <== nType;
    hashNew.in[4] <== nVk0;
    hashNew.in[5] <== nVk1;
    hashNew.in[6] <== nSalt;

    hashNew.out[0] === nh0;
    hashNew.out[1] === nh1;

    // 6. Verify change note hash
    component hashChange = Sha256_1536bit();
    hashChange.in[0] <== cOwner0;
    hashChange.in[1] <== cOwner1;
    hashChange.in[2] <== cValue;
    hashChange.in[3] <== cType;
    hashChange.in[4] <== cVk0;
    hashChange.in[5] <== cVk1;
    hashChange.in[6] <== cSalt;

    hashChange.out[0] === changeH0;
    hashChange.out[1] === changeH1;

    // 7. Value conservation: o0Value + o1Value == nValue + cValue
    signal totalIn;
    signal totalOut;
    totalIn <== o0Value + o1Value;
    totalOut <== nValue + cValue;
    totalIn === totalOut;

    // 8. Type consistency: all notes same type
    // If note1 is empty, we only check note0 type
    component typeEq01 = IsEqual();
    typeEq01.in[0] <== o0Type;
    typeEq01.in[1] <== o1Type;

    // Either note1 empty OR types match
    component orType = OR();
    orType.a <== isNote1Empty;
    orType.b <== typeEq01.out;
    orType.out === 1;

    // New note type must match old note 0 type
    o0Type === nType;
    o0Type === cType;

    out <== 1;
}

component main {public [o0h0, o0h1, o1h0, o1h1, nh0, nh1, changeH0, changeH1]} = TransferNote();
