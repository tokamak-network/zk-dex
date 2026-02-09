pragma circom 2.1.0;

include "../utils/poseidon/poseidon_timelock_note.circom";

// CreateTimeLock Circuit
// Creates a time-locked note that can only be spent after unlockTime
//
// Use cases:
// - Secret vesting schedules (employee token grants)
// - Anonymous inheritance
// - Confidential investment lockups
//
// Proves:
// 1. Hash: PoseidonTimeLockNote(...) == noteHash
//
// Note: No ownership proof required for creation because:
// - The depositor proves they have funds by actually depositing (contract-level)
// - The recipient is specified by pkX/pkY in the note hash
// - Only the recipient (who knows sk for pkX/pkY) can spend the note later
//
// Public inputs: [noteHash, value, tokenType, unlockTime]
// Private inputs: [pkX, pkY, salt]
//
// ~30K constraints (estimated)
template CreateTimeLock() {
    // Public inputs
    signal input noteHash;      // Time-lock note hash
    signal input value;         // Note value
    signal input tokenType;     // Token type (0=ETH, 1=DAI)
    signal input unlockTime;    // Unix timestamp for unlock

    // Private inputs
    signal input pkX;           // Recipient public key X
    signal input pkY;           // Recipient public key Y
    signal input salt;          // Salt for uniqueness

    // Output
    signal output out;

    // Lock type is always 0 for time-lock
    signal lockType;
    lockType <== 0;

    // Viewing key is pkX (standard convention)
    signal vk;
    vk <== pkX;

    // Compute time-lock note hash and verify
    component hash = PoseidonTimeLockNote();
    hash.pkX <== pkX;
    hash.pkY <== pkY;
    hash.value <== value;
    hash.tokenType <== tokenType;
    hash.salt <== salt;
    hash.unlockTime <== unlockTime;
    hash.lockType <== lockType;
    hash.vk <== vk;

    hash.out === noteHash;

    out <== 1;
}

component main {public [noteHash, value, tokenType, unlockTime]} = CreateTimeLock();
