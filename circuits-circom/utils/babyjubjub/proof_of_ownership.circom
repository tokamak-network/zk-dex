pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "./get_pubkey.circom";

// Prove that secret key corresponds to given public key
// Verifies: sk * G == pk
template ProofOfOwnership() {
    signal input pk[2];        // Public key [x, y] to verify against
    signal input sk;           // Secret key to prove ownership
    signal output valid;       // 1 if valid, 0 otherwise

    // Derive public key from secret key
    component getPk = GetPubKey();
    getPk.sk <== sk;

    // Check if derived pk matches given pk
    component eqX = IsEqual();
    component eqY = IsEqual();

    eqX.in[0] <== getPk.pk[0];
    eqX.in[1] <== pk[0];

    eqY.in[0] <== getPk.pk[1];
    eqY.in[1] <== pk[1];

    // Both coordinates must match
    valid <== eqX.out * eqY.out;
}

// Strict version that constrains valid == 1
template ProofOfOwnershipStrict() {
    signal input pk[2];        // Public key [x, y] to verify against
    signal input sk;           // Secret key to prove ownership

    component proof = ProofOfOwnership();
    proof.pk[0] <== pk[0];
    proof.pk[1] <== pk[1];
    proof.sk <== sk;

    proof.valid === 1;
}
