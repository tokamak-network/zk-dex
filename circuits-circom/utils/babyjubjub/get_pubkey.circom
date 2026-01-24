pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/babyjub.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/escalarmulfix.circom";
include "../../node_modules/circomlib/circuits/escalarmulany.circom";

// Derive public key from secret key on Baby JubJub curve
// Uses fixed-base scalar multiplication: pk = sk * G
// where G is the generator point of Baby JubJub
template GetPubKey() {
    signal input sk;           // Secret key (field element)
    signal output pk[2];       // Public key [x, y] coordinates

    // Baby JubJub generator point (same as used in ZoKrates/iden3)
    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];

    // Convert sk to bits for scalar multiplication
    component skBits = Num2Bits(254);
    skBits.in <== sk;

    // Scalar multiplication: pk = sk * G
    component mulFix = EscalarMulFix(254, BASE8);
    for (var i = 0; i < 254; i++) {
        mulFix.e[i] <== skBits.out[i];
    }

    pk[0] <== mulFix.out[0];
    pk[1] <== mulFix.out[1];
}

// Alternative using variable base (for when base point may vary)
template GetPubKeyAny() {
    signal input sk;           // Secret key
    signal input base[2];      // Base point [x, y]
    signal output pk[2];       // Public key

    component skBits = Num2Bits(254);
    skBits.in <== sk;

    component mulAny = EscalarMulAny(254);
    mulAny.p[0] <== base[0];
    mulAny.p[1] <== base[1];
    for (var i = 0; i < 254; i++) {
        mulAny.e[i] <== skBits.out[i];
    }

    pk[0] <== mulAny.out[0];
    pk[1] <== mulAny.out[1];
}
