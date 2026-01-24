/**
 * Frontend Integration Test
 *
 * This test demonstrates how to use the ZK-DEX proof generation
 * API from a frontend context. It tests the complete workflow:
 * 1. Key generation
 * 2. Note creation
 * 3. Proof generation
 * 4. Proof verification
 *
 * Run with: node test/frontend-integration.test.js
 */

const noteProofHelper = require('../scripts/lib/noteProofHelper');
const { constants } = require('../scripts/lib/Note');

// Test utilities
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

let passCount = 0;
let failCount = 0;

async function runTest(name, testFn) {
    try {
        log(`\n  Testing: ${name}...`, 'yellow');
        const startTime = Date.now();
        await testFn();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        log(`  ✓ ${name} (${elapsed}s)`, 'green');
        passCount++;
    } catch (error) {
        log(`  ✗ ${name}`, 'red');
        log(`    Error: ${error.message}`, 'red');
        if (error.stack) {
            log(`    ${error.stack.split('\n').slice(1, 3).join('\n')}`, 'red');
        }
        failCount++;
    }
}

async function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// ============================================
// TEST SUITES
// ============================================

// Salt counter for unique deterministic salts
let saltCounter = 1;
function generateSalt() {
    const salt = '0x' + (saltCounter++).toString(16).padStart(64, '0');
    return salt;
}

async function testKeyGeneration() {
    log('\n═══════════════════════════════════════════════', 'blue');
    log('Key Generation Tests', 'blue');
    log('═══════════════════════════════════════════════', 'blue');

    await runTest('Initialize crypto library', async () => {
        await noteProofHelper.init();
    });

    await runTest('Generate keypair', async () => {
        const keypair = await noteProofHelper.generateKeypair();

        assert(keypair.sk, 'Secret key should exist');
        assert(keypair.pk, 'Public key should exist');
        assert(keypair.pk.x, 'Public key x coordinate should exist');
        assert(keypair.pk.y, 'Public key y coordinate should exist');
        assert(keypair.sk.startsWith('0x'), 'Secret key should be hex');
        assert(keypair.pk.x.startsWith('0x'), 'Public key x should be hex');
        assert(keypair.pk.y.startsWith('0x'), 'Public key y should be hex');
    });

    await runTest('Derive public key from secret key', async () => {
        const keypair = await noteProofHelper.generateKeypair();
        const derivedPk = await noteProofHelper.derivePublicKey(keypair.sk);

        assert(derivedPk.x === keypair.pk.x, 'Derived x should match');
        assert(derivedPk.y === keypair.pk.y, 'Derived y should match');
    });

    await runTest('Generate multiple unique keypairs', async () => {
        const keypair1 = await noteProofHelper.generateKeypair();
        const keypair2 = await noteProofHelper.generateKeypair();

        assert(keypair1.sk !== keypair2.sk, 'Keypairs should be unique');
    });
}

async function testNoteCreation() {
    log('\n═══════════════════════════════════════════════', 'blue');
    log('Note Creation Tests', 'blue');
    log('═══════════════════════════════════════════════', 'blue');

    await runTest('Create ETH note', async () => {
        const keypair = await noteProofHelper.generateKeypair();
        const { note, sk } = await noteProofHelper.createNote(
            keypair.sk,
            '1000000000000000000', // 1 ETH in wei
            constants.ETH_TOKEN_TYPE
        );

        assert(note, 'Note should exist');
        assert(note.hash(), 'Note hash should be computable');
        assert(note.owner0, 'Note owner0 should exist');
        assert(note.owner1, 'Note owner1 should exist');
        assert(sk === keypair.sk, 'Secret key should match');
    });

    await runTest('Create DAI note', async () => {
        const keypair = await noteProofHelper.generateKeypair();
        const { note } = await noteProofHelper.createNote(
            keypair.sk,
            '100000000000000000000', // 100 DAI
            constants.DAI_TOKEN_TYPE
        );

        assert(note, 'Note should exist');
        assert(note.token === constants.DAI_TOKEN_TYPE, 'Token type should be DAI');
    });

    await runTest('Create note with BigInt value', async () => {
        const keypair = await noteProofHelper.generateKeypair();
        const { note } = await noteProofHelper.createNote(
            keypair.sk,
            BigInt('1000000000000000000'),
            constants.ETH_TOKEN_TYPE
        );

        assert(note, 'Note with BigInt value should work');
        assert(BigInt(note.value) === BigInt('1000000000000000000'), 'Value should match');
    });

    await runTest('Create empty note', () => {
        const emptyNote = noteProofHelper.createEmptyNote();

        assert(emptyNote, 'Empty note should exist');
        assert(emptyNote.hash(), 'Empty note hash should be computable');
    });

    await runTest('Create smart note', async () => {
        const keypair = await noteProofHelper.generateKeypair();
        const { note: parentNote } = await noteProofHelper.createNote(
            keypair.sk,
            '1000000000000000000',
            constants.ETH_TOKEN_TYPE
        );

        const smartNote = noteProofHelper.createSmartNote(
            parentNote,
            '500000000000000000', // 0.5 ETH
            constants.DAI_TOKEN_TYPE
        );

        assert(smartNote, 'Smart note should exist');
        assert(smartNote.hash(), 'Smart note hash should be computable');

        // Verify owner is derived from parent note hash
        const parentHash = parentNote.hash();
        const hashBigInt = BigInt(parentHash);
        const mask128 = (BigInt(1) << BigInt(128)) - BigInt(1);
        const expectedOwner1 = '0x' + (hashBigInt & mask128).toString(16).padStart(32, '0');
        const expectedOwner0 = '0x' + (hashBigInt >> BigInt(128)).toString(16).padStart(32, '0');

        assert(smartNote.owner0.toLowerCase().includes(expectedOwner0.slice(2).replace(/^0+/, '')),
            'Smart note owner0 should be derived from parent hash');
    });

    await runTest('Note hash is deterministic', async () => {
        const keypair = await noteProofHelper.generateKeypair();
        const salt = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

        const { note: note1 } = await noteProofHelper.createNote(
            keypair.sk,
            '1000000000000000000',
            constants.ETH_TOKEN_TYPE,
            '0x0',
            salt
        );

        const { note: note2 } = await noteProofHelper.createNote(
            keypair.sk,
            '1000000000000000000',
            constants.ETH_TOKEN_TYPE,
            '0x0',
            salt
        );

        assert(note1.hash() === note2.hash(), 'Same inputs should produce same hash');
    });
}

async function testMintProofGeneration() {
    log('\n═══════════════════════════════════════════════', 'blue');
    log('Mint Proof Generation Tests', 'blue');
    log('═══════════════════════════════════════════════', 'blue');

    await runTest('Generate mint proof for ETH note', async () => {
        const keypair = await noteProofHelper.generateKeypair();
        const { note, sk } = await noteProofHelper.createNote(
            keypair.sk,
            10n ** 18n,  // Use BigInt for precision
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        const proof = await noteProofHelper.generateMintProof(note, sk);

        assert(proof, 'Proof should exist');
        assert(proof.a, 'Proof.a should exist');
        assert(proof.b, 'Proof.b should exist');
        assert(proof.c, 'Proof.c should exist');
        assert(proof.input, 'Proof.input should exist');
        assert(Array.isArray(proof.a) && proof.a.length === 2, 'Proof.a should be [2]');
        assert(Array.isArray(proof.b) && proof.b.length === 2, 'Proof.b should be [2][2]');
        assert(Array.isArray(proof.c) && proof.c.length === 2, 'Proof.c should be [2]');
        assert(proof.input.length === 5, 'Proof should have 5 public inputs');
    });

    await runTest('Verify mint proof locally', async () => {
        const keypair = await noteProofHelper.generateKeypair();
        const { note, sk } = await noteProofHelper.createNote(
            keypair.sk,
            10n ** 18n,
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        const proof = await noteProofHelper.generateMintProof(note, sk);
        const isValid = await noteProofHelper.verifyProof('mint_burn_note', proof, proof.input);

        assert(isValid === true, 'Proof should be valid');
    });

    await runTest('Generate mint proof for DAI note', async () => {
        const keypair = await noteProofHelper.generateKeypair();
        const { note, sk } = await noteProofHelper.createNote(
            keypair.sk,
            100n * 10n ** 18n, // 100 DAI
            constants.DAI_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        const proof = await noteProofHelper.generateMintProof(note, sk);
        const isValid = await noteProofHelper.verifyProof('mint_burn_note', proof, proof.input);

        assert(isValid === true, 'DAI proof should be valid');
    });
}

async function testTransferProofGeneration() {
    log('\n═══════════════════════════════════════════════', 'blue');
    log('Transfer Proof Generation Tests', 'blue');
    log('═══════════════════════════════════════════════', 'blue');

    await runTest('Generate transfer proof (1 input)', async () => {
        // Sender creates a note
        const senderKeypair = await noteProofHelper.generateKeypair();
        const { note: senderNote, sk: senderSk } = await noteProofHelper.createNote(
            senderKeypair.sk,
            10n ** 18n, // 1 ETH
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        // Recipient's keypair
        const recipientKeypair = await noteProofHelper.generateKeypair();

        // Create new note for recipient (0.6 ETH)
        const { note: recipientNote } = await noteProofHelper.createNote(
            recipientKeypair.sk,
            6n * 10n ** 17n, // 0.6 ETH
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        // Create change note for sender (0.4 ETH)
        const { note: changeNote } = await noteProofHelper.createNote(
            senderKeypair.sk,
            4n * 10n ** 17n, // 0.4 ETH
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        // Generate transfer proof
        const proof = await noteProofHelper.generateTransferProof(
            senderNote,
            null, // No second input
            recipientNote,
            changeNote,
            senderSk,
            null
        );

        assert(proof, 'Transfer proof should exist');
        assert(proof.input.length === 9, 'Transfer proof should have 9 public inputs');

        const isValid = await noteProofHelper.verifyProof('transfer_note', proof, proof.input);
        assert(isValid === true, 'Transfer proof should be valid');
    });
}

async function testMakeOrderProofGeneration() {
    log('\n═══════════════════════════════════════════════', 'blue');
    log('MakeOrder Proof Generation Tests', 'blue');
    log('═══════════════════════════════════════════════', 'blue');

    await runTest('Generate make order proof', async () => {
        const makerKeypair = await noteProofHelper.generateKeypair();
        const { note: makerNote, sk } = await noteProofHelper.createNote(
            makerKeypair.sk,
            10n ** 18n, // 1 ETH
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        const proof = await noteProofHelper.generateMakeOrderProof(makerNote, sk);

        assert(proof, 'MakeOrder proof should exist');
        assert(proof.input.length === 4, 'MakeOrder proof should have 4 public inputs');

        const isValid = await noteProofHelper.verifyProof('make_order', proof, proof.input);
        assert(isValid === true, 'MakeOrder proof should be valid');
    });
}

async function testTakeOrderProofGeneration() {
    log('\n═══════════════════════════════════════════════', 'blue');
    log('TakeOrder Proof Generation Tests', 'blue');
    log('═══════════════════════════════════════════════', 'blue');

    await runTest('Generate take order proof', async () => {
        const TAKER_VALUE = 100n * 10n ** 18n; // 100 DAI

        // Taker has a parent note
        const takerKeypair = await noteProofHelper.generateKeypair();
        const { note: parentNote, sk: takerSk } = await noteProofHelper.createNote(
            takerKeypair.sk,
            TAKER_VALUE,
            constants.DAI_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        // Maker's note (to reference for stake)
        const makerKeypair = await noteProofHelper.generateKeypair();
        const { note: makerNote } = await noteProofHelper.createNote(
            makerKeypair.sk,
            10n ** 18n, // 1 ETH
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        // Create smart stake note (owner = maker note hash)
        // Note: TakeOrder requires stake value == parent value
        const stakeNote = noteProofHelper.createSmartNote(
            makerNote,
            TAKER_VALUE, // Must match parent note value
            constants.DAI_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        const proof = await noteProofHelper.generateTakeOrderProof(parentNote, stakeNote, takerSk);

        assert(proof, 'TakeOrder proof should exist');
        assert(proof.input.length === 9, 'TakeOrder proof should have 9 public inputs');

        const isValid = await noteProofHelper.verifyProof('take_order', proof, proof.input);
        assert(isValid === true, 'TakeOrder proof should be valid');
    });
}

async function testConvertProofGeneration() {
    log('\n═══════════════════════════════════════════════', 'blue');
    log('ConvertNote Proof Generation Tests', 'blue');
    log('═══════════════════════════════════════════════', 'blue');

    await runTest('Generate convert proof', async () => {
        // Origin note (user's regular note)
        const userKeypair = await noteProofHelper.generateKeypair();
        const { note: originNote, sk: userSk } = await noteProofHelper.createNote(
            userKeypair.sk,
            10n ** 18n, // 1 ETH
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        // Smart note (owner = origin note hash)
        const smartNote = noteProofHelper.createSmartNote(
            originNote,
            5n * 10n ** 17n, // 0.5 ETH
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        // New regular note (converted from smart note)
        const { note: newNote } = await noteProofHelper.createNote(
            userKeypair.sk,
            5n * 10n ** 17n, // 0.5 ETH (same as smart note)
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        const proof = await noteProofHelper.generateConvertProof(smartNote, originNote, newNote, userSk);

        assert(proof, 'Convert proof should exist');
        assert(proof.input.length === 7, 'Convert proof should have 7 public inputs');

        const isValid = await noteProofHelper.verifyProof('convert_note', proof, proof.input);
        assert(isValid === true, 'Convert proof should be valid');
    });
}

async function testSettleOrderProofGeneration() {
    log('\n═══════════════════════════════════════════════', 'blue');
    log('SettleOrder Proof Generation Tests', 'blue');
    log('═══════════════════════════════════════════════', 'blue');

    await runTest('Generate settle order proof', async () => {
        // Use same scenario as production test
        // Price = 10 (unscaled, meaning "10 DAI per ETH")
        const SCALING = 10n ** 18n;
        const PRICE = 10n;
        const MAKER_VALUE = 2n * SCALING; // 2 ETH
        const TAKER_VALUE = 10n * SCALING; // 10 DAI

        // Maker's note (2 ETH)
        const makerKeypair = await noteProofHelper.generateKeypair();
        const { note: makerNote, sk: makerSk } = await noteProofHelper.createNote(
            makerKeypair.sk,
            MAKER_VALUE,
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        // Taker's parent note for stake note reference
        const takerKeypair = await noteProofHelper.generateKeypair();
        const { note: takerParentNote } = await noteProofHelper.createNote(
            takerKeypair.sk,
            TAKER_VALUE,
            constants.DAI_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        // Stake note (smart note, owner = maker note hash)
        const stakeNote = noteProofHelper.createSmartNote(
            makerNote,
            TAKER_VALUE,
            constants.DAI_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        // Circuit calculations with PRICE = 10:
        // o1ValueOverPrice = q1 = takerValue / PRICE = 10 * 10^18 / 10 = 10^18 (1 ETH)
        // o0ValuePrice = q0 = (makerValue * PRICE) / 10^18 = (2 * 10^18 * 10) / 10^18 = 20
        //
        // Comparison: o0Value >= o1ValueOverPrice? 2*10^18 >= 10^18? YES! bit = 1
        //
        // With bit = 1:
        // - reward = o1ValueOverPrice = 10^18 (1 ETH for taker)
        // - payment = o1Value = 10 * 10^18 (10 DAI for maker)
        // - change = o0Value - o1ValueOverPrice = 2*10^18 - 10^18 = 10^18 (1 ETH change)

        const o1ValueOverPrice = TAKER_VALUE / PRICE; // 10^18 (1 ETH)
        const rewardValue = o1ValueOverPrice;
        const paymentValue = TAKER_VALUE; // All DAI goes to maker
        const changeValue = MAKER_VALUE - o1ValueOverPrice; // 1 ETH change

        // Output notes (all smart notes for settle_order)
        const rewardNote = noteProofHelper.createSmartNote(
            takerParentNote,
            rewardValue,
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        const paymentNote = noteProofHelper.createSmartNote(
            makerNote,
            paymentValue,
            constants.DAI_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        const changeNote = noteProofHelper.createSmartNote(
            takerParentNote,
            changeValue,
            constants.ETH_TOKEN_TYPE, // Change is ETH (same as maker's token)
            '0x0',
            generateSalt()
        );

        const proof = await noteProofHelper.generateSettleOrderProof(
            makerNote,
            stakeNote,
            rewardNote,
            paymentNote,
            changeNote,
            PRICE,
            makerSk
        );

        assert(proof, 'Settle order proof should exist');
        assert(proof.input.length === 21, 'Settle order proof should have 21 public inputs');

        const isValid = await noteProofHelper.verifyProof('settle_order', proof, proof.input);
        assert(isValid === true, 'Settle order proof should be valid');
    });
}

async function testProofFormat() {
    log('\n═══════════════════════════════════════════════', 'blue');
    log('Proof Format Tests (Contract Compatibility)', 'blue');
    log('═══════════════════════════════════════════════', 'blue');

    await runTest('Proof format matches Solidity verifier expectations', async () => {
        const keypair = await noteProofHelper.generateKeypair();
        const { note, sk } = await noteProofHelper.createNote(
            keypair.sk,
            10n ** 18n,
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        const proof = await noteProofHelper.generateMintProof(note, sk);

        // Check Groth16 format
        assert(proof.a.length === 2, 'a should be uint256[2]');
        assert(proof.b.length === 2 && proof.b[0].length === 2, 'b should be uint256[2][2]');
        assert(proof.c.length === 2, 'c should be uint256[2]');

        // Check all values are strings (for BigInt compatibility)
        assert(typeof proof.a[0] === 'string', 'a[0] should be string');
        assert(typeof proof.b[0][0] === 'string', 'b[0][0] should be string');
        assert(typeof proof.c[0] === 'string', 'c[0] should be string');
        assert(typeof proof.input[0] === 'string', 'input[0] should be string');
    });

    await runTest('Proof array helper works correctly', async () => {
        const keypair = await noteProofHelper.generateKeypair();
        const { note, sk } = await noteProofHelper.createNote(
            keypair.sk,
            10n ** 18n,
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );

        const proof = await noteProofHelper.generateMintProof(note, sk);
        const proofArray = noteProofHelper.proofToArray(proof);

        assert(Array.isArray(proofArray), 'proofToArray should return array');
        assert(proofArray.length === 4, 'proofArray should have 4 elements [a, b, c, input]');
        assert(proofArray[0] === proof.a, 'First element should be a');
        assert(proofArray[1] === proof.b, 'Second element should be b');
        assert(proofArray[2] === proof.c, 'Third element should be c');
        assert(proofArray[3] === proof.input, 'Fourth element should be input');
    });
}

// ============================================
// MAIN
// ============================================

async function main() {
    console.log('\n╔═══════════════════════════════════════════════╗');
    console.log('║     ZK-DEX Frontend Integration Tests         ║');
    console.log('╚═══════════════════════════════════════════════╝\n');

    const startTime = Date.now();

    try {
        await testKeyGeneration();
        await testNoteCreation();
        await testMintProofGeneration();
        await testTransferProofGeneration();
        await testMakeOrderProofGeneration();
        await testTakeOrderProofGeneration();
        await testConvertProofGeneration();
        await testSettleOrderProofGeneration();
        await testProofFormat();
    } catch (error) {
        log(`\nFatal error: ${error.message}`, 'red');
        console.error(error);
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n╔═══════════════════════════════════════════════╗');
    console.log('║                   Summary                     ║');
    console.log('╚═══════════════════════════════════════════════╝');
    console.log(`\n  Total time: ${totalTime}s`);
    log(`  Passed: ${passCount}`, 'green');
    if (failCount > 0) {
        log(`  Failed: ${failCount}`, 'red');
    } else {
        log(`  Failed: ${failCount}`, 'green');
    }
    console.log(`  Total:  ${passCount + failCount}\n`);

    if (failCount > 0) {
        process.exit(1);
    }
}

main();
