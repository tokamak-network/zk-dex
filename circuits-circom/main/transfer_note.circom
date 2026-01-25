pragma circom 2.1.0;

include "../utils/sha256/sha256_note_address.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/math/safe_math.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/gates.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

// TransferNote Circuit (Address-based ownership)
// Spend 1-2 old notes and create 2 new notes (main + change)
//
// Supports:
// - Single input: old note 1 only (old note 0 is empty)
// - Double input: both old notes
//
// Constraints:
// - Ownership of all non-empty old notes (via address verification)
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
    signal input o0OwnerAddress;  // 160-bit address
    signal input o0Value;
    signal input o0Type;
    signal input o0Vk0;
    signal input o0Vk1;
    signal input o0Salt;

    // Private inputs - Old note 1
    signal input o1OwnerAddress;  // 160-bit address
    signal input o1Value;
    signal input o1Type;
    signal input o1Vk0;
    signal input o1Vk1;
    signal input o1Salt;

    // Private inputs - New note
    signal input nOwnerAddress;   // 160-bit address
    signal input nValue;
    signal input nType;
    signal input nVk0;
    signal input nVk1;
    signal input nSalt;

    // Private inputs - Change note
    signal input cOwnerAddress;   // 160-bit address
    signal input cValue;
    signal input cType;
    signal input cVk0;
    signal input cVk1;
    signal input cSalt;

    // Private inputs - Secret keys
    signal input sk0;             // Secret key for old note 0
    signal input sk1;             // Secret key for old note 1

    // Output
    signal output out;

    // Check if old note 1 is empty (single transfer)
    // SECURITY FIX: Must check ALL fields are zero, not just ownerAddress
    // Original Zokrates: o1owner0 == 0 && o1owner1 == 0 && o1val == 0 && o1type == 0 && o1vk0 == 0 && o1vk1 == 0 && o1salt == 0
    component isO1AddrZero = IsZero();
    component isO1ValueZero = IsZero();
    component isO1TypeZero = IsZero();
    component isO1Vk0Zero = IsZero();
    component isO1Vk1Zero = IsZero();
    component isO1SaltZero = IsZero();

    isO1AddrZero.in <== o1OwnerAddress;
    isO1ValueZero.in <== o1Value;
    isO1TypeZero.in <== o1Type;
    isO1Vk0Zero.in <== o1Vk0;
    isO1Vk1Zero.in <== o1Vk1;
    isO1SaltZero.in <== o1Salt;

    // All fields must be zero for the note to be considered empty
    // AND all the zero checks together
    signal allZero1;
    signal allZero2;
    signal allZero3;
    signal allZero4;
    signal isNote1Empty;

    allZero1 <== isO1AddrZero.out * isO1ValueZero.out;
    allZero2 <== allZero1 * isO1TypeZero.out;
    allZero3 <== allZero2 * isO1Vk0Zero.out;
    allZero4 <== allZero3 * isO1Vk1Zero.out;
    isNote1Empty <== allZero4 * isO1SaltZero.out;

    // 1. Verify ownership of old note 0 (address-based)
    component ownership0 = VerifyOwnershipByAddressStrict();
    ownership0.address <== o0OwnerAddress;
    ownership0.sk <== sk0;

    // 2. Verify ownership of old note 1 (if not empty)
    // If empty, we skip this check by using a conditional
    component ownership1 = VerifyOwnershipByAddress();
    ownership1.address <== o1OwnerAddress;
    ownership1.sk <== sk1;

    // Either note1 is empty OR ownership is valid
    component orGate = OR();
    orGate.a <== isNote1Empty;
    orGate.b <== ownership1.valid;
    orGate.out === 1;

    // 3. Verify old note 0 hash
    component hash0 = Sha256NoteWithAddress();
    hash0.ownerAddress <== o0OwnerAddress;
    hash0.value <== o0Value;
    hash0.tokenType <== o0Type;
    hash0.vk0 <== o0Vk0;
    hash0.vk1 <== o0Vk1;
    hash0.salt <== o0Salt;

    hash0.out[0] === o0h0;
    hash0.out[1] === o0h1;

    // 4. Verify old note 1 hash
    component hash1 = Sha256NoteWithAddress();
    hash1.ownerAddress <== o1OwnerAddress;
    hash1.value <== o1Value;
    hash1.tokenType <== o1Type;
    hash1.vk0 <== o1Vk0;
    hash1.vk1 <== o1Vk1;
    hash1.salt <== o1Salt;

    hash1.out[0] === o1h0;
    hash1.out[1] === o1h1;

    // 5. Verify new note hash
    component hashNew = Sha256NoteWithAddress();
    hashNew.ownerAddress <== nOwnerAddress;
    hashNew.value <== nValue;
    hashNew.tokenType <== nType;
    hashNew.vk0 <== nVk0;
    hashNew.vk1 <== nVk1;
    hashNew.salt <== nSalt;

    hashNew.out[0] === nh0;
    hashNew.out[1] === nh1;

    // 6. Verify change note hash
    component hashChange = Sha256NoteWithAddress();
    hashChange.ownerAddress <== cOwnerAddress;
    hashChange.value <== cValue;
    hashChange.tokenType <== cType;
    hashChange.vk0 <== cVk0;
    hashChange.vk1 <== cVk1;
    hashChange.salt <== cSalt;

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
