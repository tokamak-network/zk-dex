/**
 * Verify that sk > p causes a mismatch between browser and circuit key derivation.
 *
 * This script proves that:
 * 1. When sk > p (BN128 field prime), the circuit uses (sk mod p) for key derivation
 * 2. The browser's mulPointEscalar(Base8, sk) uses the full sk value
 * 3. These produce DIFFERENT public keys and addresses
 * 4. Reducing sk mod p before mulPointEscalar fixes the mismatch
 */

const { buildBabyjub, buildPoseidon } = require('circomlibjs');
const snarkjs = require('snarkjs');
const path = require('path');
const fs = require('fs');

const BN128_FIELD_PRIME = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
const MASK_254 = (BigInt(1) << BigInt(254)) - BigInt(1);
const MASK_160 = (BigInt(1) << BigInt(160)) - BigInt(1);

async function main() {
    const babyJub = await buildBabyjub();
    const poseidon = await buildPoseidon();
    const F = babyJub.F;

    console.log('=== SK Field Reduction Verification ===\n');
    console.log('BN128 field prime p:', BN128_FIELD_PRIME.toString());
    console.log('mask254 (2^254-1):  ', MASK_254.toString());
    console.log('p < mask254:', BN128_FIELD_PRIME < MASK_254);
    console.log('');

    // Generate a sk that is deliberately > p (using mask254 like browser does)
    // We'll create one that's between p and 2^254-1
    const skOverP = BN128_FIELD_PRIME + BigInt(12345);
    const skReduced = skOverP % BN128_FIELD_PRIME; // = 12345

    console.log('--- Test with sk > p ---');
    console.log('sk (original):', skOverP.toString());
    console.log('sk (mod p):   ', skReduced.toString());
    console.log('sk > p?       ', skOverP > BN128_FIELD_PRIME);
    console.log('');

    // Browser behavior (BEFORE fix): uses unreduced sk
    const pkUnreduced = babyJub.mulPointEscalar(babyJub.Base8, skOverP);
    const pkUnreducedX = F.toObject(pkUnreduced[0]);
    const pkUnreducedY = F.toObject(pkUnreduced[1]);

    // Browser behavior (AFTER fix): uses sk mod p
    const pkReduced = babyJub.mulPointEscalar(babyJub.Base8, skReduced);
    const pkReducedX = F.toObject(pkReduced[0]);
    const pkReducedY = F.toObject(pkReduced[1]);

    console.log('PK from unreduced sk:', { x: pkUnreducedX.toString().substring(0, 20) + '...', y: pkUnreducedY.toString().substring(0, 20) + '...' });
    console.log('PK from reduced sk:  ', { x: pkReducedX.toString().substring(0, 20) + '...', y: pkReducedY.toString().substring(0, 20) + '...' });
    console.log('PKs match?', pkUnreducedX === pkReducedX && pkUnreducedY === pkReducedY);
    console.log('');

    // Derive addresses
    const hashUnreduced = poseidon([pkUnreducedX, pkUnreducedY]);
    const addrUnreduced = poseidon.F.toObject(hashUnreduced) & MASK_160;

    const hashReduced = poseidon([pkReducedX, pkReducedY]);
    const addrReduced = poseidon.F.toObject(hashReduced) & MASK_160;

    console.log('Address from unreduced pk:', '0x' + addrUnreduced.toString(16).padStart(40, '0'));
    console.log('Address from reduced pk:  ', '0x' + addrReduced.toString(16).padStart(40, '0'));
    console.log('Addresses match?', addrUnreduced === addrReduced);
    console.log('');

    // Now try to generate a proof with the REDUCED sk to verify it works with the circuit
    console.log('--- Proof generation test with reduced sk ---');

    const pk = { x: pkReducedX, y: pkReducedY };
    const ownerAddress = addrReduced;

    // Compute viewing key
    const vkHash = poseidon.F.toObject(poseidon([pkReducedX, pkReducedY]));
    const viewingKey = '0x' + vkHash.toString(16).padStart(64, '0');
    const mask128 = (BigInt(1) << BigInt(128)) - BigInt(1);
    const vk1 = vkHash & mask128;
    const vk0 = vkHash >> BigInt(128);

    // Generate salt
    const salt = BigInt('0xdeadbeef');

    // Compute note hash
    const noteHash = poseidon.F.toObject(poseidon([
        ownerAddress,
        BigInt(1000),  // value
        BigInt(0),     // tokenType (ETH)
        vk0,
        vk1,
        salt
    ]));

    const inputs = {
        noteHash: noteHash.toString(),
        value: '1000',
        tokenType: '0',
        ownerAddress: ownerAddress.toString(),
        vk0: vk0.toString(),
        vk1: vk1.toString(),
        salt: salt.toString(),
        sk: skOverP.toString()  // Pass the ORIGINAL (unreduced) sk - circuit will reduce mod p
    };

    console.log('Circuit inputs:');
    console.log('  noteHash:', inputs.noteHash.substring(0, 20) + '...');
    console.log('  ownerAddress:', inputs.ownerAddress);
    console.log('  sk:', inputs.sk.substring(0, 20) + '...');
    console.log('  sk > p?', BigInt(inputs.sk) > BN128_FIELD_PRIME);
    console.log('');

    const wasmPath = path.join(__dirname, '../circuits-circom/build/mint_burn_note/mint_burn_note_js/mint_burn_note.wasm');
    const zkeyPath = path.join(__dirname, '../circuits-circom/build/mint_burn_note/mint_burn_note.zkey');

    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
        console.log('Circuit files not found, skipping proof generation test');
        return;
    }

    try {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            inputs,
            wasmPath,
            zkeyPath
        );
        console.log('✅ Proof generated successfully with reduced pk + unreduced sk input!');
        console.log('   (circuit auto-reduces sk mod p, and we derived pk from sk mod p)');
        console.log('   Public signals:', publicSignals);
    } catch (err) {
        console.log('❌ Proof generation FAILED:', err.message);
    }

    // Now test with UNREDUCED pk (simulating the bug)
    console.log('\n--- Proof generation test with UNREDUCED pk (simulating browser bug) ---');

    const buggyOwnerAddress = addrUnreduced;
    const buggyVkHash = poseidon.F.toObject(poseidon([pkUnreducedX, pkUnreducedY]));
    const buggyVk1 = buggyVkHash & mask128;
    const buggyVk0 = buggyVkHash >> BigInt(128);

    const buggyNoteHash = poseidon.F.toObject(poseidon([
        buggyOwnerAddress,
        BigInt(1000),
        BigInt(0),
        buggyVk0,
        buggyVk1,
        salt
    ]));

    const buggyInputs = {
        noteHash: buggyNoteHash.toString(),
        value: '1000',
        tokenType: '0',
        ownerAddress: buggyOwnerAddress.toString(),
        vk0: buggyVk0.toString(),
        vk1: buggyVk1.toString(),
        salt: salt.toString(),
        sk: skOverP.toString()
    };

    try {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            buggyInputs,
            wasmPath,
            zkeyPath
        );
        console.log('✅ Proof generated with unreduced pk (unexpected!)');
    } catch (err) {
        console.log('❌ Proof generation FAILED with unreduced pk (expected!):');
        console.log('   ', err.message.substring(0, 200));
    }

    // Test with sk < p (should always work regardless of fix)
    console.log('\n--- Proof generation test with sk < p (baseline) ---');

    const skSmall = BigInt('123456789');
    const pkSmall = babyJub.mulPointEscalar(babyJub.Base8, skSmall);
    const pkSmallX = F.toObject(pkSmall[0]);
    const pkSmallY = F.toObject(pkSmall[1]);
    const addrSmallHash = poseidon.F.toObject(poseidon([pkSmallX, pkSmallY]));
    const addrSmall = addrSmallHash & MASK_160;
    const vkSmall1 = addrSmallHash & mask128;
    const vkSmall0 = addrSmallHash >> BigInt(128);
    const noteHashSmall = poseidon.F.toObject(poseidon([addrSmall, BigInt(1000), BigInt(0), vkSmall0, vkSmall1, salt]));

    const smallInputs = {
        noteHash: noteHashSmall.toString(),
        value: '1000',
        tokenType: '0',
        ownerAddress: addrSmall.toString(),
        vk0: vkSmall0.toString(),
        vk1: vkSmall1.toString(),
        salt: salt.toString(),
        sk: skSmall.toString()
    };

    try {
        const { proof } = await snarkjs.groth16.fullProve(smallInputs, wasmPath, zkeyPath);
        console.log('✅ Proof generated with sk < p (baseline works as expected)');
    } catch (err) {
        console.log('❌ Proof generation FAILED with sk < p (unexpected!):');
        console.log('   ', err.message.substring(0, 200));
    }

    console.log('\n=== Summary ===');
    console.log('When sk > p:');
    console.log('  - Browser (old): mulPointEscalar(Base8, sk) ≠ circuit EscalarMulFix(sk mod p)');
    console.log('  - Browser (new): mulPointEscalar(Base8, sk % p) == circuit EscalarMulFix(sk mod p)');
    console.log('  - Fix: reduce sk mod p before scalar multiplication');
}

main().catch(console.error);
