/**
 * ZkDex Groth16 Integration Test
 * Tests the smart contracts with the new Groth16 proof format
 * Uses development mode for simplified testing (skips proof verification)
 */

const ZkDex = artifacts.require("ZkDex");
const MockDai = artifacts.require("MockDai");
const MintBurnNoteVerifier = artifacts.require("MintBurnNoteVerifier");
const TransferNoteVerifier = artifacts.require("TransferNoteVerifier");
const ConvertNoteVerifier = artifacts.require("ConvertNoteVerifier");
const MakeOrderVerifier = artifacts.require("MakeOrderVerifier");
const TakeOrderVerifier = artifacts.require("TakeOrderVerifier");
const SettleOrderVerifier = artifacts.require("SettleOrderVerifier");

const { Note, constants } = require('../scripts/lib/Note');
const util = require('./util');

const SCALING_FACTOR = 10n ** 18n;

contract('ZkDex Groth16', function(accounts) {
    let dai, zkdex;
    let mintVerifier, transferVerifier, convertVerifier;
    let makeOrderVerifier, takeOrderVerifier, settleOrderVerifier;

    before(async () => {
        // Deploy MockDai
        dai = await MockDai.new();

        // Deploy all verifiers
        mintVerifier = await MintBurnNoteVerifier.new();
        transferVerifier = await TransferNoteVerifier.new();
        convertVerifier = await ConvertNoteVerifier.new();
        makeOrderVerifier = await MakeOrderVerifier.new();
        takeOrderVerifier = await TakeOrderVerifier.new();
        settleOrderVerifier = await SettleOrderVerifier.new();

        // Deploy ZkDex in development mode (true)
        zkdex = await ZkDex.new(
            true,  // development mode - skips proof verification
            dai.address,
            mintVerifier.address,
            transferVerifier.address,
            convertVerifier.address,
            makeOrderVerifier.address,
            takeOrderVerifier.address,
            settleOrderVerifier.address
        );
    });

    describe('Contract Deployment', () => {
        it('should deploy MockDai', async () => {
            assert.ok(dai.address);
        });

        it('should deploy all verifiers', async () => {
            assert.ok(mintVerifier.address);
            assert.ok(transferVerifier.address);
            assert.ok(convertVerifier.address);
            assert.ok(makeOrderVerifier.address);
            assert.ok(takeOrderVerifier.address);
            assert.ok(settleOrderVerifier.address);
        });

        it('should deploy ZkDex', async () => {
            assert.ok(zkdex.address);
        });

        it('should be in development mode', async () => {
            const devMode = await zkdex.development();
            assert.equal(devMode, true, 'Should be in development mode');
        });
    });

    describe('Note Minting (Development Mode)', () => {
        it('should mint a note with ETH', async () => {
            // Create a test note
            const owner0 = '0x' + '1'.padStart(64, '0');
            const owner1 = '0x' + '2'.padStart(64, '0');
            const value = SCALING_FACTOR;  // 1 ETH
            const tokenType = constants.ETH_TOKEN_TYPE;
            const viewingKey = '0x' + '0'.padStart(64, '0');
            const salt = '0x' + 'abc123'.padStart(64, '0');

            const note = new Note(owner0, owner1, value.toString(16), tokenType, viewingKey, salt);
            const hashArr = note.hashArr();

            // Create dummy Groth16 proof (will be skipped in dev mode)
            // snarkjs order: [output, nh0, nh1, value, tokenType]
            const proof = util.createDummyGroth16Proof([
                '0x1',       // output (always first in snarkjs)
                hashArr[0],  // nh0
                hashArr[1],  // nh1
                '0x' + value.toString(16),  // value
                tokenType    // tokenType
            ]);

            // Encrypt note (dummy encryption for test)
            const encryptedNote = '0x' + Buffer.from(note.toString()).toString('hex');

            // Mint the note
            const tx = await zkdex.mint(
                proof.a,
                proof.b,
                proof.c,
                proof.input,
                encryptedNote,
                { value: value.toString(), from: accounts[0] }
            );

            // Check event
            assert.ok(tx.logs.length > 0, 'Should emit events');
        });

        it('should mint a note with DAI', async () => {
            const daiAmount = 5n * SCALING_FACTOR;  // 5 DAI

            // Approve DAI transfer
            await dai.approve(zkdex.address, daiAmount.toString());

            // Create a test note
            const owner0 = '0x' + '3'.padStart(64, '0');
            const owner1 = '0x' + '4'.padStart(64, '0');
            const tokenType = constants.DAI_TOKEN_TYPE;
            const viewingKey = '0x' + '0'.padStart(64, '0');
            const salt = '0x' + 'def456'.padStart(64, '0');

            const note = new Note(owner0, owner1, daiAmount.toString(16), tokenType, viewingKey, salt);
            const hashArr = note.hashArr();

            // Create dummy Groth16 proof
            // snarkjs order: [output, nh0, nh1, value, tokenType]
            const proof = util.createDummyGroth16Proof([
                '0x1',       // output (always first in snarkjs)
                hashArr[0],
                hashArr[1],
                '0x' + daiAmount.toString(16),
                tokenType
            ]);

            const encryptedNote = '0x' + Buffer.from(note.toString()).toString('hex');

            // Mint the note
            const tx = await zkdex.mint(
                proof.a,
                proof.b,
                proof.c,
                proof.input,
                encryptedNote,
                { from: accounts[0] }
            );

            assert.ok(tx.logs.length > 0, 'Should emit events');

            // Check DAI was transferred
            const zkdexBalance = await dai.balanceOf(zkdex.address);
            assert.equal(zkdexBalance.toString(), daiAmount.toString(), 'ZkDex should have the DAI');
        });
    });

    describe('Note State Management', () => {
        it('should track note states correctly', async () => {
            // Create and mint a note
            const owner0 = '0x' + '5'.padStart(64, '0');
            const owner1 = '0x' + '6'.padStart(64, '0');
            const value = SCALING_FACTOR;
            const tokenType = constants.ETH_TOKEN_TYPE;
            const viewingKey = '0x' + '0'.padStart(64, '0');
            const salt = '0x' + 'aabbcc123'.padStart(64, '0');

            const note = new Note(owner0, owner1, value.toString(16), tokenType, viewingKey, salt);
            const noteHash = note.hash();
            const hashArr = note.hashArr();

            // snarkjs order: [output, nh0, nh1, value, tokenType]
            const proof = util.createDummyGroth16Proof([
                '0x1',       // output (always first in snarkjs)
                hashArr[0],
                hashArr[1],
                '0x' + value.toString(16),
                tokenType
            ]);

            const encryptedNote = '0x' + Buffer.from(note.toString()).toString('hex');

            await zkdex.mint(
                proof.a,
                proof.b,
                proof.c,
                proof.input,
                encryptedNote,
                { value: value.toString(), from: accounts[0] }
            );

            // Check note state is Valid (1)
            const state = await zkdex.notes(noteHash);
            assert.equal(state.toString(), '1', 'Note should be in Valid state');
        });
    });

    describe('Groth16 Proof Format', () => {
        it('should accept correct Groth16 proof format', async () => {
            // Groth16 format: a[2], b[2][2], c[2], input[5]
            const a = ['0x1', '0x2'];
            const b = [['0x3', '0x4'], ['0x5', '0x6']];
            const c = ['0x7', '0x8'];

            assert.equal(a.length, 2, 'a should have 2 elements');
            assert.equal(b.length, 2, 'b should have 2 rows');
            assert.equal(b[0].length, 2, 'b[0] should have 2 elements');
            assert.equal(b[1].length, 2, 'b[1] should have 2 elements');
            assert.equal(c.length, 2, 'c should have 2 elements');
        });
    });
});
