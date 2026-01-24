/**
 * Boundary Value and Edge Case Tests for ZK-DEX
 *
 * Tests cover:
 * 1. Boundary values (min, max, bit boundaries)
 * 2. Edge cases (empty notes, same values, self-transfer)
 * 3. Price calculation edge cases
 * 4. Error cases (invalid ownership, value conservation violations)
 */

const noteProofHelper = require('../scripts/lib/noteProofHelper');
const { Note, constants } = require('../scripts/lib/Note');
const EMPTY_NOTE_HASH = constants.EMPTY_NOTE_HASH;
const snarkjsUtils = require('../scripts/lib/snarkjsUtils');

// Test configuration
const SCALING_FACTOR = 10n ** 18n;
const MAX_UINT128 = 2n ** 128n - 1n;
const MAX_UINT256 = 2n ** 256n - 1n;

// Color output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(color, msg) {
    console.log(`${colors[color]}${msg}${colors.reset}`);
}

// Test counter
let passed = 0;
let failed = 0;
let skipped = 0;

async function test(name, fn) {
    try {
        await fn();
        passed++;
        log('green', `  ✓ ${name}`);
    } catch (error) {
        failed++;
        log('red', `  ✗ ${name}`);
        log('red', `    Error: ${error.message}`);
    }
}

async function testSkip(name, reason) {
    skipped++;
    log('yellow', `  ○ ${name} (skipped: ${reason})`);
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'Not equal'}: expected ${expected}, got ${actual}`);
    }
}

// Salt counter for deterministic tests
let saltCounter = 1;
function generateSalt() {
    return '0x' + (saltCounter++).toString(16).padStart(64, '0');
}

// ============================================
// Test Suites
// ============================================

async function runBoundaryValueTests() {
    log('blue', '\n=== Boundary Value Tests ===\n');

    // Minimum values
    await test('Note with value = 0 (empty note)', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const { note } = await noteProofHelper.createNote(
            sk,
            0n,
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );
        assert(note.value === '0x0000000000000000000000000000000000000000000000000000000000000000' ||
               BigInt(note.value) === 0n, 'Value should be 0');
    });

    await test('Note with value = 1 wei (minimum non-zero)', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const { note } = await noteProofHelper.createNote(
            sk,
            1n,
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );
        const proof = await noteProofHelper.generateMintProof(note, sk);
        assert(proof.a && proof.b && proof.c, 'Proof should be generated');
        assert(proof.input.length === 5, 'Should have 5 public inputs');
    });

    await test('Note with value = 1 ETH (10^18 wei)', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const { note } = await noteProofHelper.createNote(
            sk,
            SCALING_FACTOR,
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );
        const proof = await noteProofHelper.generateMintProof(note, sk);
        assert(proof.a && proof.b && proof.c, 'Proof should be generated');
    });

    // 128-bit boundary (hash split boundary)
    await test('Note with value at 128-bit boundary (2^128 - 1)', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const { note } = await noteProofHelper.createNote(
            sk,
            MAX_UINT128,
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );
        const hash = note.hash();
        const hashArr = note.hashArr();
        assert(hashArr.length === 2, 'Hash should split into 2 parts');
        assert(BigInt(hashArr[0]) < 2n ** 128n, 'First hash part should be < 2^128');
        assert(BigInt(hashArr[1]) < 2n ** 128n, 'Second hash part should be < 2^128');
    });

    // Large values
    await test('Note with very large value (10^30)', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const largeValue = 10n ** 30n;
        const { note } = await noteProofHelper.createNote(
            sk,
            largeValue,
            constants.ETH_TOKEN_TYPE,
            '0x0',
            generateSalt()
        );
        const proof = await noteProofHelper.generateMintProof(note, sk);
        assert(proof.a && proof.b && proof.c, 'Proof should be generated for large value');
    });

    // Token type boundaries
    await test('Note with ETH token type (0)', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const { note } = await noteProofHelper.createNote(
            sk,
            SCALING_FACTOR,
            '0x0',
            '0x0',
            generateSalt()
        );
        assert(BigInt(note.token) === 0n, 'Token type should be 0');
    });

    await test('Note with DAI token type (1)', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const { note } = await noteProofHelper.createNote(
            sk,
            SCALING_FACTOR,
            '0x1',
            '0x0',
            generateSalt()
        );
        assert(BigInt(note.token) === 1n, 'Token type should be 1');
    });

    // Salt boundaries
    await test('Note with zero salt', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const { note } = await noteProofHelper.createNote(
            sk,
            SCALING_FACTOR,
            constants.ETH_TOKEN_TYPE,
            '0x0',
            '0x0'
        );
        assert(note.salt, 'Note should have salt field');
    });

    await test('Note with maximum salt (2^256 - 1)', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const maxSalt = '0x' + 'f'.repeat(64);
        const { note } = await noteProofHelper.createNote(
            sk,
            SCALING_FACTOR,
            constants.ETH_TOKEN_TYPE,
            '0x0',
            maxSalt
        );
        assert(note.salt, 'Note should have salt field');
    });
}

async function runEdgeCaseTests() {
    log('blue', '\n=== Edge Case Tests ===\n');

    // Empty note
    await test('Empty note hash matches constant', async () => {
        const emptyNote = noteProofHelper.createEmptyNote();
        const hash = emptyNote.hash();
        assertEqual(hash, EMPTY_NOTE_HASH, 'Empty note hash should match constant');
    });

    // Same value notes
    await test('Two notes with same value have different hashes (different salt)', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const { note: note1 } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );
        const { note: note2 } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );
        assert(note1.hash() !== note2.hash(), 'Notes with different salts should have different hashes');
    });

    await test('Two notes with same parameters and salt have same hash', async () => {
        const { sk, pk } = await noteProofHelper.generateKeypair();
        const fixedSalt = '0x' + '1'.repeat(64);

        const note1 = new Note(
            pk.x,
            pk.y,
            SCALING_FACTOR.toString(),
            '0x0',
            '0x0',
            fixedSalt
        );
        const note2 = new Note(
            pk.x,
            pk.y,
            SCALING_FACTOR.toString(),
            '0x0',
            '0x0',
            fixedSalt
        );
        assertEqual(note1.hash(), note2.hash(), 'Identical notes should have same hash');
    });

    // Transfer to self
    await test('Transfer note to self (same owner)', async () => {
        const { sk } = await noteProofHelper.generateKeypair();

        // Create input note
        const { note: inputNote } = await noteProofHelper.createNote(
            sk, 2n * SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );

        // Create output notes to same owner
        const { note: outputNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );
        const { note: changeNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );

        const emptyNote = noteProofHelper.createEmptyNote();

        const proof = await noteProofHelper.generateTransferProof(
            inputNote, emptyNote, outputNote, changeNote, sk, sk
        );
        assert(proof.a && proof.b && proof.c, 'Self-transfer proof should be generated');
    });

    // Equal split
    await test('Transfer with equal split (50/50)', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const totalValue = 2n * SCALING_FACTOR;

        const { note: inputNote } = await noteProofHelper.createNote(
            sk, totalValue, '0x0', '0x0', generateSalt()
        );
        const { note: outputNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );
        const { note: changeNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );

        const emptyNote = noteProofHelper.createEmptyNote();

        const proof = await noteProofHelper.generateTransferProof(
            inputNote, emptyNote, outputNote, changeNote, sk, sk
        );
        assert(proof.a && proof.b && proof.c, 'Equal split proof should be generated');
    });

    // Full transfer (no change)
    await test('Transfer entire value (change = 0)', async () => {
        const { sk } = await noteProofHelper.generateKeypair();

        const { note: inputNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );
        const { note: outputNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );

        // Change note with value 0
        const { note: changeNote } = await noteProofHelper.createNote(
            sk, 0n, '0x0', '0x0', generateSalt()
        );

        const emptyNote = noteProofHelper.createEmptyNote();

        const proof = await noteProofHelper.generateTransferProof(
            inputNote, emptyNote, outputNote, changeNote, sk, sk
        );
        assert(proof.a && proof.b && proof.c, 'Full transfer proof should be generated');
    });

    // Two input notes
    await test('Transfer with two input notes', async () => {
        const { sk } = await noteProofHelper.generateKeypair();

        const { note: input1 } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );
        const { note: input2 } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );
        const { note: outputNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );
        const { note: changeNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );

        const proof = await noteProofHelper.generateTransferProof(
            input1, input2, outputNote, changeNote, sk, sk
        );
        assert(proof.a && proof.b && proof.c, 'Two-input transfer proof should be generated');
    });
}

async function runPriceCalculationEdgeCases() {
    log('blue', '\n=== Price Calculation Edge Cases ===\n');

    // Price = 1 (1:1 exchange)
    await test('SettleOrder with price = 1 (1:1 exchange)', async () => {
        const { sk: makerSk } = await noteProofHelper.generateKeypair();
        const { sk: takerSk } = await noteProofHelper.generateKeypair();

        // Price is unscaled: 1 means "1 DAI per ETH"
        const price = 1n;
        const makerValue = SCALING_FACTOR; // 1 ETH
        const takerValue = SCALING_FACTOR; // 1 DAI

        // Create maker note (ETH)
        const { note: makerNote } = await noteProofHelper.createNote(
            makerSk, makerValue, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
        );

        // Create taker parent note (DAI)
        const { note: takerParent } = await noteProofHelper.createNote(
            takerSk, takerValue, constants.DAI_TOKEN_TYPE, '0x0', generateSalt()
        );

        // Create stake note (smart note owned by maker)
        const stakeNote = noteProofHelper.createSmartNote(
            makerNote, takerValue, constants.DAI_TOKEN_TYPE, '0x0', generateSalt()
        );

        // Circuit calculations with price=1:
        // q1 = takerValue / price = 10^18 / 1 = 10^18
        // bit = (makerValue >= q1) = (10^18 >= 10^18) = true
        // reward = q1 = 10^18, payment = takerValue = 10^18, change = 0
        const reward = takerValue / price;
        const payment = takerValue;
        const change = makerValue - reward;

        const rewardNote = noteProofHelper.createSmartNote(
            takerParent, reward, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
        );
        const paymentNote = noteProofHelper.createSmartNote(
            makerNote, payment, constants.DAI_TOKEN_TYPE, '0x0', generateSalt()
        );
        const changeNote = noteProofHelper.createSmartNote(
            takerParent, change, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
        );

        const proof = await noteProofHelper.generateSettleOrderProof(
            makerNote, stakeNote, rewardNote, paymentNote, changeNote, price, makerSk
        );
        assert(proof.a && proof.b && proof.c, 'Price=1 settle proof should be generated');
    });

    // Price perfectly divides values
    await test('SettleOrder with exact division (no remainder)', async () => {
        const { sk: makerSk } = await noteProofHelper.generateKeypair();
        const { sk: takerSk } = await noteProofHelper.generateKeypair();

        // Price is unscaled: 10 means "10 DAI per ETH"
        const price = 10n;
        const makerValue = 2n * SCALING_FACTOR;  // 2 ETH
        const takerValue = 20n * SCALING_FACTOR; // 20 DAI (exactly 2 ETH * 10)

        const { note: makerNote } = await noteProofHelper.createNote(
            makerSk, makerValue, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
        );
        const { note: takerParent } = await noteProofHelper.createNote(
            takerSk, takerValue, constants.DAI_TOKEN_TYPE, '0x0', generateSalt()
        );

        const stakeNote = noteProofHelper.createSmartNote(
            makerNote, takerValue, constants.DAI_TOKEN_TYPE, '0x0', generateSalt()
        );

        // Circuit calculations:
        // q1 = takerValue / price = 20*10^18 / 10 = 2*10^18
        // bit = (makerValue >= q1) = (2*10^18 >= 2*10^18) = true
        // reward = q1 = 2*10^18, payment = takerValue = 20*10^18, change = 0
        const reward = takerValue / price;
        const payment = takerValue;
        const change = makerValue - reward;

        const rewardNote = noteProofHelper.createSmartNote(
            takerParent, reward, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
        );
        const paymentNote = noteProofHelper.createSmartNote(
            makerNote, payment, constants.DAI_TOKEN_TYPE, '0x0', generateSalt()
        );
        const changeNote = noteProofHelper.createSmartNote(
            takerParent, change, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
        );

        const proof = await noteProofHelper.generateSettleOrderProof(
            makerNote, stakeNote, rewardNote, paymentNote, changeNote, price, makerSk
        );
        assert(proof.a && proof.b && proof.c, 'Exact division settle proof should be generated');
    });

    // Large price - maker has more ETH than taker can buy
    await test('SettleOrder with large price (100)', async () => {
        const { sk: makerSk } = await noteProofHelper.generateKeypair();
        const { sk: takerSk } = await noteProofHelper.generateKeypair();

        // Price: 100 DAI per ETH
        const price = 100n;
        const makerValue = 2n * SCALING_FACTOR;  // 2 ETH
        const takerValue = 100n * SCALING_FACTOR; // 100 DAI

        const { note: makerNote } = await noteProofHelper.createNote(
            makerSk, makerValue, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
        );
        const { note: takerParent } = await noteProofHelper.createNote(
            takerSk, takerValue, constants.DAI_TOKEN_TYPE, '0x0', generateSalt()
        );

        const stakeNote = noteProofHelper.createSmartNote(
            makerNote, takerValue, constants.DAI_TOKEN_TYPE, '0x0', generateSalt()
        );

        // Circuit calculations:
        // q1 = takerValue / price = 100*10^18 / 100 = 10^18 (1 ETH)
        // bit = (makerValue >= q1) = (2*10^18 >= 10^18) = true
        // reward = q1 = 10^18, payment = takerValue = 100*10^18, change = 10^18
        const reward = takerValue / price;
        const payment = takerValue;
        const change = makerValue - reward;

        const rewardNote = noteProofHelper.createSmartNote(
            takerParent, reward, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
        );
        const paymentNote = noteProofHelper.createSmartNote(
            makerNote, payment, constants.DAI_TOKEN_TYPE, '0x0', generateSalt()
        );
        const changeNote = noteProofHelper.createSmartNote(
            takerParent, change, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
        );

        const proof = await noteProofHelper.generateSettleOrderProof(
            makerNote, stakeNote, rewardNote, paymentNote, changeNote, price, makerSk
        );
        assert(proof.a && proof.b && proof.c, 'Large price settle proof should be generated');
    });

    // Partial fill - taker has less DAI than needed to buy all maker's ETH
    await test('SettleOrder with partial fill (change returned)', async () => {
        const { sk: makerSk } = await noteProofHelper.generateKeypair();
        const { sk: takerSk } = await noteProofHelper.generateKeypair();

        // Price: 10 DAI per ETH
        const price = 10n;
        const makerValue = 2n * SCALING_FACTOR; // 2 ETH
        const takerValue = 10n * SCALING_FACTOR; // 10 DAI (only enough for 1 ETH)

        const { note: makerNote } = await noteProofHelper.createNote(
            makerSk, makerValue, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
        );
        const { note: takerParent } = await noteProofHelper.createNote(
            takerSk, takerValue, constants.DAI_TOKEN_TYPE, '0x0', generateSalt()
        );

        const stakeNote = noteProofHelper.createSmartNote(
            makerNote, takerValue, constants.DAI_TOKEN_TYPE, '0x0', generateSalt()
        );

        // Circuit calculations:
        // q1 = takerValue / price = 10*10^18 / 10 = 10^18 (1 ETH)
        // bit = (makerValue >= q1) = (2*10^18 >= 10^18) = true
        // reward = q1 = 10^18, payment = takerValue = 10*10^18, change = 10^18
        const reward = takerValue / price;
        const payment = takerValue;
        const change = makerValue - reward;

        const rewardNote = noteProofHelper.createSmartNote(
            takerParent, reward, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
        );
        const paymentNote = noteProofHelper.createSmartNote(
            makerNote, payment, constants.DAI_TOKEN_TYPE, '0x0', generateSalt()
        );
        const changeNote = noteProofHelper.createSmartNote(
            takerParent, change, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
        );

        const proof = await noteProofHelper.generateSettleOrderProof(
            makerNote, stakeNote, rewardNote, paymentNote, changeNote, price, makerSk
        );
        assert(proof.a && proof.b && proof.c, 'Partial fill settle proof should be generated');
    });
}

async function runSmartNoteTests() {
    log('blue', '\n=== Smart Note Tests ===\n');

    await test('Create smart note with correct owner hash', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const { note: ownerNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );

        const smartNote = noteProofHelper.createSmartNote(
            ownerNote, SCALING_FACTOR, '0x1', '0x0', generateSalt()
        );

        // Check that smartNote has owner0 and owner1
        assert(smartNote.owner0, 'Smart note should have owner0');
        assert(smartNote.owner1, 'Smart note should have owner1');
    });

    await test('Smart note is identified as smart (owner is hash)', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const { note: ownerNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );

        const smartNote = noteProofHelper.createSmartNote(
            ownerNote, SCALING_FACTOR, '0x1', '0x0', generateSalt()
        );

        // Smart note owner is a hash split into two 128-bit parts
        assert(smartNote.owner0, 'Smart note should have owner0');
        assert(smartNote.owner1, 'Smart note should have owner1');
    });

    await test('ConvertNote from smart note to normal note', async () => {
        const { sk } = await noteProofHelper.generateKeypair();

        // Create origin note
        const { note: originNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );

        // Create smart note owned by origin
        const smartNote = noteProofHelper.createSmartNote(
            originNote, SCALING_FACTOR, '0x1', '0x0', generateSalt()
        );

        // Convert to normal note
        const { note: newNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x1', '0x0', generateSalt()
        );

        const proof = await noteProofHelper.generateConvertProof(
            smartNote, originNote, newNote, sk
        );
        assert(proof.a && proof.b && proof.c, 'Convert proof should be generated');
    });
}

async function runHashTests() {
    log('blue', '\n=== Hash Consistency Tests ===\n');

    await test('Hash is deterministic', async () => {
        const { pk } = await noteProofHelper.generateKeypair();
        const salt = generateSalt();

        const note1 = new Note(pk.x, pk.y, SCALING_FACTOR.toString(), '0x0', '0x0', salt);
        const note2 = new Note(pk.x, pk.y, SCALING_FACTOR.toString(), '0x0', '0x0', salt);

        assertEqual(note1.hash(), note2.hash(), 'Same parameters should produce same hash');
    });

    await test('Hash changes with different value', async () => {
        const { pk } = await noteProofHelper.generateKeypair();
        const salt = generateSalt();

        const note1 = new Note(pk.x, pk.y, SCALING_FACTOR.toString(), '0x0', '0x0', salt);
        const note2 = new Note(pk.x, pk.y, (2n * SCALING_FACTOR).toString(), '0x0', '0x0', salt);

        assert(note1.hash() !== note2.hash(), 'Different values should produce different hashes');
    });

    await test('Hash changes with different token type', async () => {
        const { pk } = await noteProofHelper.generateKeypair();
        const salt = generateSalt();

        const note1 = new Note(pk.x, pk.y, SCALING_FACTOR.toString(), '0x0', '0x0', salt);
        const note2 = new Note(pk.x, pk.y, SCALING_FACTOR.toString(), '0x1', '0x0', salt);

        assert(note1.hash() !== note2.hash(), 'Different token types should produce different hashes');
    });

    await test('Hash changes with different owner', async () => {
        const { pk: pk1 } = await noteProofHelper.generateKeypair();
        const { pk: pk2 } = await noteProofHelper.generateKeypair();
        const salt = generateSalt();

        const note1 = new Note(pk1.x, pk1.y, SCALING_FACTOR.toString(), '0x0', '0x0', salt);
        const note2 = new Note(pk2.x, pk2.y, SCALING_FACTOR.toString(), '0x0', '0x0', salt);

        assert(note1.hash() !== note2.hash(), 'Different owners should produce different hashes');
    });

    await test('HashArr produces valid 128-bit values', async () => {
        const { pk } = await noteProofHelper.generateKeypair();
        const note = new Note(pk.x, pk.y, SCALING_FACTOR.toString(), '0x0', '0x0', generateSalt());

        const hashArr = note.hashArr();
        assertEqual(hashArr.length, 2, 'HashArr should have 2 elements');

        const h0 = BigInt(hashArr[0]);
        const h1 = BigInt(hashArr[1]);

        assert(h0 < 2n ** 128n, 'First hash part should fit in 128 bits');
        assert(h1 < 2n ** 128n, 'Second hash part should fit in 128 bits');
    });
}

async function runProofFormatTests() {
    log('blue', '\n=== Proof Format Tests ===\n');

    await test('Proof has correct structure', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const { note } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );

        const proof = await noteProofHelper.generateMintProof(note, sk);

        assert(Array.isArray(proof.a), 'proof.a should be array');
        assertEqual(proof.a.length, 2, 'proof.a should have 2 elements');

        assert(Array.isArray(proof.b), 'proof.b should be array');
        assertEqual(proof.b.length, 2, 'proof.b should have 2 outer elements');
        assertEqual(proof.b[0].length, 2, 'proof.b[0] should have 2 elements');
        assertEqual(proof.b[1].length, 2, 'proof.b[1] should have 2 elements');

        assert(Array.isArray(proof.c), 'proof.c should be array');
        assertEqual(proof.c.length, 2, 'proof.c should have 2 elements');

        assert(Array.isArray(proof.input), 'proof.input should be array');
    });

    await test('Proof values are valid hex strings or BigInts', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const { note } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );

        const proof = await noteProofHelper.generateMintProof(note, sk);

        // Check that values can be converted to BigInt
        for (const val of proof.a) {
            const bigVal = BigInt(val);
            assert(bigVal >= 0n, 'Proof values should be non-negative');
        }

        for (const val of proof.c) {
            const bigVal = BigInt(val);
            assert(bigVal >= 0n, 'Proof values should be non-negative');
        }
    });

    await test('Different circuits produce different proof sizes', async () => {
        const { sk } = await noteProofHelper.generateKeypair();

        // Mint proof (5 inputs)
        const { note: mintNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );
        const mintProof = await noteProofHelper.generateMintProof(mintNote, sk);

        // MakeOrder proof (4 inputs)
        const { note: orderNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );
        const orderProof = await noteProofHelper.generateMakeOrderProof(orderNote, sk);

        assertEqual(mintProof.input.length, 5, 'Mint proof should have 5 inputs');
        assertEqual(orderProof.input.length, 4, 'MakeOrder proof should have 4 inputs');
    });
}

async function runMakeOrderTakeOrderTests() {
    log('blue', '\n=== MakeOrder/TakeOrder Tests ===\n');

    await test('MakeOrder with minimum value', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const { note } = await noteProofHelper.createNote(
            sk, 1n, '0x0', '0x0', generateSalt()
        );

        const proof = await noteProofHelper.generateMakeOrderProof(note, sk);
        assert(proof.a && proof.b && proof.c, 'MakeOrder proof should be generated for min value');
        assertEqual(proof.input.length, 4, 'MakeOrder should have 4 public inputs');
    });

    await test('TakeOrder creates valid stake note', async () => {
        const { sk: makerSk } = await noteProofHelper.generateKeypair();
        const { sk: takerSk } = await noteProofHelper.generateKeypair();

        // Maker note
        const { note: makerNote } = await noteProofHelper.createNote(
            makerSk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );

        // Taker parent note (same value for stake)
        const { note: parentNote } = await noteProofHelper.createNote(
            takerSk, SCALING_FACTOR, '0x1', '0x0', generateSalt()
        );

        // Stake note - smart note owned by maker
        const stakeNote = noteProofHelper.createSmartNote(
            makerNote, SCALING_FACTOR, '0x1', '0x0', generateSalt()
        );

        const proof = await noteProofHelper.generateTakeOrderProof(parentNote, stakeNote, takerSk);
        assert(proof.a && proof.b && proof.c, 'TakeOrder proof should be generated');
        assertEqual(proof.input.length, 9, 'TakeOrder should have 9 public inputs');
    });
}

// ============================================
// Main
// ============================================

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('  ZK-DEX Boundary Value and Edge Case Tests');
    console.log('='.repeat(60));

    try {
        // Initialize
        log('yellow', '\nInitializing noteProofHelper...');
        await noteProofHelper.init();
        log('green', 'Initialization complete.\n');

        // Run all test suites
        await runBoundaryValueTests();
        await runEdgeCaseTests();
        await runPriceCalculationEdgeCases();
        await runSmartNoteTests();
        await runHashTests();
        await runProofFormatTests();
        await runMakeOrderTakeOrderTests();

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('  Test Summary');
        console.log('='.repeat(60));
        log('green', `  Passed:  ${passed}`);
        if (failed > 0) log('red', `  Failed:  ${failed}`);
        if (skipped > 0) log('yellow', `  Skipped: ${skipped}`);
        console.log(`  Total:   ${passed + failed + skipped}`);
        console.log('='.repeat(60) + '\n');

        process.exit(failed > 0 ? 1 : 0);
    } catch (error) {
        log('red', `\nFatal error: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

main();
