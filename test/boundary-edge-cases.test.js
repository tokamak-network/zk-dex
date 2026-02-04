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
        assert(proof.input.length === 4, 'Should have 4 public inputs');
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
        // EMPTY_NOTE_HASH is computed lazily after init, so get it dynamically
        const expectedHash = constants.EMPTY_NOTE_HASH;
        assertEqual(hash, expectedHash, 'Empty note hash should match constant');
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
        const value = '0x' + SCALING_FACTOR.toString(16).padStart(64, '0');

        // 7-param constructor: owner0, owner1, value, token, vk0, vk1, salt
        const note1 = new Note(
            pk.x,
            pk.y,
            value,
            '0x0',
            pk.x,
            pk.y,
            fixedSalt
        );
        const note2 = new Note(
            pk.x,
            pk.y,
            value,
            '0x0',
            pk.x,
            pk.y,
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
        const price = 1n * SCALING_FACTOR;
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

        // Circuit calculations with price=1*10^18:
        // q1 = takerValue / price = 10^18 / (1*10^18) = 1
        // o1ValueOverPrice = q1 * 10^18 = 1 * 10^18 = 10^18
        // bit = (makerValue >= o1ValueOverPrice) = (10^18 >= 10^18) = true
        // reward = o1ValueOverPrice = 10^18, payment = takerValue = 10^18, change = 0
        const q1 = takerValue / price;
        const o1ValueOverPrice = q1 * SCALING_FACTOR;
        const reward = o1ValueOverPrice;
        const payment = takerValue;
        const change = makerValue - reward;

        const rewardNote = noteProofHelper.createSmartNote(
            takerParent, reward, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
        );
        const paymentNote = noteProofHelper.createSmartNote(
            makerNote, payment, constants.DAI_TOKEN_TYPE, '0x0', generateSalt()
        );
        // SECURITY FIX: For bit=1, change goes to maker
        const changeNote = noteProofHelper.createSmartNote(
            makerNote, change, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
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
        const price = 10n * SCALING_FACTOR;
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
        const q1 = takerValue / price;
        const o1ValueOverPrice = q1 * SCALING_FACTOR;
        const reward = o1ValueOverPrice;
        const payment = takerValue;
        const change = makerValue - reward;

        const rewardNote = noteProofHelper.createSmartNote(
            takerParent, reward, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
        );
        const paymentNote = noteProofHelper.createSmartNote(
            makerNote, payment, constants.DAI_TOKEN_TYPE, '0x0', generateSalt()
        );
        // SECURITY FIX: For bit=1, change goes to maker
        const changeNote = noteProofHelper.createSmartNote(
            makerNote, change, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
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
        const price = 100n * SCALING_FACTOR;
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
        const q1 = takerValue / price;
        const o1ValueOverPrice = q1 * SCALING_FACTOR;
        const reward = o1ValueOverPrice;
        const payment = takerValue;
        const change = makerValue - reward;

        const rewardNote = noteProofHelper.createSmartNote(
            takerParent, reward, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
        );
        const paymentNote = noteProofHelper.createSmartNote(
            makerNote, payment, constants.DAI_TOKEN_TYPE, '0x0', generateSalt()
        );
        // SECURITY FIX: For bit=1, change goes to maker
        const changeNote = noteProofHelper.createSmartNote(
            makerNote, change, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
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
        const price = 10n * SCALING_FACTOR;
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
        const q1 = takerValue / price;
        const o1ValueOverPrice = q1 * SCALING_FACTOR;
        const reward = o1ValueOverPrice;
        const payment = takerValue;
        const change = makerValue - reward;

        const rewardNote = noteProofHelper.createSmartNote(
            takerParent, reward, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
        );
        const paymentNote = noteProofHelper.createSmartNote(
            makerNote, payment, constants.DAI_TOKEN_TYPE, '0x0', generateSalt()
        );
        // SECURITY FIX: For bit=1, change goes to maker
        const changeNote = noteProofHelper.createSmartNote(
            makerNote, change, constants.ETH_TOKEN_TYPE, '0x0', generateSalt()
        );

        const proof = await noteProofHelper.generateSettleOrderProof(
            makerNote, stakeNote, rewardNote, paymentNote, changeNote, price, makerSk
        );
        assert(proof.a && proof.b && proof.c, 'Partial fill settle proof should be generated');
    });
}

async function runSmartNoteTests() {
    log('blue', '\n=== Smart Note Tests ===\n');

    await test('Create smart note with correct ownerAddress (truncated hash)', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const { note: ownerNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );

        const smartNote = noteProofHelper.createSmartNote(
            ownerNote, SCALING_FACTOR, '0x1', '0x0', generateSalt()
        );

        // Check that smartNote has ownerAddress (160-bit truncated hash)
        assert(smartNote.ownerAddress, 'Smart note should have ownerAddress');
        const ownerClean = smartNote.ownerAddress.startsWith('0x')
            ? smartNote.ownerAddress.slice(2) : smartNote.ownerAddress;
        assert(ownerClean.length <= 40, 'ownerAddress should be at most 160 bits (40 hex chars)');
    });

    await test('Smart note ownerAddress is derived from parent note hash', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const { note: ownerNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, '0x0', '0x0', generateSalt()
        );

        const smartNote = noteProofHelper.createSmartNote(
            ownerNote, SCALING_FACTOR, '0x1', '0x0', generateSalt()
        );

        // Smart note ownerAddress = truncated(parentNoteHash)
        // = h0[0:8 hex] + h1[all 32 hex] = 40 hex chars
        const parentHash = ownerNote.hash();
        const hashClean = parentHash.startsWith('0x') ? parentHash.slice(2) : parentHash;
        const hashPadded = hashClean.padStart(64, '0');
        const expectedOwner = hashPadded.slice(0, 8) + hashPadded.slice(32);

        const ownerClean = smartNote.ownerAddress.startsWith('0x')
            ? smartNote.ownerAddress.slice(2) : smartNote.ownerAddress;
        const ownerPadded = ownerClean.padStart(40, '0');

        assertEqual(ownerPadded.toLowerCase(), expectedOwner.toLowerCase(),
            'Smart note ownerAddress should be truncated parent note hash');
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
        const value = '0x' + SCALING_FACTOR.toString(16).padStart(64, '0');

        // 7-param constructor: owner0, owner1, value, token, vk0, vk1, salt
        const note1 = new Note(pk.x, pk.y, value, '0x0', pk.x, pk.y, salt);
        const note2 = new Note(pk.x, pk.y, value, '0x0', pk.x, pk.y, salt);

        assertEqual(note1.hash(), note2.hash(), 'Same parameters should produce same hash');
    });

    await test('Hash changes with different value', async () => {
        const { pk } = await noteProofHelper.generateKeypair();
        const salt = generateSalt();
        const value1 = '0x' + SCALING_FACTOR.toString(16).padStart(64, '0');
        const value2 = '0x' + (2n * SCALING_FACTOR).toString(16).padStart(64, '0');

        // 7-param constructor: owner0, owner1, value, token, vk0, vk1, salt
        const note1 = new Note(pk.x, pk.y, value1, '0x0', pk.x, pk.y, salt);
        const note2 = new Note(pk.x, pk.y, value2, '0x0', pk.x, pk.y, salt);

        assert(note1.hash() !== note2.hash(), 'Different values should produce different hashes');
    });

    await test('Hash changes with different token type', async () => {
        const { pk } = await noteProofHelper.generateKeypair();
        const salt = generateSalt();
        const value = '0x' + SCALING_FACTOR.toString(16).padStart(64, '0');

        // 7-param constructor: owner0, owner1, value, token, vk0, vk1, salt
        const note1 = new Note(pk.x, pk.y, value, '0x0', pk.x, pk.y, salt);
        const note2 = new Note(pk.x, pk.y, value, '0x1', pk.x, pk.y, salt);

        assert(note1.hash() !== note2.hash(), 'Different token types should produce different hashes');
    });

    await test('Hash changes with different owner', async () => {
        const { pk: pk1 } = await noteProofHelper.generateKeypair();
        const { pk: pk2 } = await noteProofHelper.generateKeypair();
        const salt = generateSalt();
        const value = '0x' + SCALING_FACTOR.toString(16).padStart(64, '0');

        // 7-param constructor: owner0, owner1, value, token, vk0, vk1, salt
        const note1 = new Note(pk1.x, pk1.y, value, '0x0', pk1.x, pk1.y, salt);
        const note2 = new Note(pk2.x, pk2.y, value, '0x0', pk2.x, pk2.y, salt);

        assert(note1.hash() !== note2.hash(), 'Different owners should produce different hashes');
    });

    await test('HashArr produces valid 128-bit values', async () => {
        const { pk } = await noteProofHelper.generateKeypair();
        const value = '0x' + SCALING_FACTOR.toString(16).padStart(64, '0');
        // 7-param constructor: owner0, owner1, value, token, vk0, vk1, salt
        const note = new Note(pk.x, pk.y, value, '0x0', pk.x, pk.y, generateSalt());

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

        assertEqual(mintProof.input.length, 4, 'Mint proof should have 4 inputs');
        assertEqual(orderProof.input.length, 3, 'MakeOrder proof should have 3 inputs');
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
        // MakeOrder has 3 public inputs: output(1), noteHash, tokenType
        assertEqual(proof.input.length, 3, 'MakeOrder should have 3 public inputs');
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
        // TakeOrder has 6 public inputs: output, parentNoteHash, newNoteHash, tokenType, value, stakeOwnerAddr
        assertEqual(proof.input.length, 6, 'TakeOrder should have 6 public signals');
    });
}

async function runViewingKeyRelationshipTests() {
    log('blue', '\n=== Viewing Key ↔ OwnerAddress Relationship Tests ===\n');

    await test('Normal note: ownerAddress derived from public key', async () => {
        const { sk, pk } = await noteProofHelper.generateKeypair();
        const { note } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );

        // In Circom implementation, Note stores owner0=pkX, owner1=pkY directly
        // Verify that the note has valid owner coordinates matching the public key
        assert(note.owner0.toLowerCase() === pk.x.toLowerCase(), 'owner0 should match pkX');
        assert(note.owner1.toLowerCase() === pk.y.toLowerCase(), 'owner1 should match pkY');
    });

    await test('Smart note: ownerAddress = truncated(parentNoteHash)', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const { note: parentNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );

        const smartNote = noteProofHelper.createSmartNote(
            parentNote, SCALING_FACTOR / 2n, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        // For smart note, viewingKey = parentNoteHash
        const parentHash = parentNote.hash();
        const hashClean = parentHash.startsWith('0x') ? parentHash.slice(2) : parentHash;
        const hashPadded = hashClean.padStart(64, '0');

        // ownerAddress = h0[0:8] + h1[all 32 chars] = first 8 + last 32 = 40 hex chars
        const expectedOwner = hashPadded.slice(0, 8) + hashPadded.slice(32);

        const ownerClean = smartNote.ownerAddress.startsWith('0x') ? smartNote.ownerAddress.slice(2) : smartNote.ownerAddress;
        const ownerPadded = ownerClean.padStart(40, '0');

        assertEqual(ownerPadded.toLowerCase(), expectedOwner.toLowerCase(),
            'Smart note ownerAddress should be truncated parentNoteHash');
    });

    await test('Smart note: owner derived from parentNoteHash', async () => {
        const { sk } = await noteProofHelper.generateKeypair();
        const { note: parentNote } = await noteProofHelper.createNote(
            sk, SCALING_FACTOR, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );

        const smartNote = noteProofHelper.createSmartNote(
            parentNote, SCALING_FACTOR / 2n, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        // For smart notes, owner0=hash_hi, owner1=hash_lo (split from parentNoteHash)
        const parentHash = parentNote.hash();
        const hashClean = parentHash.startsWith('0x') ? parentHash.slice(2) : parentHash;
        const hashPadded = hashClean.padStart(64, '0');
        // owner0 = high 128 bits, owner1 = low 128 bits
        const expectedOwner0 = '0x' + hashPadded.slice(0, 32).padStart(64, '0');
        const expectedOwner1 = '0x' + hashPadded.slice(32).padStart(64, '0');

        assertEqual(smartNote.owner0.toLowerCase(), expectedOwner0.toLowerCase(),
            'Smart note owner0 should equal high bits of parentNoteHash');
        assertEqual(smartNote.owner1.toLowerCase(), expectedOwner1.toLowerCase(),
            'Smart note owner1 should equal low bits of parentNoteHash');
    });

    await test('Different keys produce different ownerAddress', async () => {
        const { sk: sk1 } = await noteProofHelper.generateKeypair();
        const { sk: sk2 } = await noteProofHelper.generateKeypair();

        const { note: note1 } = await noteProofHelper.createNote(
            sk1, SCALING_FACTOR, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );
        const { note: note2 } = await noteProofHelper.createNote(
            sk2, SCALING_FACTOR, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );

        assert(note1.ownerAddress.toLowerCase() !== note2.ownerAddress.toLowerCase(),
            'Different secret keys should produce different ownerAddresses');
    });
}

async function runSettleOrderBit0Tests() {
    log('blue', '\n=== SettleOrder bit=0 (Taker Excess) Tests ===\n');

    await test('SettleOrder with bit=0 (taker has more ETH equivalent)', async () => {
        // In bit=0 case: o0Value < o1ValueOverPrice (q1)
        // This means taker is overpaying, so change goes to taker
        //
        // Circuit fix: o0ValuePrice is now q0 * DECIMALS (scaled to wei)
        //
        // Scenario:
        // - price = 10 (10 DAI per ETH)
        // - makerValue = 5 ETH = 5×10^18 wei
        // - takerValue = 100 DAI = 100×10^18 wei
        //
        // Calculations:
        // - q1 = floor(takerValue / price) = 10×10^18 (10 ETH equivalent)
        // - o1ValueOverPrice = q1 = 10×10^18
        // - bit = (5×10^18 >= 10×10^18) = false = 0
        //
        // With bit=0 (after fix):
        // - reward = o0Value = 5×10^18 (5 ETH to taker)
        // - q0 = floor((5×10^18 * 10) / 10^18) = 50
        // - payment = o0ValuePrice = q0 * DECIMALS = 50×10^18 (50 DAI to maker)
        // - change = o1Value - o0ValuePrice = 100×10^18 - 50×10^18 = 50×10^18 (50 DAI to taker)

        const { sk: makerSk } = await noteProofHelper.generateKeypair();
        const { sk: takerSk } = await noteProofHelper.generateKeypair();

        const price = 10n * SCALING_FACTOR;
        const makerValue = 5n * SCALING_FACTOR;   // 5 ETH
        const takerValue = 100n * SCALING_FACTOR; // 100 DAI

        // Expected outputs for bit=0
        const q1 = takerValue / price;  // 10 (DAI units)
        const o1ValueOverPrice = q1 * SCALING_FACTOR;  // 10×10^18 (wei)
        const o0ValueTimesPrice = makerValue * price;
        const q0 = o0ValueTimesPrice / SCALING_FACTOR;  // 50×10^18 (DAI wei)
        const expectedReward = makerValue;  // 5×10^18 (all maker's ETH)
        const expectedPayment = q0;  // 50×10^18 (DAI to maker)
        const expectedChange = takerValue - expectedPayment;  // 50×10^18 (DAI refund to taker)

        // Verify bit=0 condition
        assert(makerValue < o1ValueOverPrice, `Should be bit=0: makerValue(${makerValue}) < o1ValueOverPrice(${o1ValueOverPrice})`);

        const { note: makerNote } = await noteProofHelper.createNote(
            makerSk, makerValue, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );
        const { note: takerParent } = await noteProofHelper.createNote(
            takerSk, takerValue, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        // Stake note owner = truncated(makerNote.hash)
        const stakeNote = noteProofHelper.createSmartNote(
            makerNote, takerValue, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        // Create output notes
        // Reward: ETH to taker (owner = takerParent hash)
        const rewardNote = noteProofHelper.createSmartNote(
            takerParent, expectedReward, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );
        // Payment: DAI to maker (owner = makerNote hash)
        const paymentNote = noteProofHelper.createSmartNote(
            makerNote, expectedPayment, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );
        // Change: DAI to taker (bit=0, so owner = takerParent hash, same as reward)
        const changeNote = noteProofHelper.createSmartNote(
            takerParent, expectedChange, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        // Generate proof
        const proof = await noteProofHelper.generateSettleOrderProof(
            makerNote, stakeNote, rewardNote, paymentNote, changeNote, price, makerSk
        );

        assert(proof.a && proof.b && proof.c, 'bit=0 proof should succeed');
        log('green', `      bit=0 values: reward=${expectedReward}, payment=${expectedPayment}, change=${expectedChange}`);
    });

    await test('SettleOrder bit=0: change owner must be taker (not maker)', async () => {
        // When bit=0, change goes to TAKER, so changeNote owner must be n0OwnerAddress (takerParent)
        const { sk: makerSk } = await noteProofHelper.generateKeypair();
        const { sk: takerSk } = await noteProofHelper.generateKeypair();

        const price = 10n * SCALING_FACTOR;
        const makerValue = 5n * SCALING_FACTOR;
        const takerValue = 100n * SCALING_FACTOR;

        // Circuit calculations for bit=0:
        // o0ValueTimesPrice = makerValue * price = 5×10^18 * 10×10^18 = 50×10^36
        // q0 = o0ValueTimesPrice / SCALING_FACTOR = 50×10^18
        // payment = q0 (NOT q0 * SCALING_FACTOR!)
        const o0ValueTimesPrice = makerValue * price;
        const q0 = o0ValueTimesPrice / SCALING_FACTOR;
        const expectedReward = makerValue;
        const expectedPayment = q0;  // Fixed: q0 is already scaled
        const expectedChange = takerValue - expectedPayment;

        const { note: makerNote } = await noteProofHelper.createNote(
            makerSk, makerValue, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );
        const { note: takerParent } = await noteProofHelper.createNote(
            takerSk, takerValue, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        const stakeNote = noteProofHelper.createSmartNote(
            makerNote, takerValue, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );
        const rewardNote = noteProofHelper.createSmartNote(
            takerParent, expectedReward, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );
        const paymentNote = noteProofHelper.createSmartNote(
            makerNote, expectedPayment, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        // WRONG: For bit=0, change should go to taker, but we use makerNote as owner
        const wrongChangeNote = noteProofHelper.createSmartNote(
            makerNote, expectedChange, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        try {
            await noteProofHelper.generateSettleOrderProof(
                makerNote, stakeNote, rewardNote, paymentNote, wrongChangeNote, price, makerSk
            );
            throw new Error('Should have failed with wrong change owner');
        } catch (error) {
            assert(
                error.message.includes('Assert Failed') || error.message.includes('constraint'),
                'Should fail due to change owner constraint violation'
            );
        }
    });
}

async function runSettleOrderSecurityTests() {
    log('blue', '\n=== SettleOrder Security Tests (Owner Verification) ===\n');

    await test('SettleOrder: stakeNote owner must equal truncated(makerNote.hash)', async () => {
        // This test verifies SECURITY FIX 1 in settle_order.circom
        const { sk: makerSk } = await noteProofHelper.generateKeypair();
        const { sk: takerSk } = await noteProofHelper.generateKeypair();

        const price = 10n * SCALING_FACTOR;
        const makerValue = 2n * SCALING_FACTOR;
        const takerValue = 10n * SCALING_FACTOR;

        const { note: makerNote } = await noteProofHelper.createNote(
            makerSk, makerValue, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );
        const { note: takerParent } = await noteProofHelper.createNote(
            takerSk, takerValue, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        // Create CORRECT stake note (owner = makerNote hash)
        const stakeNote = noteProofHelper.createSmartNote(
            makerNote, takerValue, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        // Calculate outputs for bit=1
        const q1 = takerValue / price;
        const o1ValueOverPrice = q1 * SCALING_FACTOR;
        const reward = o1ValueOverPrice;
        const payment = takerValue;
        const change = makerValue - reward;

        const rewardNote = noteProofHelper.createSmartNote(
            takerParent, reward, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );
        const paymentNote = noteProofHelper.createSmartNote(
            makerNote, payment, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );
        const changeNote = noteProofHelper.createSmartNote(
            makerNote, change, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );

        // This should succeed with correct stake note owner
        const proof = await noteProofHelper.generateSettleOrderProof(
            makerNote, stakeNote, rewardNote, paymentNote, changeNote, price, makerSk
        );
        assert(proof.a && proof.b && proof.c, 'Proof should succeed with correct stake owner');
    });

    await test('SettleOrder: paymentNote owner must equal truncated(makerNote.hash)', async () => {
        // This test verifies SECURITY FIX 2 in settle_order.circom
        const { sk: makerSk } = await noteProofHelper.generateKeypair();
        const { sk: takerSk } = await noteProofHelper.generateKeypair();

        const price = 10n * SCALING_FACTOR;
        const makerValue = 2n * SCALING_FACTOR;
        const takerValue = 10n * SCALING_FACTOR;

        const { note: makerNote } = await noteProofHelper.createNote(
            makerSk, makerValue, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );
        const { note: takerParent } = await noteProofHelper.createNote(
            takerSk, takerValue, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        const stakeNote = noteProofHelper.createSmartNote(
            makerNote, takerValue, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        const q1 = takerValue / price;
        const o1ValueOverPrice = q1 * SCALING_FACTOR;
        const reward = o1ValueOverPrice;
        const payment = takerValue;
        const change = makerValue - reward;

        const rewardNote = noteProofHelper.createSmartNote(
            takerParent, reward, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );

        // Create CORRECT payment note (owner = makerNote hash)
        const paymentNote = noteProofHelper.createSmartNote(
            makerNote, payment, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        const changeNote = noteProofHelper.createSmartNote(
            makerNote, change, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );

        const proof = await noteProofHelper.generateSettleOrderProof(
            makerNote, stakeNote, rewardNote, paymentNote, changeNote, price, makerSk
        );
        assert(proof.a && proof.b && proof.c, 'Proof should succeed with correct payment owner');
    });

    await test('SettleOrder: changeNote owner correct for bit=1 (maker)', async () => {
        // This test verifies SECURITY FIX 3 in settle_order.circom
        // When bit=1, change goes to maker, so changeNote owner = truncated(makerNote.hash)
        const { sk: makerSk } = await noteProofHelper.generateKeypair();
        const { sk: takerSk } = await noteProofHelper.generateKeypair();

        const price = 10n * SCALING_FACTOR;
        const makerValue = 2n * SCALING_FACTOR;
        const takerValue = 10n * SCALING_FACTOR;

        const { note: makerNote } = await noteProofHelper.createNote(
            makerSk, makerValue, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );
        const { note: takerParent } = await noteProofHelper.createNote(
            takerSk, takerValue, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        const stakeNote = noteProofHelper.createSmartNote(
            makerNote, takerValue, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        const q1 = takerValue / price;
        const o1ValueOverPrice = q1 * SCALING_FACTOR;
        const reward = o1ValueOverPrice;
        const payment = takerValue;
        const change = makerValue - reward;

        const rewardNote = noteProofHelper.createSmartNote(
            takerParent, reward, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );
        const paymentNote = noteProofHelper.createSmartNote(
            makerNote, payment, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        // For bit=1, change goes to MAKER (not taker!)
        const changeNote = noteProofHelper.createSmartNote(
            makerNote, change, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );

        const proof = await noteProofHelper.generateSettleOrderProof(
            makerNote, stakeNote, rewardNote, paymentNote, changeNote, price, makerSk
        );
        assert(proof.a && proof.b && proof.c, 'Proof should succeed with correct change owner (maker for bit=1)');
    });

    // Negative test: wrong change note owner should fail
    await test('SettleOrder: wrong changeNote owner should fail (bit=1)', async () => {
        const { sk: makerSk } = await noteProofHelper.generateKeypair();
        const { sk: takerSk } = await noteProofHelper.generateKeypair();

        const price = 10n * SCALING_FACTOR;
        const makerValue = 2n * SCALING_FACTOR;
        const takerValue = 10n * SCALING_FACTOR;

        const { note: makerNote } = await noteProofHelper.createNote(
            makerSk, makerValue, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );
        const { note: takerParent } = await noteProofHelper.createNote(
            takerSk, takerValue, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        const stakeNote = noteProofHelper.createSmartNote(
            makerNote, takerValue, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        const q1 = takerValue / price;
        const o1ValueOverPrice = q1 * SCALING_FACTOR;
        const reward = o1ValueOverPrice;
        const payment = takerValue;
        const change = makerValue - reward;

        const rewardNote = noteProofHelper.createSmartNote(
            takerParent, reward, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );
        const paymentNote = noteProofHelper.createSmartNote(
            makerNote, payment, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        // WRONG: For bit=1, using takerParent as change owner (should be makerNote)
        const wrongChangeNote = noteProofHelper.createSmartNote(
            takerParent, change, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );

        let failed = false;
        try {
            await noteProofHelper.generateSettleOrderProof(
                makerNote, stakeNote, rewardNote, paymentNote, wrongChangeNote, price, makerSk
            );
        } catch (e) {
            failed = true;
        }
        assert(failed, 'Proof generation should fail with wrong change owner');
    });

    // Negative test: wrong stake note owner should fail
    await test('SettleOrder: wrong stakeNote owner should fail', async () => {
        const { sk: makerSk } = await noteProofHelper.generateKeypair();
        const { sk: takerSk } = await noteProofHelper.generateKeypair();

        const price = 10n * SCALING_FACTOR;
        const makerValue = 2n * SCALING_FACTOR;
        const takerValue = 10n * SCALING_FACTOR;

        const { note: makerNote } = await noteProofHelper.createNote(
            makerSk, makerValue, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );
        const { note: takerParent } = await noteProofHelper.createNote(
            takerSk, takerValue, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        // WRONG: stake note owner = takerParent (should be makerNote)
        const wrongStakeNote = noteProofHelper.createSmartNote(
            takerParent, takerValue, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        const q1 = takerValue / price;
        const o1ValueOverPrice = q1 * SCALING_FACTOR;
        const reward = o1ValueOverPrice;
        const payment = takerValue;
        const change = makerValue - reward;

        const rewardNote = noteProofHelper.createSmartNote(
            takerParent, reward, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );
        const paymentNote = noteProofHelper.createSmartNote(
            makerNote, payment, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );
        const changeNote = noteProofHelper.createSmartNote(
            makerNote, change, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );

        let failed = false;
        try {
            await noteProofHelper.generateSettleOrderProof(
                makerNote, wrongStakeNote, rewardNote, paymentNote, changeNote, price, makerSk
            );
        } catch (e) {
            failed = true;
        }
        assert(failed, 'Proof generation should fail with wrong stake owner');
    });

    // Negative test: wrong payment note owner should fail
    await test('SettleOrder: wrong paymentNote owner should fail', async () => {
        const { sk: makerSk } = await noteProofHelper.generateKeypair();
        const { sk: takerSk } = await noteProofHelper.generateKeypair();

        const price = 10n * SCALING_FACTOR;
        const makerValue = 2n * SCALING_FACTOR;
        const takerValue = 10n * SCALING_FACTOR;

        const { note: makerNote } = await noteProofHelper.createNote(
            makerSk, makerValue, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );
        const { note: takerParent } = await noteProofHelper.createNote(
            takerSk, takerValue, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        const stakeNote = noteProofHelper.createSmartNote(
            makerNote, takerValue, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        const q1 = takerValue / price;
        const o1ValueOverPrice = q1 * SCALING_FACTOR;
        const reward = o1ValueOverPrice;
        const payment = takerValue;
        const change = makerValue - reward;

        const rewardNote = noteProofHelper.createSmartNote(
            takerParent, reward, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );

        // WRONG: payment note owner = takerParent (should be makerNote)
        const wrongPaymentNote = noteProofHelper.createSmartNote(
            takerParent, payment, constants.DAI_TOKEN_TYPE, null, generateSalt()
        );

        const changeNote = noteProofHelper.createSmartNote(
            makerNote, change, constants.ETH_TOKEN_TYPE, null, generateSalt()
        );

        let failed = false;
        try {
            await noteProofHelper.generateSettleOrderProof(
                makerNote, stakeNote, rewardNote, wrongPaymentNote, changeNote, price, makerSk
            );
        } catch (e) {
            failed = true;
        }
        assert(failed, 'Proof generation should fail with wrong payment owner');
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
        await runViewingKeyRelationshipTests();
        await runSettleOrderSecurityTests();
        await runSettleOrderBit0Tests();  // Now fixed: o0ValuePrice = q0 * DECIMALS

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
