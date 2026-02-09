/**
 * Time Lock Circuit Tests
 * Tests for create_timelock and spend_timelock circuits
 */

const snarkjs = require('snarkjs');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { expect } = require('chai');

// Import from project's lib
const circomlibBabyJub = require('../../scripts/lib/circomlibBabyJub');

const CIRCUITS_DIR = path.join(__dirname, '../build');

let poseidon;
let F;

/**
 * Generate proof for a circuit
 */
async function generateProof(circuitName, inputs) {
    const wasmPath = path.join(CIRCUITS_DIR, circuitName, `${circuitName}_js`, `${circuitName}.wasm`);
    const zkeyPath = path.join(CIRCUITS_DIR, circuitName, `${circuitName}.zkey`);

    if (!fs.existsSync(wasmPath)) {
        throw new Error(`WASM file not found: ${wasmPath}. Run: npm run compile ${circuitName} && npm run setup ${circuitName}`);
    }
    if (!fs.existsSync(zkeyPath)) {
        throw new Error(`zkey file not found: ${zkeyPath}. Run: npm run setup ${circuitName}`);
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
async function verifyProof(circuitName, proof, publicSignals) {
    const vkeyPath = path.join(CIRCUITS_DIR, circuitName, `${circuitName}_vkey.json`);
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
 * Compute time-lock note hash: Poseidon(pkX, pkY, value, tokenType, salt, unlockTime, lockType, vk)
 */
function computeTimeLockNoteHash(pkX, pkY, value, tokenType, salt, unlockTime, lockType, vk) {
    return poseidonHash([pkX, pkY, value, tokenType, salt, unlockTime, lockType, vk]);
}

/**
 * Compute regular note hash: Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)
 */
function computeRegularNoteHash(owner0, owner1, value, tokenType, vk0, vk1, salt) {
    return poseidonHash([owner0, owner1, value, tokenType, vk0, vk1, salt]);
}

/**
 * Check if circuit files exist
 */
function checkCircuitFiles(circuitName) {
    const wasmPath = path.join(CIRCUITS_DIR, circuitName, `${circuitName}_js`, `${circuitName}.wasm`);
    const zkeyPath = path.join(CIRCUITS_DIR, circuitName, `${circuitName}.zkey`);
    return fs.existsSync(wasmPath) && fs.existsSync(zkeyPath);
}

describe('Time Lock Circuits', function() {
    this.timeout(120000); // 2 minutes for proof generation

    let sk, pkX, pkY;
    let noteValue, tokenType, noteSalt, unlockTime;
    let timeLockNoteHash;
    let createTimeLockFilesExist = false;
    let spendTimeLockFilesExist = false;

    before(async function() {
        // Initialize Poseidon
        await circomlibBabyJub.init();
        poseidon = await circomlibBabyJub.getPoseidon();
        F = poseidon.F;

        // Check if circuit files exist
        createTimeLockFilesExist = checkCircuitFiles('create_timelock');
        spendTimeLockFilesExist = checkCircuitFiles('spend_timelock');

        if (!createTimeLockFilesExist) {
            console.log('\n⚠️  create_timelock circuit files not found. Run:');
            console.log('   cd circuits-circom && npm run compile create_timelock && npm run setup create_timelock\n');
        }
        if (!spendTimeLockFilesExist) {
            console.log('\n⚠️  spend_timelock circuit files not found. Run:');
            console.log('   cd circuits-circom && npm run compile spend_timelock && npm run setup spend_timelock\n');
        }

        // Generate test keys
        sk = await circomlibBabyJub.randomSecretKey();
        const pk = await circomlibBabyJub.getPublicKey(sk);
        pkX = pk.x.toString();
        pkY = pk.y.toString();

        // Note parameters
        noteValue = '1000000000000000000'; // 1 token
        tokenType = '0'; // ETH
        noteSalt = BigInt('0x' + crypto.randomBytes(16).toString('hex')).toString();

        // Unlock time: 1 hour from now (in seconds)
        unlockTime = (Math.floor(Date.now() / 1000) + 3600).toString();

        // Compute time-lock note hash
        // lockType = 0, vk = pkX
        timeLockNoteHash = computeTimeLockNoteHash(
            pkX, pkY, noteValue, tokenType, noteSalt, unlockTime, '0', pkX
        );
    });

    describe('CreateTimeLock Circuit', function() {
        it('should have circuit files compiled', function() {
            if (!createTimeLockFilesExist) {
                this.skip();
            }
            expect(createTimeLockFilesExist).to.be.true;
        });

        it('should create valid time-locked note', async function() {
            if (!createTimeLockFilesExist) {
                this.skip();
            }

            const inputs = {
                // Public inputs
                noteHash: timeLockNoteHash,
                value: noteValue,
                tokenType: tokenType,
                unlockTime: unlockTime,

                // Private inputs (no sk needed - ownership verified at spend time)
                pkX: pkX,
                pkY: pkY,
                salt: noteSalt
            };

            const { proof, publicSignals } = await generateProof('create_timelock', inputs);

            // Verify public signals order: [out, noteHash, value, tokenType, unlockTime]
            expect(publicSignals[0]).to.equal('1'); // out
            expect(publicSignals[1]).to.equal(timeLockNoteHash);
            expect(publicSignals[2]).to.equal(noteValue);
            expect(publicSignals[3]).to.equal(tokenType);
            expect(publicSignals[4]).to.equal(unlockTime);

            // Verify proof locally
            const isValid = await verifyProof('create_timelock', proof, publicSignals);
            expect(isValid).to.be.true;
        });

        it('should allow creating note for different recipient', async function() {
            if (!createTimeLockFilesExist) {
                this.skip();
            }

            // Generate a different recipient key pair
            const recipientSk = await circomlibBabyJub.randomSecretKey();
            const recipientPk = await circomlibBabyJub.getPublicKey(recipientSk);
            const recipientPkX = recipientPk.x.toString();
            const recipientPkY = recipientPk.y.toString();

            // Compute note hash for recipient
            const recipientNoteHash = computeTimeLockNoteHash(
                recipientPkX, recipientPkY, noteValue, tokenType, noteSalt, unlockTime, '0', recipientPkX
            );

            const inputs = {
                noteHash: recipientNoteHash,
                value: noteValue,
                tokenType: tokenType,
                unlockTime: unlockTime,
                pkX: recipientPkX,
                pkY: recipientPkY,
                salt: noteSalt
            };

            const { proof, publicSignals } = await generateProof('create_timelock', inputs);
            const isValid = await verifyProof('create_timelock', proof, publicSignals);
            expect(isValid).to.be.true;
        });

        it('should reject wrong note hash', async function() {
            if (!createTimeLockFilesExist) {
                this.skip();
            }

            // Create a wrong hash by using different value
            const wrongHash = computeTimeLockNoteHash(
                pkX, pkY, '999', tokenType, noteSalt, unlockTime, '0', pkX
            );

            const inputs = {
                noteHash: wrongHash, // Wrong hash
                value: noteValue,    // Correct value
                tokenType: tokenType,
                unlockTime: unlockTime,
                pkX: pkX,
                pkY: pkY,
                salt: noteSalt
            };

            try {
                await generateProof('create_timelock', inputs);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Assert Failed');
            }
        });
    });

    describe('SpendTimeLock Circuit', function() {
        let outPkX, outPkY, outSk, outSalt;
        let outputNoteHash;
        let currentTime;

        before(async function() {
            // Generate output note keys (can be same or different owner)
            outSk = await circomlibBabyJub.randomSecretKey();
            const outPk = await circomlibBabyJub.getPublicKey(outSk);
            outPkX = outPk.x.toString();
            outPkY = outPk.y.toString();
            outSalt = BigInt('0x' + crypto.randomBytes(16).toString('hex')).toString();

            // Compute output regular note hash
            outputNoteHash = computeRegularNoteHash(
                outPkX, outPkY, noteValue, tokenType, outPkX, outPkY, outSalt
            );

            // Current time after unlock time (for successful spend)
            currentTime = (parseInt(unlockTime) + 1).toString();
        });

        it('should have circuit files compiled', function() {
            if (!spendTimeLockFilesExist) {
                this.skip();
            }
            expect(spendTimeLockFilesExist).to.be.true;
        });

        it('should spend when time condition met', async function() {
            if (!spendTimeLockFilesExist) {
                this.skip();
            }

            const inputs = {
                // Public inputs
                noteHash: timeLockNoteHash,
                outputHash: outputNoteHash,
                currentTime: currentTime,
                tokenType: tokenType,

                // Private inputs - input note
                pkX: pkX,
                pkY: pkY,
                sk: sk.toString(),
                value: noteValue,
                salt: noteSalt,
                unlockTime: unlockTime,

                // Private inputs - output note
                outPkX: outPkX,
                outPkY: outPkY,
                outSalt: outSalt
            };

            const { proof, publicSignals } = await generateProof('spend_timelock', inputs);

            // Verify public signals order: [out, noteHash, outputHash, currentTime, tokenType]
            expect(publicSignals[0]).to.equal('1'); // out
            expect(publicSignals[1]).to.equal(timeLockNoteHash);
            expect(publicSignals[2]).to.equal(outputNoteHash);
            expect(publicSignals[3]).to.equal(currentTime);
            expect(publicSignals[4]).to.equal(tokenType);

            // Verify proof locally
            const isValid = await verifyProof('spend_timelock', proof, publicSignals);
            expect(isValid).to.be.true;
        });

        it('should reject when currentTime < unlockTime', async function() {
            if (!spendTimeLockFilesExist) {
                this.skip();
            }

            // Time before unlock
            const earlyTime = (parseInt(unlockTime) - 100).toString();

            const inputs = {
                noteHash: timeLockNoteHash,
                outputHash: outputNoteHash,
                currentTime: earlyTime, // Too early!
                tokenType: tokenType,
                pkX: pkX,
                pkY: pkY,
                sk: sk.toString(),
                value: noteValue,
                salt: noteSalt,
                unlockTime: unlockTime,
                outPkX: outPkX,
                outPkY: outPkY,
                outSalt: outSalt
            };

            try {
                await generateProof('spend_timelock', inputs);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Assert Failed');
            }
        });

        it('should reject wrong ownership', async function() {
            if (!spendTimeLockFilesExist) {
                this.skip();
            }

            const wrongSk = await circomlibBabyJub.randomSecretKey();

            const inputs = {
                noteHash: timeLockNoteHash,
                outputHash: outputNoteHash,
                currentTime: currentTime,
                tokenType: tokenType,
                pkX: pkX,
                pkY: pkY,
                sk: wrongSk.toString(), // Wrong secret key
                value: noteValue,
                salt: noteSalt,
                unlockTime: unlockTime,
                outPkX: outPkX,
                outPkY: outPkY,
                outSalt: outSalt
            };

            try {
                await generateProof('spend_timelock', inputs);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Assert Failed');
            }
        });

        it('should preserve value in output note', async function() {
            if (!spendTimeLockFilesExist) {
                this.skip();
            }

            // Create output hash with different value
            const wrongOutputHash = computeRegularNoteHash(
                outPkX, outPkY, '999', tokenType, outPkX, outPkY, outSalt
            );

            const inputs = {
                noteHash: timeLockNoteHash,
                outputHash: wrongOutputHash, // Wrong output with different value
                currentTime: currentTime,
                tokenType: tokenType,
                pkX: pkX,
                pkY: pkY,
                sk: sk.toString(),
                value: noteValue, // Original value
                salt: noteSalt,
                unlockTime: unlockTime,
                outPkX: outPkX,
                outPkY: outPkY,
                outSalt: outSalt
            };

            try {
                await generateProof('spend_timelock', inputs);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).to.include('Assert Failed');
            }
        });

        it('should allow transfer to different owner', async function() {
            if (!spendTimeLockFilesExist) {
                this.skip();
            }

            // Generate completely different recipient
            const recipientSk = await circomlibBabyJub.randomSecretKey();
            const recipientPk = await circomlibBabyJub.getPublicKey(recipientSk);
            const recipientPkX = recipientPk.x.toString();
            const recipientPkY = recipientPk.y.toString();
            const recipientSalt = BigInt('0x' + crypto.randomBytes(16).toString('hex')).toString();

            const recipientNoteHash = computeRegularNoteHash(
                recipientPkX, recipientPkY, noteValue, tokenType,
                recipientPkX, recipientPkY, recipientSalt
            );

            const inputs = {
                noteHash: timeLockNoteHash,
                outputHash: recipientNoteHash,
                currentTime: currentTime,
                tokenType: tokenType,
                pkX: pkX,
                pkY: pkY,
                sk: sk.toString(),
                value: noteValue,
                salt: noteSalt,
                unlockTime: unlockTime,
                outPkX: recipientPkX,
                outPkY: recipientPkY,
                outSalt: recipientSalt
            };

            const { proof, publicSignals } = await generateProof('spend_timelock', inputs);
            const isValid = await verifyProof('spend_timelock', proof, publicSignals);
            expect(isValid).to.be.true;
        });
    });
});
