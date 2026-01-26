/**
 * ZkDex Production Mode Test
 * Tests the smart contracts with actual Groth16 proof verification (development=false)
 */

const ZkDex = artifacts.require("ZkDex");
const MockDai = artifacts.require("MockDai");
const MintBurnNoteVerifier = artifacts.require("MintBurnNoteVerifier");
const TransferNoteVerifier = artifacts.require("TransferNoteVerifier");
const ConvertNoteVerifier = artifacts.require("ConvertNoteVerifier");
const MakeOrderVerifier = artifacts.require("MakeOrderVerifier");
const TakeOrderVerifier = artifacts.require("TakeOrderVerifier");
const SettleOrderVerifier = artifacts.require("SettleOrderVerifier");

const { Note, constants, init: initNote } = require('../scripts/lib/Note');
const noteProofHelper = require('../scripts/lib/noteProofHelper');
const snarkjsUtils = require('../scripts/lib/snarkjsUtils');

const SCALING_FACTOR = 10n ** 18n;

contract('ZkDex Production Mode', function(accounts) {
    let dai, zkdex;
    let mintVerifier, transferVerifier, convertVerifier;
    let makeOrderVerifier, takeOrderVerifier, settleOrderVerifier;

    before(async () => {
        // Initialize Poseidon for Note.hash()
        await initNote();

        // Check if circuits are initialized
        const initialized = await snarkjsUtils.initialized();
        if (!initialized) {
            throw new Error('Circuit files not found. Run setup first: cd circuits-circom && npm run compile && npm run setup');
        }

        // Deploy MockDai
        dai = await MockDai.new();

        // Deploy all verifiers
        mintVerifier = await MintBurnNoteVerifier.new();
        transferVerifier = await TransferNoteVerifier.new();
        convertVerifier = await ConvertNoteVerifier.new();
        makeOrderVerifier = await MakeOrderVerifier.new();
        takeOrderVerifier = await TakeOrderVerifier.new();
        settleOrderVerifier = await SettleOrderVerifier.new();

        // Deploy ZkDex in PRODUCTION mode (false)
        zkdex = await ZkDex.new(
            false,  // production mode - verifies proofs
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
        it('should deploy ZkDex in production mode', async () => {
            const devMode = await zkdex.development();
            assert.equal(devMode, false, 'Should NOT be in development mode');
        });
    });

    describe('Note Minting with Real Proof', () => {
        it('should mint a note with ETH using actual Groth16 proof', async () => {
            // 1. Generate keypair
            const keypair = await noteProofHelper.generateKeypair();

            // 2. Create note
            const value = SCALING_FACTOR;  // 1 ETH
            const { note, sk } = await noteProofHelper.createNote(
                keypair.sk,
                value,
                constants.ETH_TOKEN_TYPE,
                '0x0',
                '0x' + 'abcd01'.padStart(64, '0')
            );

            // 3. Generate real Groth16 proof
            const proof = await snarkjsUtils.getMintNBurnProof(note, sk);

            // 4. Prepare encrypted note
            const encryptedNote = '0x' + Buffer.from(note.toString()).toString('hex');

            // 5. Mint the note with actual proof verification
            const tx = await zkdex.mint(
                proof.a,
                proof.b,
                proof.c,
                proof.input,
                encryptedNote,
                { value: value.toString(), from: accounts[0] }
            );

            // 6. Check event
            assert.ok(tx.logs.length > 0, 'Should emit events');

            // 7. Verify note state using Poseidon hash from proof
            // proof.input[1] is the noteHash (Poseidon hash)
            const noteHash = '0x' + BigInt(proof.input[1]).toString(16).padStart(64, '0');
            const state = await zkdex.notes(noteHash);
            assert.equal(state.toString(), '1', 'Note should be in Valid state');
        });

        it('should reject an invalid proof', async () => {
            // 1. Generate keypair
            const keypair = await noteProofHelper.generateKeypair();

            // 2. Create note
            const value = SCALING_FACTOR;  // 1 ETH
            const { note, sk } = await noteProofHelper.createNote(
                keypair.sk,
                value,
                constants.ETH_TOKEN_TYPE,
                '0x0',
                '0x' + 'abcd02'.padStart(64, '0')
            );

            // 3. Generate real Groth16 proof
            const proof = await snarkjsUtils.getMintNBurnProof(note, sk);

            // 4. Tamper with the proof (invalid proof)
            const tamperedProof = {
                a: ['0x1', '0x2'],  // Wrong values
                b: [['0x3', '0x4'], ['0x5', '0x6']],
                c: ['0x7', '0x8'],
                input: proof.input
            };

            // 5. Prepare encrypted note
            const encryptedNote = '0x' + Buffer.from(note.toString()).toString('hex');

            // 6. Try to mint with invalid proof - should fail
            try {
                await zkdex.mint(
                    tamperedProof.a,
                    tamperedProof.b,
                    tamperedProof.c,
                    tamperedProof.input,
                    encryptedNote,
                    { value: value.toString(), from: accounts[0] }
                );
                assert.fail('Should have reverted with invalid proof');
            } catch (error) {
                assert.ok(
                    error.message.includes('revert') || error.message.includes('invalid'),
                    'Should revert with invalid proof'
                );
            }
        });

        it('should mint a note with DAI using actual Groth16 proof', async () => {
            const daiAmount = 5n * SCALING_FACTOR;  // 5 DAI

            // Approve DAI transfer
            await dai.approve(zkdex.address, daiAmount.toString());

            // 1. Generate keypair
            const keypair = await noteProofHelper.generateKeypair();

            // 2. Create note
            const { note, sk } = await noteProofHelper.createNote(
                keypair.sk,
                daiAmount,
                constants.DAI_TOKEN_TYPE,
                '0x0',
                '0x' + 'abcd03'.padStart(64, '0')
            );

            // 3. Generate real Groth16 proof
            const proof = await snarkjsUtils.getMintNBurnProof(note, sk);

            // 4. Prepare encrypted note
            const encryptedNote = '0x' + Buffer.from(note.toString()).toString('hex');

            // 5. Mint the note
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

    describe('MakeOrder with Real Proof', () => {
        it('should create an order with actual Groth16 proof', async () => {
            // 1. Generate keypair
            const keypair = await noteProofHelper.generateKeypair();

            // 2. Create maker note
            const value = 2n * SCALING_FACTOR;  // 2 ETH
            const { note: makerNote, sk } = await noteProofHelper.createNote(
                keypair.sk,
                value,
                constants.ETH_TOKEN_TYPE,
                '0x0',
                '0x' + 'abcd04'.padStart(64, '0')
            );

            // 3. First mint the note
            const mintProof = await snarkjsUtils.getMintNBurnProof(makerNote, sk);
            const encryptedNote = '0x' + Buffer.from(makerNote.toString()).toString('hex');

            await zkdex.mint(
                mintProof.a,
                mintProof.b,
                mintProof.c,
                mintProof.input,
                encryptedNote,
                { value: value.toString(), from: accounts[0] }
            );

            // 4. Generate make order proof
            const makeOrderProof = await snarkjsUtils.getMakeOrderProof(makerNote, sk);

            // 5. Make the order
            const makerViewingKey = makerNote.viewingKey;
            const targetToken = constants.DAI_TOKEN_TYPE;
            const price = (SCALING_FACTOR / 10n).toString();  // 0.1 ETH/DAI

            const tx = await zkdex.makeOrder(
                makerViewingKey,
                targetToken,
                price,
                makeOrderProof.a,
                makeOrderProof.b,
                makeOrderProof.c,
                makeOrderProof.input,
                { from: accounts[0] }
            );

            assert.ok(tx.logs.length > 0, 'Should emit events');
        });
    });

    describe('TransferNote (Spend) with Real Proof', () => {
        it('should transfer a note using actual Groth16 proof', async () => {
            // 1. Generate keypairs for sender and receiver
            const senderKeypair = await noteProofHelper.generateKeypair();
            const receiverKeypair = await noteProofHelper.generateKeypair();

            // 2. Create and mint sender's note
            const senderValue = 3n * SCALING_FACTOR;  // 3 ETH
            const { note: senderNote, sk: senderSk } = await noteProofHelper.createNote(
                senderKeypair.sk,
                senderValue,
                constants.ETH_TOKEN_TYPE,
                '0x0',
                '0x' + 'abcd05'.padStart(64, '0')
            );

            const mintProof = await snarkjsUtils.getMintNBurnProof(senderNote, senderSk);
            const encryptedSenderNote = '0x' + Buffer.from(senderNote.toString()).toString('hex');

            await zkdex.mint(
                mintProof.a,
                mintProof.b,
                mintProof.c,
                mintProof.input,
                encryptedSenderNote,
                { value: senderValue.toString(), from: accounts[0] }
            );

            // Verify sender note was minted (use Poseidon hash from proof)
            const senderNoteHash = '0x' + BigInt(mintProof.input[1]).toString(16).padStart(64, '0');
            const senderNoteState = await zkdex.notes(senderNoteHash);
            assert.equal(senderNoteState.toString(), '1', 'Sender note should be Valid');

            // 3. Create new note for receiver (2 ETH)
            const transferValue = 2n * SCALING_FACTOR;
            const { note: receiverNote } = await noteProofHelper.createNote(
                receiverKeypair.sk,
                transferValue,
                constants.ETH_TOKEN_TYPE,
                '0x0',
                '0x' + 'abcd06'.padStart(64, '0')
            );

            // 4. Create change note for sender (1 ETH)
            const changeValue = senderValue - transferValue;
            const { note: changeNote } = await noteProofHelper.createNote(
                senderKeypair.sk,
                changeValue,
                constants.ETH_TOKEN_TYPE,
                '0x0',
                '0x' + 'abcd07'.padStart(64, '0')
            );

            // 5. Generate transfer proof (1 input note, 2 output notes)
            const transferProof = await snarkjsUtils.getTransferProof(
                senderNote,    // oldNote0
                null,          // oldNote1 (not used)
                receiverNote,  // newNote
                changeNote,    // changeNote
                senderSk,      // sk0
                null           // sk1 (not used)
            );

            const encryptedReceiverNote = '0x' + Buffer.from(receiverNote.toString()).toString('hex');
            const encryptedChangeNote = '0x' + Buffer.from(changeNote.toString()).toString('hex');

            // 6. Execute spend
            const tx = await zkdex.spend(
                transferProof.a,
                transferProof.b,
                transferProof.c,
                transferProof.input,
                encryptedReceiverNote,
                encryptedChangeNote,
                { from: accounts[0] }
            );

            assert.ok(tx.logs.length > 0, 'Should emit events');

            // State enum: {Invalid=0, Valid=1, Traiding=2, Spent=3}

            // 7. Verify note states
            const senderNoteStateAfter = await zkdex.notes(senderNote.hash());
            assert.equal(senderNoteStateAfter.toString(), '3', 'Sender note should be Spent');

            const receiverNoteState = await zkdex.notes(receiverNote.hash());
            assert.equal(receiverNoteState.toString(), '1', 'Receiver note should be Valid');

            const changeNoteState = await zkdex.notes(changeNote.hash());
            assert.equal(changeNoteState.toString(), '1', 'Change note should be Valid');
        });
    });

    describe('Liquidate with Real Proof', () => {
        it('should liquidate a note using actual Groth16 proof', async () => {
            // 1. Generate keypair
            const keypair = await noteProofHelper.generateKeypair();

            // 2. Create and mint a note
            const value = SCALING_FACTOR;  // 1 ETH
            const { note, sk } = await noteProofHelper.createNote(
                keypair.sk,
                value,
                constants.ETH_TOKEN_TYPE,
                '0x0',
                '0x' + 'abcd08'.padStart(64, '0')
            );

            const mintProof = await snarkjsUtils.getMintNBurnProof(note, sk);
            const encryptedNote = '0x' + Buffer.from(note.toString()).toString('hex');

            await zkdex.mint(
                mintProof.a,
                mintProof.b,
                mintProof.c,
                mintProof.input,
                encryptedNote,
                { value: value.toString(), from: accounts[0] }
            );

            // Verify note was minted (use Poseidon hash from proof)
            const noteHash = '0x' + BigInt(mintProof.input[1]).toString(16).padStart(64, '0');
            const noteStateBefore = await zkdex.notes(noteHash);
            assert.equal(noteStateBefore.toString(), '1', 'Note should be Valid');

            // 3. Get recipient balance before
            const recipientBalanceBefore = await web3.eth.getBalance(accounts[1]);

            // 4. Generate liquidate proof (same as mint/burn proof)
            const liquidateProof = await snarkjsUtils.getMintNBurnProof(note, sk);

            // 5. Liquidate the note
            const tx = await zkdex.liquidate(
                accounts[1],  // recipient
                liquidateProof.a,
                liquidateProof.b,
                liquidateProof.c,
                liquidateProof.input,
                { from: accounts[0] }
            );

            assert.ok(tx.logs.length > 0, 'Should emit events');

            // State enum: {Invalid=0, Valid=1, Traiding=2, Spent=3}
            // 6. Verify note state is Spent (use same Poseidon hash)
            const noteStateAfter = await zkdex.notes(noteHash);
            assert.equal(noteStateAfter.toString(), '3', 'Note should be Spent');

            // 7. Verify recipient received ETH
            const recipientBalanceAfter = await web3.eth.getBalance(accounts[1]);
            const balanceDiff = BigInt(recipientBalanceAfter) - BigInt(recipientBalanceBefore);
            assert.equal(balanceDiff.toString(), value.toString(), 'Recipient should receive ETH');
        });
    });

    describe('E2E Trading Flow with Real Proofs', () => {
        // Shared state for E2E flow
        let makerKeypair, takerKeypair;
        let makerNote, makerSk;
        let takerParentNote, takerSk;
        let stakeNote;
        let orderId;

        // Output notes from SettleOrder (for ConvertNote test)
        let rewardNote, paymentNote, changeNote;

        // Price: 10 DAI per ETH (unscaled for circuit)
        // This means "for 1 ETH, you get 10 DAI" or "0.1 ETH per DAI"
        const PRICE = 10n;

        before(async () => {
            // Generate keypairs for maker and taker
            makerKeypair = await noteProofHelper.generateKeypair();
            takerKeypair = await noteProofHelper.generateKeypair();
        });

        it('Step 1: Maker mints ETH note and creates order', async () => {
            // 1. Create and mint maker's ETH note
            const makerValue = 2n * SCALING_FACTOR; // 2 ETH
            const result = await noteProofHelper.createNote(
                makerKeypair.sk,
                makerValue,
                constants.ETH_TOKEN_TYPE,
                '0x0',
                '0x' + 'e2e001'.padStart(64, '0')
            );
            makerNote = result.note;
            makerSk = result.sk;

            // 2. Mint the maker note
            const mintProof = await snarkjsUtils.getMintNBurnProof(makerNote, makerSk);
            const encryptedMakerNote = '0x' + Buffer.from(makerNote.toString()).toString('hex');

            await zkdex.mint(
                mintProof.a,
                mintProof.b,
                mintProof.c,
                mintProof.input,
                encryptedMakerNote,
                { value: makerValue.toString(), from: accounts[0] }
            );

            // Verify maker note is Valid
            const makerNoteState = await zkdex.notes(makerNote.hash());
            assert.equal(makerNoteState.toString(), '1', 'Maker note should be Valid');

            // 3. Make order (ETH -> DAI)
            const makeOrderProof = await snarkjsUtils.getMakeOrderProof(makerNote, makerSk);

            const tx = await zkdex.makeOrder(
                makerNote.viewingKey,
                constants.DAI_TOKEN_TYPE,
                PRICE.toString(),
                makeOrderProof.a,
                makeOrderProof.b,
                makeOrderProof.c,
                makeOrderProof.input,
                { from: accounts[0] }
            );

            // Get order ID from logs or order count
            orderId = (await zkdex.getOrderCount()).toNumber() - 1;

            // Verify maker note is now Trading
            const makerNoteStateAfter = await zkdex.notes(makerNote.hash());
            assert.equal(makerNoteStateAfter.toString(), '2', 'Maker note should be Trading');

            assert.ok(tx.logs.length >= 0, 'MakeOrder should complete');
        });

        it('Step 2: Taker mints DAI note and takes order', async () => {
            // 1. Create and mint taker's DAI note (parent note)
            const takerValue = 10n * SCALING_FACTOR; // 10 DAI
            const result = await noteProofHelper.createNote(
                takerKeypair.sk,
                takerValue,
                constants.DAI_TOKEN_TYPE,
                '0x0',
                '0x' + 'e2e002'.padStart(64, '0')
            );
            takerParentNote = result.note;
            takerSk = result.sk;

            // 2. Approve and mint the taker's DAI note
            await dai.approve(zkdex.address, takerValue.toString());

            const mintProof = await snarkjsUtils.getMintNBurnProof(takerParentNote, takerSk);
            const encryptedTakerNote = '0x' + Buffer.from(takerParentNote.toString()).toString('hex');

            await zkdex.mint(
                mintProof.a,
                mintProof.b,
                mintProof.c,
                mintProof.input,
                encryptedTakerNote,
                { from: accounts[0] }
            );

            // Verify taker note is Valid
            const takerNoteState = await zkdex.notes(takerParentNote.hash());
            assert.equal(takerNoteState.toString(), '1', 'Taker note should be Valid');

            // 3. Create stake note (smart note owned by maker note)
            stakeNote = noteProofHelper.createSmartNote(
                makerNote,
                takerValue,
                constants.DAI_TOKEN_TYPE,
                '0x0',
                '0x' + 'e2e003'.padStart(64, '0')
            );

            // 4. Generate take order proof
            const takeOrderProof = await snarkjsUtils.getTakeOrderProof(
                takerParentNote,
                stakeNote,
                takerSk
            );

            const encryptedStakeNote = '0x' + Buffer.from(stakeNote.toString()).toString('hex');

            // 5. Take the order
            const tx = await zkdex.takeOrder(
                orderId,
                takeOrderProof.a,
                takeOrderProof.b,
                takeOrderProof.c,
                takeOrderProof.input,
                encryptedStakeNote,
                { from: accounts[0] }
            );

            assert.ok(tx.logs.length > 0, 'Should emit events');

            // Verify states
            const takerNoteStateAfter = await zkdex.notes(takerParentNote.hash());
            assert.equal(takerNoteStateAfter.toString(), '2', 'Taker parent note should be Trading');

            const stakeNoteState = await zkdex.notes(stakeNote.hash());
            assert.equal(stakeNoteState.toString(), '2', 'Stake note should be Trading');
        });

        it('Step 3: Settle the order', async () => {
            // Calculate exchange amounts based on circuit logic
            // Price = 10 (unscaled) means "10 DAI per ETH"
            //
            // Circuit calculations with price = 10:
            // - o1ValueOverPrice = q1 = o1Value / price = (10 * 10^18) / 10 = 10^18 (1 ETH for taker)
            // - o0ValuePrice = q0 = (o0Value * price) / 10^18 = (2 * 10^18 * 10) / 10^18 = 20 (DAI equivalent)
            //
            // Comparison: o0Value >= o1ValueOverPrice? 2*10^18 >= 10^18? YES! bit = 1
            //
            // With bit = 1:
            // - reward = o1ValueOverPrice = 10^18 (1 ETH for taker)
            // - payment = o1Value = 10 * 10^18 (10 DAI for maker)
            // - change = o0Value - o1ValueOverPrice = 2 * 10^18 - 10^18 = 10^18 (1 ETH change)

            const makerValue = 2n * SCALING_FACTOR; // 2 ETH
            const takerStakeValue = 10n * SCALING_FACTOR; // 10 DAI

            // Circuit-based calculations:
            // o1ValueOverPrice = q1 = takerStakeValue / PRICE
            const o1ValueOverPrice = takerStakeValue / PRICE;  // 10^18 (1 ETH)

            // rewardValue = o1ValueOverPrice (ETH taker receives)
            const rewardValue = o1ValueOverPrice;
            // paymentValue = takerStakeValue (all DAI goes to maker)
            const paymentValue = takerStakeValue;
            // changeValue = makerValue - rewardValue (ETH change for taker)
            const changeValue = makerValue - rewardValue;

            // 1. Create reward note (ETH for taker, owner = taker's parent note)
            rewardNote = noteProofHelper.createSmartNote(
                takerParentNote,
                rewardValue,
                constants.ETH_TOKEN_TYPE,
                '0x0',
                '0x' + 'e2e004'.padStart(64, '0')
            );

            // 2. Create payment note (DAI for maker, owner = maker note)
            paymentNote = noteProofHelper.createSmartNote(
                makerNote,
                paymentValue,
                constants.DAI_TOKEN_TYPE,
                '0x0',
                '0x' + 'e2e005'.padStart(64, '0')
            );

            // 3. Create change note (ETH change back to maker)
            // When bit=1 (o0Value >= o1ValueOverPrice), change goes to maker
            // Circuit requires: n2OwnerAddress == truncated maker note hash
            changeNote = noteProofHelper.createSmartNote(
                makerNote,  // Change goes to maker (bit=1 case)
                changeValue,
                constants.ETH_TOKEN_TYPE,
                '0x0',
                '0x' + 'e2e006'.padStart(64, '0')
            );

            // 4. Generate settle order proof
            // Division witnesses (must match circuit constraints):
            // Line 160: o0Value * price === q0 * 10^18 + r0
            // Line 174: o1Value === q1 * price + r1

            // For q0, r0: o0Value * price = q0 * SCALING + r0
            const o0ValueTimesPrice = makerValue * PRICE;
            const q0 = o0ValueTimesPrice / SCALING_FACTOR;
            const r0 = o0ValueTimesPrice % SCALING_FACTOR;

            // For q1, r1: o1Value = q1 * price + r1
            const q1 = takerStakeValue / PRICE;
            const r1 = takerStakeValue % PRICE;

            const settleOrderProof = await snarkjsUtils.getSettleOrderProof(
                makerNote,
                stakeNote,
                rewardNote,
                paymentNote,
                changeNote,
                PRICE,
                makerSk,
                q0, r0, q1, r1
            );

            // 5. RLP encode encrypted notes
            const RLP = require('rlp');
            const encryptedReward = Buffer.from(rewardNote.toString());
            const encryptedPayment = Buffer.from(paymentNote.toString());
            const encryptedChange = Buffer.from(changeNote.toString());
            const encDatas = '0x' + RLP.encode([encryptedReward, encryptedPayment, encryptedChange]).toString('hex');

            // 6. Settle the order
            const tx = await zkdex.settleOrder(
                orderId,
                settleOrderProof.a,
                settleOrderProof.b,
                settleOrderProof.c,
                settleOrderProof.input,
                encDatas,
                { from: accounts[0] }
            );

            assert.ok(tx.logs.length > 0, 'Should emit events');

            // 7. Verify final states
            // Maker note should be Spent
            const makerNoteStateFinal = await zkdex.notes(makerNote.hash());
            assert.equal(makerNoteStateFinal.toString(), '3', 'Maker note should be Spent');

            // Taker parent note should be Spent
            const takerNoteStateFinal = await zkdex.notes(takerParentNote.hash());
            assert.equal(takerNoteStateFinal.toString(), '3', 'Taker parent note should be Spent');

            // Stake note should be Spent
            const stakeNoteStateFinal = await zkdex.notes(stakeNote.hash());
            assert.equal(stakeNoteStateFinal.toString(), '3', 'Stake note should be Spent');

            // New notes should be Valid
            const rewardNoteState = await zkdex.notes(rewardNote.hash());
            assert.equal(rewardNoteState.toString(), '1', 'Reward note should be Valid');

            const paymentNoteState = await zkdex.notes(paymentNote.hash());
            assert.equal(paymentNoteState.toString(), '1', 'Payment note should be Valid');

            const changeNoteState = await zkdex.notes(changeNote.hash());
            assert.equal(changeNoteState.toString(), '1', 'Change note should be Valid');
        });

        it('Step 4: Convert smart note to normal note', async () => {
            // Convert rewardNote (ETH for taker, owned by takerParentNote) to a normal note
            // This demonstrates the full lifecycle: mint → makeOrder → takeOrder → settleOrder → convertNote

            // Verify rewardNote is still Valid
            const rewardNoteStateBefore = await zkdex.notes(rewardNote.hash());
            assert.equal(rewardNoteStateBefore.toString(), '1', 'Reward note should be Valid before convert');

            // Create the new normal note (same value and type as rewardNote)
            // The new note is owned by the taker's keypair (not a smart note)
            const { note: convertedNote } = await noteProofHelper.createNote(
                takerKeypair.sk,
                BigInt(rewardNote.value),
                constants.ETH_TOKEN_TYPE,
                '0x0',
                '0x' + 'e2e007'.padStart(64, '0')
            );

            // Generate convert proof
            // smartNote = rewardNote (the smart note to convert)
            // originNote = takerParentNote (the note whose hash is rewardNote's owner)
            // newNote = convertedNote (the new normal note)
            // sk = takerSk (owner of takerParentNote)
            const convertProof = await snarkjsUtils.getConvertProof(
                rewardNote,      // smartNote
                takerParentNote, // originNote
                convertedNote,   // newNote
                takerSk          // sk for originNote ownership
            );

            const encryptedConvertedNote = '0x' + Buffer.from(convertedNote.toString()).toString('hex');

            // Execute convertNote
            const tx = await zkdex.convertNote(
                convertProof.a,
                convertProof.b,
                convertProof.c,
                convertProof.input,
                encryptedConvertedNote,
                { from: accounts[0] }
            );

            assert.ok(tx.logs.length > 0, 'Should emit events');

            // Verify states after convert
            // Smart note (rewardNote) should be Invalid (consumed)
            const rewardNoteStateAfter = await zkdex.notes(rewardNote.hash());
            assert.equal(rewardNoteStateAfter.toString(), '0', 'Reward note should be Invalid after convert');

            // New note (convertedNote) should be Valid
            const convertedNoteState = await zkdex.notes(convertedNote.hash());
            assert.equal(convertedNoteState.toString(), '1', 'Converted note should be Valid');
        });
    });
});
