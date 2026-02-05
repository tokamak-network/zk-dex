pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

// Poseidon-based time-lock note hash (8 inputs)
// Hash structure: Poseidon(pkX, pkY, value, tokenType, salt, unlockTime, lockType, vk)
//
// Time-lock notes:
//   pkX, pkY = BabyJubJub public key (owner)
//   value = note value
//   tokenType = 0 for ETH, 1 for DAI
//   salt = random salt for uniqueness
//   unlockTime = Unix timestamp when note can be spent
//   lockType = 0 for time-lock (reserved for future lock types)
//   vk = viewing key (typically pkX for privacy)
//
// Output: Single field element hash
template PoseidonTimeLockNote() {
    signal input pkX;           // Owner public key X
    signal input pkY;           // Owner public key Y
    signal input value;         // Note value
    signal input tokenType;     // Token type (0=ETH, 1=DAI)
    signal input salt;          // Salt for uniqueness
    signal input unlockTime;    // Unix timestamp for unlock
    signal input lockType;      // Lock type (0=time-lock)
    signal input vk;            // Viewing key (pkX)
    signal output out;          // Hash output

    component poseidon = Poseidon(8);
    poseidon.inputs[0] <== pkX;
    poseidon.inputs[1] <== pkY;
    poseidon.inputs[2] <== value;
    poseidon.inputs[3] <== tokenType;
    poseidon.inputs[4] <== salt;
    poseidon.inputs[5] <== unlockTime;
    poseidon.inputs[6] <== lockType;
    poseidon.inputs[7] <== vk;

    out <== poseidon.out;
}
