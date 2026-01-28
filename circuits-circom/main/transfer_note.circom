pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/gates.circom";

// TransferNote Circuit
// Faithful port of Zokrates transferNote.code
//
// Note = (owner0, owner1, value, type, vk0, vk1, salt)
//
// Spend 1-2 old notes and create 2 new notes (main + change).
// If transferring with only 1 note, old note 1 fields are all 0.
//
// Constraints:
// - Ownership of old note 0 (always required)
// - Ownership of old note 1 (if not empty)
// - Value conservation: sum(old values) == sum(new values)
// - Type consistency: all notes must have same token type
//
// Public inputs: [o0Hash, o1Hash, newHash, changeHash]
template TransferNote() {
    // Public inputs
    signal input o0Hash;
    signal input o1Hash;
    signal input newHash;
    signal input changeHash;

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
    signal input sk0;
    signal input sk1;

    // Output
    signal output out;

    // Check if old note 1 is empty (single transfer)
    // Must check ALL 7 fields are zero
    component isO1Owner0Zero = IsZero();
    component isO1Owner1Zero = IsZero();
    component isO1ValueZero = IsZero();
    component isO1TypeZero = IsZero();
    component isO1Vk0Zero = IsZero();
    component isO1Vk1Zero = IsZero();
    component isO1SaltZero = IsZero();

    isO1Owner0Zero.in <== o1Owner0;
    isO1Owner1Zero.in <== o1Owner1;
    isO1ValueZero.in <== o1Value;
    isO1TypeZero.in <== o1Type;
    isO1Vk0Zero.in <== o1Vk0;
    isO1Vk1Zero.in <== o1Vk1;
    isO1SaltZero.in <== o1Salt;

    signal allZero1;
    signal allZero2;
    signal allZero3;
    signal allZero4;
    signal allZero5;
    signal isNote1Empty;

    allZero1 <== isO1Owner0Zero.out * isO1Owner1Zero.out;
    allZero2 <== allZero1 * isO1ValueZero.out;
    allZero3 <== allZero2 * isO1TypeZero.out;
    allZero4 <== allZero3 * isO1Vk0Zero.out;
    allZero5 <== allZero4 * isO1Vk1Zero.out;
    isNote1Empty <== allZero5 * isO1SaltZero.out;

    // 1. Verify ownership of old note 0
    component ownership0 = ProofOfOwnershipStrict();
    ownership0.pk[0] <== o0Owner0;
    ownership0.pk[1] <== o0Owner1;
    ownership0.sk <== sk0;

    // 2. Verify ownership of old note 1 (if not empty)
    component ownership1 = ProofOfOwnership();
    ownership1.pk[0] <== o1Owner0;
    ownership1.pk[1] <== o1Owner1;
    ownership1.sk <== sk1;

    // Either note1 is empty OR ownership is valid
    component orOwnership = OR();
    orOwnership.a <== isNote1Empty;
    orOwnership.b <== ownership1.valid;
    orOwnership.out === 1;

    // 3. Verify value conservation: o0Value + o1Value == nValue + cValue
    signal totalIn;
    signal totalOut;
    totalIn <== o0Value + o1Value;
    totalOut <== nValue + cValue;
    totalIn === totalOut;

    // 4. Type consistency
    // Either note1 empty OR o0Type == o1Type
    component typeEq01 = IsEqual();
    typeEq01.in[0] <== o0Type;
    typeEq01.in[1] <== o1Type;

    component orType = OR();
    orType.a <== isNote1Empty;
    orType.b <== typeEq01.out;
    orType.out === 1;

    // All note types must match
    o0Type === nType;
    nType === cType;

    // 5. Verify old note 0 hash
    component hash0 = PoseidonNote();
    hash0.owner0 <== o0Owner0;
    hash0.owner1 <== o0Owner1;
    hash0.value <== o0Value;
    hash0.tokenType <== o0Type;
    hash0.vk0 <== o0Vk0;
    hash0.vk1 <== o0Vk1;
    hash0.salt <== o0Salt;
    hash0.out === o0Hash;

    // 6. Verify old note 1 hash
    component hash1 = PoseidonNote();
    hash1.owner0 <== o1Owner0;
    hash1.owner1 <== o1Owner1;
    hash1.value <== o1Value;
    hash1.tokenType <== o1Type;
    hash1.vk0 <== o1Vk0;
    hash1.vk1 <== o1Vk1;
    hash1.salt <== o1Salt;
    hash1.out === o1Hash;

    // 7. Verify new note hash
    component hashNew = PoseidonNote();
    hashNew.owner0 <== nOwner0;
    hashNew.owner1 <== nOwner1;
    hashNew.value <== nValue;
    hashNew.tokenType <== nType;
    hashNew.vk0 <== nVk0;
    hashNew.vk1 <== nVk1;
    hashNew.salt <== nSalt;
    hashNew.out === newHash;

    // 8. Verify change note hash
    component hashChange = PoseidonNote();
    hashChange.owner0 <== cOwner0;
    hashChange.owner1 <== cOwner1;
    hashChange.value <== cValue;
    hashChange.tokenType <== cType;
    hashChange.vk0 <== cVk0;
    hashChange.vk1 <== cVk1;
    hashChange.salt <== cSalt;
    hashChange.out === changeHash;

    out <== 1;
}

component main {public [o0Hash, o1Hash, newHash, changeHash]} = TransferNote();
