pragma circom 2.1.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/mux1.circom";

// Merkle tree inclusion proof using Poseidon hash
// TREE_DEPTH = 20 (supports ~1M leaves)
//
// Proves that a leaf is included in a Merkle tree with a given root.
// The path is encoded as bits of pathIndex:
//   bit[i] = 0 -> sibling is on the right
//   bit[i] = 1 -> sibling is on the left
template MerkleProof(TREE_DEPTH) {
    signal input leaf;                      // Leaf value to prove inclusion
    signal input root;                      // Expected Merkle root
    signal input pathElements[TREE_DEPTH];  // Sibling hashes along the path
    signal input pathIndex;                 // Path index (encodes left/right at each level)

    // Convert path index to bits
    component indexBits = Num2Bits(TREE_DEPTH);
    indexBits.in <== pathIndex;

    // Compute root from leaf and path
    component hashers[TREE_DEPTH];
    component mux[TREE_DEPTH][2];

    signal levelHashes[TREE_DEPTH + 1];
    levelHashes[0] <== leaf;

    for (var i = 0; i < TREE_DEPTH; i++) {
        // Select order based on path bit
        // bit = 0: hash(current, sibling)
        // bit = 1: hash(sibling, current)
        mux[i][0] = Mux1();
        mux[i][0].c[0] <== levelHashes[i];
        mux[i][0].c[1] <== pathElements[i];
        mux[i][0].s <== indexBits.out[i];

        mux[i][1] = Mux1();
        mux[i][1].c[0] <== pathElements[i];
        mux[i][1].c[1] <== levelHashes[i];
        mux[i][1].s <== indexBits.out[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i][0].out;
        hashers[i].inputs[1] <== mux[i][1].out;

        levelHashes[i + 1] <== hashers[i].out;
    }

    // Verify computed root matches expected root
    root === levelHashes[TREE_DEPTH];
}

// Merkle proof with computed root output (non-strict version)
// Returns the computed root instead of constraining it
template MerkleProofCompute(TREE_DEPTH) {
    signal input leaf;
    signal input pathElements[TREE_DEPTH];
    signal input pathIndex;
    signal output computedRoot;

    component indexBits = Num2Bits(TREE_DEPTH);
    indexBits.in <== pathIndex;

    component hashers[TREE_DEPTH];
    component mux[TREE_DEPTH][2];

    signal levelHashes[TREE_DEPTH + 1];
    levelHashes[0] <== leaf;

    for (var i = 0; i < TREE_DEPTH; i++) {
        mux[i][0] = Mux1();
        mux[i][0].c[0] <== levelHashes[i];
        mux[i][0].c[1] <== pathElements[i];
        mux[i][0].s <== indexBits.out[i];

        mux[i][1] = Mux1();
        mux[i][1].c[0] <== pathElements[i];
        mux[i][1].c[1] <== levelHashes[i];
        mux[i][1].s <== indexBits.out[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i][0].out;
        hashers[i].inputs[1] <== mux[i][1].out;

        levelHashes[i + 1] <== hashers[i].out;
    }

    computedRoot <== levelHashes[TREE_DEPTH];
}
