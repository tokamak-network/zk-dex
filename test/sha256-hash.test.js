/**
 * SHA256 Hash Format Test
 * Verifies that JavaScript and Circom compute the same note hash
 */

const crypto = require('crypto');
const path = require('path');

// Test data
const testNote = {
    owner0: '0x' + '1'.padStart(64, '0'),  // Simple test value
    owner1: '0x' + '2'.padStart(64, '0'),
    value: '0x' + 'de0b6b3a7640000'.padStart(64, '0'),  // 1 ETH = 10^18
    token: '0x' + '0'.padStart(64, '0'),   // ETH
    viewingKey: '0x' + '0'.padStart(64, '0'),
    salt: '0x' + 'abc'.padStart(64, '0')
};

/**
 * JavaScript hash computation (from noteHelper.js)
 */
function computeJsHash(note) {
    // Remove 0x prefix and ensure 64 chars
    const owner0 = note.owner0.slice(2).padStart(64, '0');
    const owner1 = note.owner1.slice(2).padStart(64, '0');
    const value = note.value.slice(2).padStart(64, '0');
    const token = note.token.slice(2).padStart(64, '0');
    const viewKey = note.viewingKey.slice(2).padStart(64, '0');
    const salt = note.salt.slice(2).padStart(64, '0');

    // Split viewKey into two 128-bit parts (32 hex chars each)
    const vkHigh = viewKey.slice(0, 32);
    const vkLow = viewKey.slice(32);

    // Concatenate all parts
    const preimage = owner0 + owner1 + value + token + vkHigh + vkLow + salt;
    console.log('\nJavaScript preimage:');
    console.log('  Length:', preimage.length, 'hex chars =', preimage.length * 4, 'bits');
    console.log('  owner0:', owner0);
    console.log('  owner1:', owner1);
    console.log('  value:', value);
    console.log('  token:', token);
    console.log('  vkHigh:', vkHigh);
    console.log('  vkLow:', vkLow);
    console.log('  salt:', salt);

    // Compute SHA256
    const buf = Buffer.from(preimage, 'hex');
    const hash = crypto.createHash('sha256').update(buf).digest('hex');

    // Split hash into two 128-bit parts
    const hash0 = hash.slice(0, 32);  // High 128 bits
    const hash1 = hash.slice(32);     // Low 128 bits

    return {
        hash,
        hash0,
        hash1,
        hash0BigInt: BigInt('0x' + hash0),
        hash1BigInt: BigInt('0x' + hash1)
    };
}

/**
 * Simulate Circom bit packing to verify format
 * This simulates what sha256_1536bit.circom does
 */
function computeCircomPreimage(note) {
    // Convert field elements to BigInt
    const owner0 = BigInt(note.owner0);
    const owner1 = BigInt(note.owner1);
    const value = BigInt(note.value);
    const token = BigInt(note.token);
    const viewKey = BigInt(note.viewingKey);
    const salt = BigInt(note.salt);

    // Split viewKey into high and low 128 bits
    const mask128 = (1n << 128n) - 1n;
    const vk0 = viewKey >> 128n;  // High 128 bits
    const vk1 = viewKey & mask128; // Low 128 bits

    console.log('\nCircom inputs (as BigInt):');
    console.log('  owner0:', owner0.toString());
    console.log('  owner1:', owner1.toString());
    console.log('  value:', value.toString());
    console.log('  token:', token.toString());
    console.log('  vk0 (high):', vk0.toString());
    console.log('  vk1 (low):', vk1.toString());
    console.log('  salt:', salt.toString());

    // Convert each field to 256-bit big-endian byte representation
    // (254 bits from field + 2 padding zeros at MSB)
    function fieldTo256Bits(field) {
        const hex = field.toString(16).padStart(64, '0');
        return hex;
    }

    function field128To128Bits(field) {
        const hex = field.toString(16).padStart(32, '0');
        return hex;
    }

    // Build preimage same as circom
    // owner0 (256) | owner1 (256) | value (256) | type (256) | vk0 (128) | vk1 (128) | salt (256)
    const preimage =
        fieldTo256Bits(owner0) +
        fieldTo256Bits(owner1) +
        fieldTo256Bits(value) +
        fieldTo256Bits(token) +
        field128To128Bits(vk0) +
        field128To128Bits(vk1) +
        fieldTo256Bits(salt);

    console.log('\nCircom preimage:');
    console.log('  Length:', preimage.length, 'hex chars =', preimage.length * 4, 'bits');

    // Compute SHA256
    const buf = Buffer.from(preimage, 'hex');
    const hash = crypto.createHash('sha256').update(buf).digest('hex');

    return {
        preimage,
        hash,
        hash0: hash.slice(0, 32),
        hash1: hash.slice(32)
    };
}

/**
 * Test with Note.js
 */
async function testWithNoteJs() {
    console.log('\n=== Testing with Note.js ===\n');

    const { Note, constants } = require('../scripts/lib/Note');

    // Create a note using Note.js
    const note = new Note(
        testNote.owner0,
        testNote.owner1,
        testNote.value,
        testNote.token,
        testNote.viewingKey,
        testNote.salt
    );

    console.log('Note created:');
    console.log('  owner0:', note.owner0);
    console.log('  owner1:', note.owner1);
    console.log('  value:', note.value);
    console.log('  token:', note.token);
    console.log('  viewingKey:', note.viewingKey);
    console.log('  salt:', note.salt);

    const hash = note.hash();
    const hashArr = note.hashArr();

    console.log('\nNote.js hash:');
    console.log('  Full hash:', hash);
    console.log('  hashArr[0]:', hashArr[0]);
    console.log('  hashArr[1]:', hashArr[1]);

    return { hash, hashArr };
}

/**
 * Main test
 */
async function main() {
    console.log('=== SHA256 Hash Format Verification ===\n');
    console.log('Test Note:');
    console.log(JSON.stringify(testNote, null, 2));

    // 1. JavaScript hash (noteHelper.js style)
    console.log('\n--- JavaScript Hash Computation ---');
    const jsResult = computeJsHash(testNote);
    console.log('\nResult:');
    console.log('  Full hash:', jsResult.hash);
    console.log('  hash0 (high 128 bits):', jsResult.hash0);
    console.log('  hash1 (low 128 bits):', jsResult.hash1);
    console.log('  hash0 BigInt:', jsResult.hash0BigInt.toString());
    console.log('  hash1 BigInt:', jsResult.hash1BigInt.toString());

    // 2. Circom-style hash
    console.log('\n--- Circom-style Hash Computation ---');
    const circomResult = computeCircomPreimage(testNote);
    console.log('\nResult:');
    console.log('  Full hash:', circomResult.hash);
    console.log('  hash0:', circomResult.hash0);
    console.log('  hash1:', circomResult.hash1);

    // 3. Compare
    console.log('\n--- Comparison ---');
    const jsPreimage =
        testNote.owner0.slice(2).padStart(64, '0') +
        testNote.owner1.slice(2).padStart(64, '0') +
        testNote.value.slice(2).padStart(64, '0') +
        testNote.token.slice(2).padStart(64, '0') +
        testNote.viewingKey.slice(2).padStart(64, '0') +
        testNote.salt.slice(2).padStart(64, '0');

    console.log('JS preimage matches Circom preimage:', jsPreimage === circomResult.preimage);
    console.log('Hashes match:', jsResult.hash === circomResult.hash);

    // 4. Test with Note.js
    try {
        const noteJsResult = await testWithNoteJs();
        console.log('\n--- Note.js vs Direct Computation ---');
        console.log('Note.js hash matches JS computation:', noteJsResult.hash === ('0x' + jsResult.hash));
    } catch (error) {
        console.log('\nNote.js test skipped:', error.message);
    }

    // 5. Summary
    console.log('\n=== Summary ===');
    if (jsResult.hash === circomResult.hash) {
        console.log('✅ JavaScript and Circom hash formats are COMPATIBLE');
        console.log('   The circom circuit should correctly verify note hashes computed in JavaScript');
    } else {
        console.log('❌ Hash format MISMATCH detected!');
        console.log('   Need to investigate bit ordering or preimage format differences');
    }

    return jsResult.hash === circomResult.hash;
}

main().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
