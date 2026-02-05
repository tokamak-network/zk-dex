pragma circom 2.1.0;

include "../utils/poseidon/poseidon_timelock_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";

// CreateTimeLock Circuit
// Creates a time-locked note that can only be spent after unlockTime
//
// Use cases:
// - Secret vesting schedules (employee token grants)
// - Anonymous inheritance
// - Confidential investment lockups
//
// Proves:
// 1. Ownership: sk corresponds to the note's public key (pkX, pkY)
// 2. Hash: PoseidonTimeLockNote(...) == noteHash
//
// Public inputs: [noteHash, value, tokenType, unlockTime]
// Private inputs: [pkX, pkY, salt, sk]
//
// ~50K constraints (estimated)
template CreateTimeLock() {
    // Public inputs
    signal input noteHash;      // Time-lock note hash
    signal input value;         // Note value
    signal input tokenType;     // Token type (0=ETH, 1=DAI)
    signal input unlockTime;    // Unix timestamp for unlock

    // Private inputs
    signal input pkX;           // Owner public key X
    signal input pkY;           // Owner public key Y
    signal input salt;          // Salt for uniqueness
    signal input sk;            // Secret key for ownership proof

    // Output
    signal output out;

    // Lock type is always 0 for time-lock
    signal lockType;
    lockType <== 0;

    // Viewing key is pkX (standard convention)
    signal vk;
    vk <== pkX;

    // 1. Check ownership: sk -> pk -> compare with (pkX, pkY)
    component ownership = ProofOfOwnershipStrict();
    ownership.pk[0] <== pkX;
    ownership.pk[1] <== pkY;
    ownership.sk <== sk;

    // 2. Compute time-lock note hash and verify
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
