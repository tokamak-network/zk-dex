/**
 * ZK-DEX Frontend Usage Examples
 *
 * This file demonstrates how to use the ZK-DEX proof generation library
 * in a frontend application. Each function shows a complete workflow
 * for common DEX operations.
 *
 * Prerequisites:
 * - Circuit files compiled and setup complete (run in circuits-circom/)
 * - npm packages installed: snarkjs, circomlibjs, ffjavascript, web3-utils
 *
 * For browser usage, you'll need to:
 * 1. Bundle this with webpack/vite (supports Node.js crypto polyfills)
 * 2. Load WASM files from circuits-circom/build/
 * 3. Load zkey files from circuits-circom/build/
 */

const noteProofHelper = require('../scripts/lib/noteProofHelper');
const { constants } = require('../scripts/lib/Note');
const crypto = require('crypto');

// Scaling factor for token values (18 decimals)
const SCALING_FACTOR = 10n ** 18n;

// Salt counter for deterministic salt generation in examples
let saltCounter = 1;
function generateSalt() {
    return '0x' + (saltCounter++).toString(16).padStart(64, '0');
}

/**
 * Initialize the library (call once at app startup)
 */
async function initialize() {
    await noteProofHelper.init();
    console.log('ZK-DEX library initialized');
}

// ============================================
// WALLET OPERATIONS
// ============================================

/**
 * Generate a new keypair for a user
 * Store the secret key securely (e.g., encrypted in browser storage)
 */
async function createNewWallet() {
    const keypair = await noteProofHelper.generateKeypair();

    return {
        // Secret key - KEEP THIS SECURE! Never expose to network
        secretKey: keypair.sk,

        // Public key - Safe to share, used as note owner
        publicKey: {
            x: keypair.pk.x,
            y: keypair.pk.y
        }
    };
}

/**
 * Derive public key from stored secret key
 * Use this when loading wallet from storage
 */
async function loadWallet(secretKey) {
    const publicKey = await noteProofHelper.derivePublicKey(secretKey);
    return {
        secretKey,
        publicKey
    };
}

// ============================================
// MINTING (DEPOSIT)
// ============================================

/**
 * Mint ETH into a private note
 *
 * @param wallet - User's wallet (secretKey required)
 * @param amountWei - Amount in wei (BigInt)
 * @returns {note, proof, encryptedNote} - Ready for contract call
 */
async function mintETH(wallet, amountWei, salt = null) {
    // Create a new note
    const { note, sk } = await noteProofHelper.createNote(
        wallet.secretKey,
        amountWei,
        constants.ETH_TOKEN_TYPE,
        '0x0',
        salt || generateSalt()
    );

    // Generate proof
    const proof = await noteProofHelper.generateMintProof(note, sk);

    // Encrypt note for on-chain storage
    const encryptedNote = '0x' + Buffer.from(note.toString()).toString('hex');

    return {
        note,
        noteHash: note.hash(),
        proof,
        encryptedNote,
        // Contract call data
        contractCall: {
            function: 'mint',
            args: [proof.a, proof.b, proof.c, proof.input, encryptedNote],
            value: amountWei.toString()
        }
    };
}

/**
 * Mint DAI (ERC20) into a private note
 * Requires prior approval: dai.approve(zkdex.address, amount)
 */
async function mintDAI(wallet, amountWei) {
    const { note, sk } = await noteProofHelper.createNote(
        wallet.secretKey,
        amountWei,
        constants.DAI_TOKEN_TYPE
    );

    const proof = await noteProofHelper.generateMintProof(note, sk);
    const encryptedNote = '0x' + Buffer.from(note.toString()).toString('hex');

    return {
        note,
        noteHash: note.hash(),
        proof,
        encryptedNote,
        contractCall: {
            function: 'mint',
            args: [proof.a, proof.b, proof.c, proof.input, encryptedNote],
            value: '0' // No ETH for ERC20 mint
        }
    };
}

// ============================================
// TRANSFERS
// ============================================

/**
 * Transfer value from one note to another user
 *
 * @param senderWallet - Sender's wallet
 * @param senderNote - Note to spend (must own)
 * @param recipientPublicKey - Recipient's public key {x, y}
 * @param amountWei - Amount to send (BigInt)
 * @param tokenType - ETH or DAI token type
 */
async function transfer(senderWallet, senderNote, recipientPublicKey, amountWei, tokenType) {
    const senderValue = BigInt(senderNote.value);
    const changeValue = senderValue - amountWei;

    if (changeValue < 0n) {
        throw new Error('Insufficient balance');
    }

    // Create note for recipient
    const { note: recipientNote } = await noteProofHelper.createNote(
        // For recipient note, we need to use their public key
        // This is a simplified example - in practice you'd construct the note differently
        recipientPublicKey.x, // This won't work directly - see note below
        amountWei,
        tokenType
    );

    // Note: For real recipient notes, you need to create a Note with their public key
    // The createNote function derives pk from sk, so for recipient notes you'd do:
    const { Note } = require('../scripts/lib/Note');
    const Web3Utils = require('web3-utils');
    const crypto = require('crypto');

    const recipientNoteReal = new Note(
        Web3Utils.padLeft(recipientPublicKey.x, 64),
        Web3Utils.padLeft(recipientPublicKey.y, 64),
        Web3Utils.padLeft(Web3Utils.toHex(amountWei), 64),
        tokenType,
        '0x0', // viewingKey
        '0x' + crypto.randomBytes(32).toString('hex') // random salt
    );

    // Create change note back to sender
    const { note: changeNote } = await noteProofHelper.createNote(
        senderWallet.secretKey,
        changeValue,
        tokenType
    );

    // Generate proof
    const proof = await noteProofHelper.generateTransferProof(
        senderNote,
        null, // Second input note (optional)
        recipientNoteReal,
        changeNote,
        senderWallet.secretKey,
        null
    );

    const encryptedRecipientNote = '0x' + Buffer.from(recipientNoteReal.toString()).toString('hex');
    const encryptedChangeNote = '0x' + Buffer.from(changeNote.toString()).toString('hex');

    return {
        recipientNote: recipientNoteReal,
        changeNote,
        proof,
        contractCall: {
            function: 'spend',
            args: [
                proof.a, proof.b, proof.c, proof.input,
                encryptedRecipientNote,
                encryptedChangeNote
            ]
        }
    };
}

// ============================================
// TRADING (DEX OPERATIONS)
// ============================================

/**
 * Create a limit order (maker)
 *
 * @param makerWallet - Maker's wallet
 * @param makerNote - Note to trade
 * @param targetTokenType - Token type you want to receive
 * @param price - Exchange rate (unscaled, e.g., 10 = "10 DAI per ETH")
 */
async function makeOrder(makerWallet, makerNote, targetTokenType, price) {
    const proof = await noteProofHelper.generateMakeOrderProof(
        makerNote,
        makerWallet.secretKey
    );

    return {
        makerNote,
        proof,
        contractCall: {
            function: 'makeOrder',
            args: [
                makerNote.viewingKey,
                targetTokenType,
                price.toString(),
                proof.a, proof.b, proof.c, proof.input
            ]
        }
    };
}

/**
 * Take an existing order (taker)
 *
 * @param takerWallet - Taker's wallet
 * @param takerNote - Taker's note to stake
 * @param makerNote - Maker's note (from order)
 */
async function takeOrder(takerWallet, takerNote, makerNote) {
    // Create stake note (smart note owned by maker note)
    // Stake value must equal taker's note value
    const stakeNote = noteProofHelper.createSmartNote(
        makerNote,
        BigInt(takerNote.value),
        takerNote.token
    );

    const proof = await noteProofHelper.generateTakeOrderProof(
        takerNote,
        stakeNote,
        takerWallet.secretKey
    );

    const encryptedStakeNote = '0x' + Buffer.from(stakeNote.toString()).toString('hex');

    return {
        stakeNote,
        proof,
        contractCall: {
            function: 'takeOrder',
            args: [
                'orderId', // Replace with actual order ID
                proof.a, proof.b, proof.c, proof.input,
                encryptedStakeNote
            ]
        }
    };
}

/**
 * Settle a matched order
 * Creates output notes for both maker and taker
 *
 * @param makerNote - Maker's original note
 * @param stakeNote - Taker's stake note
 * @param takerParentNote - Taker's parent note (for output ownership)
 * @param price - Order price
 * @param settlerWallet - Wallet of the settler (usually maker)
 */
async function settleOrder(makerNote, stakeNote, takerParentNote, price, settlerWallet) {
    const SCALING = 10n ** 18n;
    const makerValue = BigInt(makerNote.value);
    const stakeValue = BigInt(stakeNote.value);
    const priceValue = BigInt(price);

    // Calculate settlement amounts (same as circuit logic)
    const o1ValueOverPrice = stakeValue / priceValue;
    const o0ValuePrice = (makerValue * priceValue) / SCALING;

    // Determine direction
    const bit = makerValue >= o1ValueOverPrice ? 1n : 0n;

    let rewardValue, paymentValue, changeValue, rewardToken, changeToken;

    if (bit === 1n) {
        // Maker has more value
        rewardValue = o1ValueOverPrice;
        paymentValue = stakeValue;
        changeValue = makerValue - o1ValueOverPrice;
        rewardToken = makerNote.token; // ETH for taker
        changeToken = makerNote.token; // ETH change
    } else {
        // Taker has more value
        rewardValue = makerValue;
        paymentValue = o0ValuePrice;
        changeValue = stakeValue - o0ValuePrice;
        rewardToken = makerNote.token;
        changeToken = stakeNote.token; // DAI change
    }

    // Create output notes (all smart notes)
    const rewardNote = noteProofHelper.createSmartNote(
        takerParentNote,
        rewardValue,
        rewardToken
    );

    const paymentNote = noteProofHelper.createSmartNote(
        makerNote,
        paymentValue,
        stakeNote.token // DAI
    );

    const changeNote = noteProofHelper.createSmartNote(
        takerParentNote,
        changeValue,
        changeToken
    );

    const proof = await noteProofHelper.generateSettleOrderProof(
        makerNote,
        stakeNote,
        rewardNote,
        paymentNote,
        changeNote,
        priceValue,
        settlerWallet.secretKey
    );

    return {
        rewardNote,
        paymentNote,
        changeNote,
        proof,
        contractCall: {
            function: 'settleOrder',
            args: [
                'orderId', // Replace with actual order ID
                proof.a, proof.b, proof.c, proof.input,
                // Encrypted notes...
            ]
        }
    };
}

/**
 * Convert a smart note to a regular note
 * Used after receiving rewards from settled orders
 *
 * @param wallet - Owner's wallet
 * @param smartNote - Smart note to convert
 * @param originNote - Original note (whose hash is the smart note's owner)
 */
async function convertSmartNote(wallet, smartNote, originNote) {
    // Create new regular note with same value
    const { note: newNote } = await noteProofHelper.createNote(
        wallet.secretKey,
        BigInt(smartNote.value),
        smartNote.token
    );

    const proof = await noteProofHelper.generateConvertProof(
        smartNote,
        originNote,
        newNote,
        wallet.secretKey
    );

    const encryptedNote = '0x' + Buffer.from(newNote.toString()).toString('hex');

    return {
        newNote,
        proof,
        contractCall: {
            function: 'convertNote',
            args: [proof.a, proof.b, proof.c, proof.input, encryptedNote]
        }
    };
}

// ============================================
// WITHDRAWAL (LIQUIDATE)
// ============================================

/**
 * Withdraw (liquidate) a note back to regular ETH/tokens
 *
 * @param wallet - Note owner's wallet
 * @param note - Note to liquidate
 * @param recipientAddress - Ethereum address to receive funds
 */
async function liquidate(wallet, note, recipientAddress) {
    const proof = await noteProofHelper.generateMintProof(note, wallet.secretKey);

    return {
        proof,
        contractCall: {
            function: 'liquidate',
            args: [
                proof.a, proof.b, proof.c, proof.input,
                recipientAddress
            ]
        }
    };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Verify a proof locally before submitting to blockchain
 * Useful for catching errors early
 */
async function verifyProofLocally(circuitName, proof) {
    return await noteProofHelper.verifyProof(circuitName, proof, proof.input);
}

/**
 * Format token amount for display
 */
function formatTokenAmount(weiAmount, decimals = 18) {
    const value = BigInt(weiAmount);
    const divisor = 10n ** BigInt(decimals);
    const whole = value / divisor;
    const fraction = value % divisor;
    const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 4);
    return `${whole}.${fractionStr}`;
}

/**
 * Parse token amount from user input
 */
function parseTokenAmount(displayAmount, decimals = 18) {
    const [whole, fraction = '0'] = displayAmount.split('.');
    const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
    return BigInt(whole + paddedFraction);
}

// ============================================
// EXAMPLE USAGE
// ============================================

async function exampleWorkflow() {
    console.log('=== ZK-DEX Example Workflow ===\n');

    // 1. Initialize
    await initialize();

    // 2. Create wallet
    const wallet = await createNewWallet();
    console.log('Wallet created');
    console.log('  Public Key X:', wallet.publicKey.x.slice(0, 20) + '...');

    // 3. Mint 1 ETH
    const mintResult = await mintETH(wallet, SCALING_FACTOR);
    console.log('\nMint ETH:');
    console.log('  Note hash:', mintResult.noteHash.slice(0, 20) + '...');
    console.log('  Contract function:', mintResult.contractCall.function);

    // 4. Verify proof locally
    const isValid = await verifyProofLocally('mint_burn_note', mintResult.proof);
    console.log('  Proof valid:', isValid);

    // 5. Display formatted amount
    console.log('\nFormatted amounts:');
    console.log('  1 ETH =', formatTokenAmount(SCALING_FACTOR));
    console.log('  Parsed "1.5" =', parseTokenAmount('1.5').toString());

    console.log('\n=== Workflow Complete ===');
}

// Run example if executed directly
if (require.main === module) {
    exampleWorkflow().catch(console.error);
}

module.exports = {
    // Initialization
    initialize,

    // Wallet
    createNewWallet,
    loadWallet,

    // Minting
    mintETH,
    mintDAI,

    // Transfers
    transfer,

    // Trading
    makeOrder,
    takeOrder,
    settleOrder,
    convertSmartNote,

    // Withdrawal
    liquidate,

    // Utilities
    verifyProofLocally,
    formatTokenAmount,
    parseTokenAmount,

    // Constants
    SCALING_FACTOR,
    ETH_TOKEN_TYPE: constants.ETH_TOKEN_TYPE,
    DAI_TOKEN_TYPE: constants.DAI_TOKEN_TYPE
};
