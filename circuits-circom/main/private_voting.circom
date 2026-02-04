pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// Private Voting Circuit
//
// Commit-reveal voting with hidden choices and public voting power.
// Uses existing ETH/DAI notes for voting power (note value = voting power).
//
// Public inputs:
//   - voteCommitment: Hash(choice, voteSalt) - hides vote choice
//   - proposalId: The proposal being voted on
//   - votingPower: Note value (public)
//   - merkleRoot: Snapshot Merkle root of notes
//
// Private inputs:
//   - pkX, pkY, sk: Ownership proof
//   - noteHash, noteValue, noteSalt, tokenType, vk0, vk1: Note data
//   - choice: Vote choice (0=against, 1=for, 2=abstain)
//   - voteSalt: Salt for vote commitment
//   - merklePath[20]: Merkle proof path
//   - merkleIndex: Leaf index in tree
//
// Proves:
//   1. Ownership of the note (sk -> pk matches note owner)
//   2. Note is in the snapshot Merkle tree
//   3. votingPower == noteValue
//   4. voteCommitment == Poseidon(proposalId, choice, voteSalt)
//   5. choice is valid (0, 1, or 2)
//
// Constraints: ~150K (similar to mint_burn_note)

template PrivateVoting() {
    var TREE_DEPTH = 20;

    // Public inputs
    signal input voteCommitment;
    signal input proposalId;
    signal input votingPower;
    signal input merkleRoot;

    // Private inputs - ownership
    signal input pkX;
    signal input pkY;
    signal input sk;

    // Private inputs - note data
    signal input noteHash;
    signal input noteValue;
    signal input noteSalt;
    signal input tokenType;
    signal input vk0;
    signal input vk1;

    // Private inputs - vote
    signal input choice;
    signal input voteSalt;

    // Private inputs - merkle proof
    signal input merklePath[TREE_DEPTH];
    signal input merkleIndex;

    // Output (for compatibility)
    signal output out;

    // 1. Verify ownership: sk -> pk
    component ownership = ProofOfOwnershipStrict();
    ownership.pk[0] <== pkX;
    ownership.pk[1] <== pkY;
    ownership.sk <== sk;

    // 2. Verify note hash
    component noteHasher = PoseidonNote();
    noteHasher.owner0 <== pkX;
    noteHasher.owner1 <== pkY;
    noteHasher.value <== noteValue;
    noteHasher.tokenType <== tokenType;
    noteHasher.vk0 <== vk0;
    noteHasher.vk1 <== vk1;
    noteHasher.salt <== noteSalt;

    noteHasher.out === noteHash;

    // 3. Verify note is in Merkle tree
    component merkleProof = MerkleProof(TREE_DEPTH);
    merkleProof.leaf <== noteHash;
    merkleProof.root <== merkleRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkleProof.pathElements[i] <== merklePath[i];
    }
    merkleProof.pathIndex <== merkleIndex;

    // 4. Verify voting power matches note value
    votingPower === noteValue;

    // 5. Verify vote commitment
    // voteCommitment = Poseidon(proposalId, choice, voteSalt)
    component commitHasher = Poseidon(3);
    commitHasher.inputs[0] <== proposalId;
    commitHasher.inputs[1] <== choice;
    commitHasher.inputs[2] <== voteSalt;

    voteCommitment === commitHasher.out;

    // 6. Verify choice is valid (0, 1, or 2)
    // choice * (choice - 1) * (choice - 2) == 0
    signal choiceMinus1;
    signal choiceMinus2;
    signal product1;
    signal product2;

    choiceMinus1 <== choice - 1;
    choiceMinus2 <== choice - 2;
    product1 <== choice * choiceMinus1;
    product2 <== product1 * choiceMinus2;

    product2 === 0;

    out <== 1;
}

component main {public [voteCommitment, proposalId, votingPower, merkleRoot]} = PrivateVoting();
