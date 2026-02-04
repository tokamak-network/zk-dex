/**
 * Private Voting Circuit Test
 * Tests the private voting circuit with merkle proof verification
 */

const snarkjs = require('snarkjs');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { expect } = require('chai');

// Import from project's lib
const circomlibBabyJub = require('../../scripts/lib/circomlibBabyJub');

const CIRCUITS_DIR = path.join(__dirname, '../build');
const CIRCUIT_NAME = 'private_voting';
const TREE_DEPTH = 20;

let poseidon;
let F;

/**
 * Generate proof for private_voting circuit
 */
async function generateProof(inputs) {
    const wasmPath = path.join(CIRCUITS_DIR, CIRCUIT_NAME, `${CIRCUIT_NAME}_js`, `${CIRCUIT_NAME}.wasm`);
    const zkeyPath = path.join(CIRCUITS_DIR, CIRCUIT_NAME, `${CIRCUIT_NAME}.zkey`);

    if (!fs.existsSync(wasmPath)) {
        throw new Error(`WASM file not found: ${wasmPath}. Run: npm run compile ${CIRCUIT_NAME} && npm run setup ${CIRCUIT_NAME}`);
    }
    if (!fs.existsSync(zkeyPath)) {
        throw new Error(`zkey file not found: ${zkeyPath}. Run: npm run setup ${CIRCUIT_NAME}`);
    }

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        inputs,
        wasmPath,
        zkeyPath
    );

    return { proof, publicSignals };
}

/**
 * Verify proof locally
 */
async function verifyProof(proof, publicSignals) {
    const vkeyPath = path.join(CIRCUITS_DIR, CIRCUIT_NAME, `${CIRCUIT_NAME}_vkey.json`);
    const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
    return snarkjs.groth16.verify(vkey, publicSignals, proof);
}

/**
 * Compute Poseidon hash for n inputs
 */
function poseidonHash(inputs) {
    const hash = poseidon(inputs.map(x => BigInt(x)));
    return F.toString(hash);
}

/**
 * Compute note hash: Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)
 */
function computeNoteHash(owner0, owner1, value, tokenType, vk0, vk1, salt) {
    return poseidonHash([owner0, owner1, value, tokenType, vk0, vk1, salt]);
}

/**
 * Compute vote commitment: Poseidon(proposalId, choice, voteSalt)
 */
function computeVoteCommitment(proposalId, choice, voteSalt) {
    return poseidonHash([proposalId, choice, voteSalt]);
}

/**
 * Build a Merkle tree from leaves and return root + proof for a specific index
 */
function buildMerkleTree(leaves) {
    // Pad leaves to next power of 2 up to 2^TREE_DEPTH
    const numLeaves = Math.pow(2, TREE_DEPTH);
    const paddedLeaves = [...leaves];

    // Use empty hash (Poseidon(0)) for padding
    const emptyHash = poseidonHash([0]);
    while (paddedLeaves.length < numLeaves) {
        paddedLeaves.push(emptyHash);
    }

    // Build tree level by level
    let currentLevel = paddedLeaves.map(l => BigInt(l));

    const levels = [currentLevel];

    while (currentLevel.length > 1) {
        const nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = currentLevel[i + 1] || BigInt(emptyHash);
            const hash = poseidon([left, right]);
            nextLevel.push(F.toObject(hash));
        }
        currentLevel = nextLevel;
        levels.push(currentLevel);
    }

    return { root: currentLevel[0].toString(), levels };
}

/**
 * Get Merkle proof for a leaf at given index
 */
function getMerkleProof(levels, leafIndex) {
    const pathElements = [];
    let currentIndex = leafIndex;

    for (let i = 0; i < TREE_DEPTH; i++) {
        const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
        const sibling = levels[i][siblingIndex] || BigInt(poseidonHash([0]));
        pathElements.push(sibling.toString());
        currentIndex = Math.floor(currentIndex / 2);
    }

    return pathElements;
}

describe('Private Voting Circuit', function() {
    this.timeout(120000); // 2 minutes for proof generation

    let sk, pkX, pkY;
    let noteHash, noteValue, noteSalt, tokenType, vk0, vk1;
    let merkleRoot, merklePath;
    let proposalId, choice, voteSalt, voteCommitment;
    let circuitFilesExist = false;

    before(async function() {
        // Initialize Poseidon
        await circomlibBabyJub.init();
        poseidon = await circomlibBabyJub.getPoseidon();
        F = poseidon.F;

        // Check if circuit files exist
        const wasmPath = path.join(CIRCUITS_DIR, CIRCUIT_NAME, `${CIRCUIT_NAME}_js`, `${CIRCUIT_NAME}.wasm`);
        const zkeyPath = path.join(CIRCUITS_DIR, CIRCUIT_NAME, `${CIRCUIT_NAME}.zkey`);
        circuitFilesExist = fs.existsSync(wasmPath) && fs.existsSync(zkeyPath);

        if (!circuitFilesExist) {
            console.log('\n⚠️  Circuit files not found. Run the following to compile:');
            console.log('   cd circuits-circom && npm run compile private_voting && npm run setup private_voting\n');
        }

        // Generate test keys
        sk = await circomlibBabyJub.randomSecretKey();
        const pk = await circomlibBabyJub.getPublicKey(sk);
        pkX = pk.x.toString();
        pkY = pk.y.toString();

        // Note parameters
        noteValue = '1000000000000000000'; // 1 token
        tokenType = '0'; // ETH
        vk0 = pkX;
        vk1 = pkY;
        noteSalt = BigInt('0x' + crypto.randomBytes(16).toString('hex')).toString();

        // Compute note hash
        noteHash = computeNoteHash(pkX, pkY, noteValue, tokenType, vk0, vk1, noteSalt);

        // Build Merkle tree with this note
        const { root, levels } = buildMerkleTree([noteHash]);
        merkleRoot = root;
        merklePath = getMerkleProof(levels, 0);

        // Vote parameters
        proposalId = '1';
        choice = '1'; // Vote FOR
        voteSalt = BigInt('0x' + crypto.randomBytes(16).toString('hex')).toString();
        voteCommitment = computeVoteCommitment(proposalId, choice, voteSalt);
    });

    describe('Circuit File Verification', function() {
        it('should have circuit files compiled', function() {
            if (!circuitFilesExist) {
                this.skip();
            }
            expect(circuitFilesExist).to.be.true;
        });
    });

    describe('Valid Proof Generation', function() {
        it('should generate valid proof for voting', async function() {
            if (!circuitFilesExist) {
                this.skip();
            }

            const inputs = {
                // Public inputs
                voteCommitment,
                proposalId,
                votingPower: noteValue,
                merkleRoot,

                // Private inputs - ownership
                pkX,
                pkY,
                sk: sk.toString(),

                // Private inputs - note
                noteHash,
                noteValue,
                noteSalt,
                tokenType,
                vk0,
                vk1,

                // Private inputs - vote
                choice,
                voteSalt,

                // Private inputs - merkle proof
                merklePath,
                merkleIndex: '0'
            };

            const { proof, publicSignals } = await generateProof(inputs);

            // Verify public signals order: [out, voteCommitment, proposalId, votingPower, merkleRoot]
            expect(publicSignals[0]).to.equal('1'); // out
            expect(publicSignals[1]).to.equal(voteCommitment);
            expect(publicSignals[2]).to.equal(proposalId);
            expect(publicSignals[3]).to.equal(noteValue);
            expect(publicSignals[4]).to.equal(merkleRoot);

            // Verify proof locally
            const isValid = await verifyProof(proof, publicSignals);
            expect(isValid).to.be.true;
        });
    });

    describe('Invalid Choice Rejection', function() {
        it('should reject invalid choice (>2)', async function() {
            if (!circuitFilesExist) {
                this.skip();
            }

            const invalidChoice = '3'; // Invalid: must be 0, 1, or 2
            const invalidVoteCommitment = computeVoteCommitment(proposalId, invalidChoice, voteSalt);

            const inputs = {
                voteCommitment: invalidVoteCommitment,
                proposalId,
                votingPower: noteValue,
                merkleRoot,
                pkX,
                pkY,
                sk: sk.toString(),
                noteHash,
                noteValue,
                noteSalt,
                tokenType,
                vk0,
                vk1,
                choice: invalidChoice,
                voteSalt,
                merklePath,
                merkleIndex: '0'
            };

            try {
                await generateProof(inputs);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Assert Failed');
            }
        });
    });

    describe('Wrong Merkle Proof Rejection', function() {
        it('should reject wrong merkle proof', async function() {
            if (!circuitFilesExist) {
                this.skip();
            }

            // Create a different note hash that's not in the tree
            const wrongNoteHash = computeNoteHash(pkX, pkY, '999', tokenType, vk0, vk1, noteSalt);

            const inputs = {
                voteCommitment,
                proposalId,
                votingPower: noteValue,
                merkleRoot,
                pkX,
                pkY,
                sk: sk.toString(),
                noteHash: wrongNoteHash, // Wrong note hash
                noteValue,
                noteSalt,
                tokenType,
                vk0,
                vk1,
                choice,
                voteSalt,
                merklePath,
                merkleIndex: '0'
            };

            try {
                await generateProof(inputs);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Assert Failed');
            }
        });
    });

    describe('Wrong Ownership Rejection', function() {
        it('should reject wrong ownership', async function() {
            if (!circuitFilesExist) {
                this.skip();
            }

            // Generate a different secret key
            const wrongSk = await circomlibBabyJub.randomSecretKey();

            const inputs = {
                voteCommitment,
                proposalId,
                votingPower: noteValue,
                merkleRoot,
                pkX,
                pkY,
                sk: wrongSk.toString(), // Wrong secret key
                noteHash,
                noteValue,
                noteSalt,
                tokenType,
                vk0,
                vk1,
                choice,
                voteSalt,
                merklePath,
                merkleIndex: '0'
            };

            try {
                await generateProof(inputs);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Assert Failed');
            }
        });
    });

    describe('Vote Commitment Verification', function() {
        it('should correctly compute vote commitment', async function() {
            if (!circuitFilesExist) {
                this.skip();
            }

            // Test different vote choices
            for (const testChoice of ['0', '1', '2']) {
                const testVoteSalt = BigInt('0x' + crypto.randomBytes(16).toString('hex')).toString();
                const testCommitment = computeVoteCommitment(proposalId, testChoice, testVoteSalt);

                const inputs = {
                    voteCommitment: testCommitment,
                    proposalId,
                    votingPower: noteValue,
                    merkleRoot,
                    pkX,
                    pkY,
                    sk: sk.toString(),
                    noteHash,
                    noteValue,
                    noteSalt,
                    tokenType,
                    vk0,
                    vk1,
                    choice: testChoice,
                    voteSalt: testVoteSalt,
                    merklePath,
                    merkleIndex: '0'
                };

                const { proof, publicSignals } = await generateProof(inputs);
                const isValid = await verifyProof(proof, publicSignals);
                expect(isValid).to.be.true;
            }
        });

        it('should reject mismatched vote commitment', async function() {
            if (!circuitFilesExist) {
                this.skip();
            }

            // Create commitment with different choice than what we'll provide
            const wrongCommitment = computeVoteCommitment(proposalId, '0', voteSalt);

            const inputs = {
                voteCommitment: wrongCommitment, // Commitment says choice=0
                proposalId,
                votingPower: noteValue,
                merkleRoot,
                pkX,
                pkY,
                sk: sk.toString(),
                noteHash,
                noteValue,
                noteSalt,
                tokenType,
                vk0,
                vk1,
                choice: '1', // But we provide choice=1
                voteSalt,
                merklePath,
                merkleIndex: '0'
            };

            try {
                await generateProof(inputs);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Assert Failed');
            }
        });
    });

    describe('Voting Power Verification', function() {
        it('should reject mismatched voting power', async function() {
            if (!circuitFilesExist) {
                this.skip();
            }

            const inputs = {
                voteCommitment,
                proposalId,
                votingPower: '999999', // Different from noteValue
                merkleRoot,
                pkX,
                pkY,
                sk: sk.toString(),
                noteHash,
                noteValue, // Actual note value
                noteSalt,
                tokenType,
                vk0,
                vk1,
                choice,
                voteSalt,
                merklePath,
                merkleIndex: '0'
            };

            try {
                await generateProof(inputs);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Assert Failed');
            }
        });
    });
});
