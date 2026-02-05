pragma circom 2.1.0;

include "../utils/poseidon/poseidon_timelock_note.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// SpendTimeLock Circuit
// Spends a time-locked note after unlock time, converting it to a regular note
//
// Proves:
// 1. Input note hash verification (time-lock note)
// 2. Ownership verification (sk -> pk)
// 3. Time condition: currentTime >= unlockTime
// 4. Output note hash verification (regular note with same value)
// 5. Token type consistency
//
// Public inputs: [noteHash, outputHash, currentTime, tokenType]
// Private inputs: [pkX, pkY, sk, value, salt, unlockTime, outPkX, outPkY, outSalt]
//
// ~100K constraints (estimated)
template SpendTimeLock() {
    // Public inputs
    signal input noteHash;      // Input time-lock note hash
    signal input outputHash;    // Output regular note hash
    signal input currentTime;   // Current block.timestamp from contract
    signal input tokenType;     // Token type (0=ETH, 1=DAI)

    // Private inputs - Input note
    signal input pkX;           // Owner public key X
    signal input pkY;           // Owner public key Y
    signal input sk;            // Secret key for ownership proof
    signal input value;         // Note value
    signal input salt;          // Input note salt
    signal input unlockTime;    // Unlock time from input note

    // Private inputs - Output note
    signal input outPkX;        // Output note owner public key X
    signal input outPkY;        // Output note owner public key Y
    signal input outSalt;       // Output note salt

    // Output
    signal output out;

    // Lock type is always 0 for time-lock
    signal lockType;
    lockType <== 0;

    // Viewing key is pkX (standard convention)
    signal vk;
    vk <== pkX;

    // 1. Verify ownership: sk -> pk -> compare with (pkX, pkY)
    component ownership = ProofOfOwnershipStrict();
    ownership.pk[0] <== pkX;
    ownership.pk[1] <== pkY;
    ownership.sk <== sk;

    // 2. Verify input time-lock note hash
    component inputHash = PoseidonTimeLockNote();
    inputHash.pkX <== pkX;
    inputHash.pkY <== pkY;
    inputHash.value <== value;
    inputHash.tokenType <== tokenType;
    inputHash.salt <== salt;
    inputHash.unlockTime <== unlockTime;
    inputHash.lockType <== lockType;
    inputHash.vk <== vk;

    inputHash.out === noteHash;

    // 3. Time condition: currentTime >= unlockTime
    // Using LessEqThan to check unlockTime <= currentTime
    // LessEqThan returns 1 if in[0] <= in[1]
    // We use 64 bits which is enough for Unix timestamps until year 584942417355
    component timeCheck = LessEqThan(64);
    timeCheck.in[0] <== unlockTime;
    timeCheck.in[1] <== currentTime;
    timeCheck.out === 1;

    // 4. Compute output regular note hash
    // Output note uses same value and tokenType, but can have different owner
    // Output viewing key follows standard convention (vk0 = outPkX, vk1 = outPkY)
    component outputNoteHash = PoseidonNote();
    outputNoteHash.owner0 <== outPkX;
    outputNoteHash.owner1 <== outPkY;
    outputNoteHash.value <== value;
    outputNoteHash.tokenType <== tokenType;
    outputNoteHash.vk0 <== outPkX;
    outputNoteHash.vk1 <== outPkY;
    outputNoteHash.salt <== outSalt;

    outputNoteHash.out === outputHash;

    out <== 1;
}

component main {public [noteHash, outputHash, currentTime, tokenType]} = SpendTimeLock();
