/**
 * Proof Generation Test
 * Tests actual proof generation with circom circuits
 */

const path = require('path');
const { Note, constants } = require('../scripts/lib/Note');
const snarkjsUtils = require('../scripts/lib/snarkjsUtils');
const noteProofHelper = require('../scripts/lib/noteProofHelper');

const SCALING_FACTOR = BigInt(10) ** BigInt(18);

async function testMintProof() {
    console.log('\n=== Test: MintNBurnNote Proof Generation ===\n');

    // Check if circuits are initialized
    const initialized = await snarkjsUtils.initialized();
    if (!initialized) {
        console.log('❌ Circuit files not found. Run setup first:');
        console.log('   cd circuits-circom && npm run compile && npm run setup');
        return false;
    }
    console.log('✅ Circuit files found');

    try {
        // 1. Generate a keypair using circomlib-compatible BabyJubJub
        console.log('\n1. Generating keypair...');
        const keypair = await noteProofHelper.generateKeypair();
        console.log('   Secret key:', keypair.sk.slice(0, 20) + '...');
        console.log('   Public key X:', keypair.pk.x.slice(0, 20) + '...');
        console.log('   Public key Y:', keypair.pk.y.slice(0, 20) + '...');

        // 2. Create a note
        console.log('\n2. Creating note...');
        const value = SCALING_FACTOR; // 1 ETH
        const { note, sk } = await noteProofHelper.createNote(
            keypair.sk,
            value,
            constants.ETH_TOKEN_TYPE,
            '0x0',
            '0x' + 'abc123'.padStart(64, '0')
        );
        console.log('   Note value:', value.toString());
        console.log('   Note hash:', note.hash());
        console.log('   Note hashArr:', note.hashArr());

        // 3. Generate proof
        console.log('\n3. Generating proof (this may take a few seconds)...');
        const startTime = Date.now();
        const proof = await snarkjsUtils.getMintNBurnProof(note, sk);
        const elapsed = Date.now() - startTime;
        console.log(`   Proof generated in ${elapsed}ms`);
        console.log('   Proof a:', proof.a);
        console.log('   Proof b:', proof.b);
        console.log('   Proof c:', proof.c);
        console.log('   Public inputs:', proof.input);

        // 4. Verify proof locally
        console.log('\n4. Verifying proof locally...');
        const valid = await snarkjsUtils.verifyProofLocal('mint_burn_note', proof, proof.input);
        console.log('   Proof valid:', valid);

        if (valid) {
            console.log('\n✅ MintNBurnNote proof test PASSED');
            return true;
        } else {
            console.log('\n❌ MintNBurnNote proof test FAILED - proof invalid');
            return false;
        }
    } catch (error) {
        console.log('\n❌ MintNBurnNote proof test FAILED');
        console.log('   Error:', error.message);
        if (error.stack) {
            console.log('   Stack:', error.stack.split('\n').slice(0, 3).join('\n'));
        }
        return false;
    }
}

async function testMakeOrderProof() {
    console.log('\n=== Test: MakeOrder Proof Generation ===\n');

    try {
        // 1. Generate a keypair
        console.log('1. Generating keypair...');
        const keypair = await noteProofHelper.generateKeypair();

        // 2. Create a maker note with fixed salt for reproducibility
        console.log('2. Creating maker note...');
        const value = 5n * SCALING_FACTOR; // 5 ETH
        const fixedSalt = '0x' + 'deadbeef'.padStart(64, '0');
        const { note: makerNote, sk } = await noteProofHelper.createNote(
            keypair.sk,
            value,
            constants.ETH_TOKEN_TYPE,
            '0x0',
            fixedSalt
        );
        console.log('   Note value:', value.toString());
        console.log('   Note hash:', makerNote.hash());
        console.log('   Note owner0:', makerNote.owner0);
        console.log('   Note owner1:', makerNote.owner1);
        console.log('   Note salt:', makerNote.salt);

        // 3. Generate proof
        console.log('3. Generating proof...');
        const startTime = Date.now();
        const proof = await snarkjsUtils.getMakeOrderProof(makerNote, sk);
        const elapsed = Date.now() - startTime;
        console.log(`   Proof generated in ${elapsed}ms`);

        // 4. Verify proof locally
        console.log('4. Verifying proof locally...');
        const valid = await snarkjsUtils.verifyProofLocal('make_order', proof, proof.input);
        console.log('   Proof valid:', valid);

        if (valid) {
            console.log('\n✅ MakeOrder proof test PASSED');
            return true;
        } else {
            console.log('\n❌ MakeOrder proof test FAILED - proof invalid');
            return false;
        }
    } catch (error) {
        console.log('\n❌ MakeOrder proof test FAILED');
        console.log('   Error:', error.message);
        return false;
    }
}

async function testTransferProof() {
    console.log('\n=== Test: TransferNote Proof Generation ===\n');

    try {
        // 1. Generate keypairs for sender and recipient
        console.log('1. Generating keypairs...');
        const senderKeypair = await noteProofHelper.generateKeypair();
        const recipientKeypair = await noteProofHelper.generateKeypair();
        console.log('   Sender and recipient keypairs generated');

        // 2. Create old note (sender's note to spend)
        console.log('2. Creating old note (10 ETH)...');
        const oldValue = 10n * SCALING_FACTOR;
        const { note: oldNote0, sk: senderSk } = await noteProofHelper.createNote(
            senderKeypair.sk,
            oldValue,
            constants.ETH_TOKEN_TYPE,
            '0x0',
            '0x' + 'aaa111'.padStart(64, '0')
        );
        console.log('   Old note hash:', oldNote0.hash());

        // 3. Create new note (recipient's note)
        console.log('3. Creating new note (3 ETH to recipient)...');
        const newValue = 3n * SCALING_FACTOR;
        const { note: newNote } = await noteProofHelper.createNote(
            recipientKeypair.sk,
            newValue,
            constants.ETH_TOKEN_TYPE,
            '0x0',
            '0x' + 'bbb222'.padStart(64, '0')
        );
        console.log('   New note hash:', newNote.hash());

        // 4. Create change note (back to sender)
        console.log('4. Creating change note (7 ETH back to sender)...');
        const changeValue = 7n * SCALING_FACTOR;
        const { note: changeNote } = await noteProofHelper.createNote(
            senderKeypair.sk,
            changeValue,
            constants.ETH_TOKEN_TYPE,
            '0x0',
            '0x' + 'ccc333'.padStart(64, '0')
        );
        console.log('   Change note hash:', changeNote.hash());

        // 5. Generate proof
        console.log('5. Generating transfer proof...');
        const startTime = Date.now();
        const proof = await snarkjsUtils.getTransferProof(
            oldNote0,
            null,  // No second input note
            newNote,
            changeNote,
            senderSk,
            null   // No second secret key
        );
        const elapsed = Date.now() - startTime;
        console.log(`   Proof generated in ${elapsed}ms`);

        // 6. Verify proof locally
        console.log('6. Verifying proof locally...');
        const valid = await snarkjsUtils.verifyProofLocal('transfer_note', proof, proof.input);
        console.log('   Proof valid:', valid);

        if (valid) {
            console.log('\n✅ TransferNote proof test PASSED');
            return true;
        } else {
            console.log('\n❌ TransferNote proof test FAILED - proof invalid');
            return false;
        }
    } catch (error) {
        console.log('\n❌ TransferNote proof test FAILED');
        console.log('   Error:', error.message);
        return false;
    }
}

async function main() {
    console.log('=== Proof Generation Tests ===');
    console.log('Testing actual circom circuit proof generation');

    const results = {
        mint: await testMintProof(),
        makeOrder: await testMakeOrderProof(),
        transfer: await testTransferProof()
    };

    console.log('\n=== Summary ===');
    console.log('MintNBurnNote:', results.mint ? '✅ PASSED' : '❌ FAILED');
    console.log('MakeOrder:', results.makeOrder ? '✅ PASSED' : '❌ FAILED');
    console.log('TransferNote:', results.transfer ? '✅ PASSED' : '❌ FAILED');

    const allPassed = Object.values(results).every(r => r);
    console.log('\nOverall:', allPassed ? '✅ All tests PASSED' : '❌ Some tests FAILED');

    return allPassed;
}

main().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
