const express = require('express');

const asyncWrap = require('../lib/asyncWrap.cjs');

// Use Circom-based proof generation
const noteProofHelper = require('../../scripts/lib/noteProofHelper');

const router = express.Router();

// Initialize noteProofHelper on startup
let initialized = false;
(async () => {
  try {
    await noteProofHelper.init();
    initialized = true;
    console.log('noteProofHelper initialized successfully');
  } catch (err) {
    console.error('Failed to initialize noteProofHelper:', err);
  }
})();

router.post('/', asyncWrap(
  async function (req, res) {
    if (!initialized) {
      throw new Error('Proof generator not initialized yet');
    }

    const circuit = req.body.circuit;
    const inputs = req.body.inputs || {};
    const params = inputs.params || req.body.params || [];

    let proof;

    switch (circuit) {
      case 'mintNBurnNote': {
        // params: [noteData, sk, publicKey]
        // noteData: { value, token, viewingKey, salt }
        // sk: secret key of the account
        // publicKey: { x, y } BabyJubJub public key of the account
        const [noteData, sk, publicKey] = params;

        if (!sk || !publicKey) {
          throw new Error('mintNBurnNote requires sk and publicKey params');
        }

        const { Note } = require('../../scripts/lib/Note');
        const Web3Utils = require('web3-utils');
        const crypto = require('crypto');

        // Generate salt if not provided (254-bit compatible)
        let salt = noteData.salt;
        if (!salt) {
          const saltBigInt = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
          const mask254 = (BigInt(1) << BigInt(254)) - BigInt(1);
          salt = '0x' + (saltBigInt & mask254).toString(16).padStart(64, '0');
        }

        // Create note with account's public key as owner
        const note = new Note(
          Web3Utils.padLeft(publicKey.x, 64),
          Web3Utils.padLeft(publicKey.y, 64),
          Web3Utils.padLeft(Web3Utils.toHex(noteData.value || '0'), 64),
          noteData.token === '0x1' ? 1 : 0,
          Web3Utils.padLeft(noteData.viewingKey || '0x0', 64),
          Web3Utils.padLeft(salt, 64)
        );

        // Generate proof
        const mintProof = await noteProofHelper.generateMintProof(note, sk);

        proof = {
          a: mintProof.a,
          b: mintProof.b,
          c: mintProof.c,
          input: mintProof.input,
          note: {
            owner0: note.owner0,
            owner1: note.owner1,
            value: note.value,
            token: note.token,
            viewingKey: note.viewingKey,
            salt: note.salt,
            hash: note.hash()
          }
        };
        break;
      }

      case 'transferNote': {
        // params: [oldNote, newNoteParams, changeNoteParams, sk, recipientPublicKey, senderPublicKey]
        // oldNote: the input note with owner0, owner1, value, token, viewingKey, salt
        // newNoteParams: { value, token } for recipient note
        // changeNoteParams: { value, token } for change note
        // sk: secret key of the old note owner
        // recipientPublicKey: { x, y } BabyJubJub public key of recipient
        // senderPublicKey: { x, y } BabyJubJub public key of sender (for change note)
        const [oldNoteData, newNoteParams, changeNoteParams, sk, recipientPublicKey, senderPublicKey] = params;

        if (!recipientPublicKey || !senderPublicKey) {
          throw new Error('transferNote requires recipientPublicKey and senderPublicKey params');
        }

        const { Note } = require('../../scripts/lib/Note');
        const Web3Utils = require('web3-utils');
        const crypto = require('crypto');

        // Ensure token is converted consistently (same as mint)
        const oldTokenValue = (oldNoteData.token === '0x1' || oldNoteData.token === 1 || oldNoteData.token === '1') ? 1 : 0;
        const oldNote0 = new Note(
          oldNoteData.owner0,
          oldNoteData.owner1,
          oldNoteData.value,
          oldTokenValue,
          oldNoteData.viewingKey || '0x0',
          oldNoteData.salt
        );

        // Generate salt for new note
        const newSaltBigInt = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
        const mask254 = (BigInt(1) << BigInt(254)) - BigInt(1);
        const newSalt = '0x' + (newSaltBigInt & mask254).toString(16).padStart(64, '0');

        // Create new note with recipient's public key
        const newNote = new Note(
          Web3Utils.padLeft(recipientPublicKey.x, 64),
          Web3Utils.padLeft(recipientPublicKey.y, 64),
          Web3Utils.padLeft(Web3Utils.toHex(newNoteParams.value || '0'), 64),
          newNoteParams.token === '0x1' ? 1 : 0,
          Web3Utils.padLeft('0x0', 64),
          Web3Utils.padLeft(newSalt, 64)
        );

        // Generate salt for change note
        const changeSaltBigInt = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
        const changeSalt = '0x' + (changeSaltBigInt & mask254).toString(16).padStart(64, '0');

        // Create change note with sender's public key
        const changeNote = new Note(
          Web3Utils.padLeft(senderPublicKey.x, 64),
          Web3Utils.padLeft(senderPublicKey.y, 64),
          Web3Utils.padLeft(Web3Utils.toHex(changeNoteParams.value || '0'), 64),
          changeNoteParams.token === '0x1' ? 1 : 0,
          Web3Utils.padLeft('0x0', 64),
          Web3Utils.padLeft(changeSalt, 64)
        );

        // Generate transfer proof
        const transferProof = await noteProofHelper.generateTransferProof(
          oldNote0, null, newNote, changeNote, sk, null
        );

        proof = {
          a: transferProof.a,
          b: transferProof.b,
          c: transferProof.c,
          input: transferProof.input,
          newNote: {
            owner0: newNote.owner0,
            owner1: newNote.owner1,
            value: newNote.value,
            token: newNote.token,
            viewingKey: newNote.viewingKey,
            salt: newNote.salt,
            hash: newNote.hash()
          },
          changeNote: {
            owner0: changeNote.owner0,
            owner1: changeNote.owner1,
            value: changeNote.value,
            token: changeNote.token,
            viewingKey: changeNote.viewingKey,
            salt: changeNote.salt,
            hash: changeNote.hash()
          }
        };
        break;
      }

      case 'burnNote': {
        // For liquidation - proves ownership of existing note
        // params: [noteData, sk]
        const [noteData, sk] = params;

        const { Note } = require('../../scripts/lib/Note');
        // Ensure token is converted consistently (same as mint)
        const tokenValue = (noteData.token === '0x1' || noteData.token === 1 || noteData.token === '1') ? 1 : 0;
        const note = new Note(
          noteData.owner0,
          noteData.owner1,
          noteData.value,
          tokenValue,
          noteData.viewingKey || '0x0',
          noteData.salt
        );

        // Generate burn proof using existing note and its secret key
        const burnProof = await noteProofHelper.generateMintProof(note, sk);

        proof = {
          a: burnProof.a,
          b: burnProof.b,
          c: burnProof.c,
          input: burnProof.input,
          note: {
            owner0: note.owner0,
            owner1: note.owner1,
            value: note.value,
            token: note.token,
            viewingKey: note.viewingKey,
            salt: note.salt,
            hash: note.hash()
          }
        };
        break;
      }

      case 'makeOrder': {
        // params: [noteData, sk]
        const [noteData, sk] = params;

        const { Note } = require('../../scripts/lib/Note');
        // Ensure token is converted consistently (same as mint)
        const tokenValue = (noteData.token === '0x1' || noteData.token === 1 || noteData.token === '1') ? 1 : 0;
        const makerNote = new Note(
          noteData.owner0,
          noteData.owner1,
          noteData.value,
          tokenValue,
          noteData.viewingKey || '0x0',
          noteData.salt
        );

        const makeOrderProof = await noteProofHelper.generateMakeOrderProof(makerNote, sk);
        proof = makeOrderProof;
        break;
      }

      case 'takeOrder': {
        // params: [parentNoteData, takerNoteData, stakeNoteParams, sk]
        // parentNoteData: the maker's note that we're taking from
        // takerNoteData: the taker's note (input)
        // stakeNoteParams: { value, token } for the stake note
        // sk: secret key of the taker note
        const [parentNoteData, takerNoteData, stakeNoteParams, sk] = params;

        const { Note } = require('../../scripts/lib/Note');

        // Ensure token is converted consistently (same as mint)
        const parentTokenValue = (parentNoteData.token === '0x1' || parentNoteData.token === 1 || parentNoteData.token === '1') ? 1 : 0;
        const takerTokenValue = (takerNoteData.token === '0x1' || takerNoteData.token === 1 || takerNoteData.token === '1') ? 1 : 0;

        // Reconstruct parent note (maker's note)
        const parentNote = new Note(
          parentNoteData.owner0,
          parentNoteData.owner1,
          parentNoteData.value,
          parentTokenValue,
          parentNoteData.viewingKey || '0x0',
          parentNoteData.salt
        );

        // Reconstruct taker's input note
        const takerNote = new Note(
          takerNoteData.owner0,
          takerNoteData.owner1,
          takerNoteData.value,
          takerTokenValue,
          takerNoteData.viewingKey || '0x0',
          takerNoteData.salt
        );

        // Create stake note (smart note owned by the parent note's hash)
        const stakeNote = noteProofHelper.createSmartNote(
          parentNote,
          BigInt(stakeNoteParams.value || '0'),
          stakeNoteParams.token === '0x1' ? 1 : 0,
          '0x0'
        );

        const takeOrderProof = await noteProofHelper.generateTakeOrderProof(parentNote, stakeNote, sk);

        proof = {
          a: takeOrderProof.a,
          b: takeOrderProof.b,
          c: takeOrderProof.c,
          input: takeOrderProof.input,
          stakeNote: {
            owner0: stakeNote.owner0,
            owner1: stakeNote.owner1,
            value: stakeNote.value,
            token: stakeNote.token,
            viewingKey: stakeNote.viewingKey,
            salt: stakeNote.salt,
            hash: stakeNote.hash()
          }
        };
        break;
      }

      case 'combineNotes': {
        // Combine two notes into one
        // params: [note0Data, note1Data, sk0, sk1, ownerPublicKey]
        // ownerPublicKey: { x, y } BabyJubJub public key of the owner
        const [note0Data, note1Data, sk0, sk1, ownerPublicKey] = params;

        if (!ownerPublicKey) {
          throw new Error('combineNotes requires ownerPublicKey param');
        }

        const { Note } = require('../../scripts/lib/Note');
        const Web3Utils = require('web3-utils');
        const crypto = require('crypto');

        // Ensure token is converted consistently (same as mint)
        const token0Value = (note0Data.token === '0x1' || note0Data.token === 1 || note0Data.token === '1') ? 1 : 0;
        const token1Value = note1Data ? ((note1Data.token === '0x1' || note1Data.token === 1 || note1Data.token === '1') ? 1 : 0) : 0;

        // Reconstruct input notes
        const oldNote0 = new Note(
          note0Data.owner0,
          note0Data.owner1,
          note0Data.value,
          token0Value,
          note0Data.viewingKey || '0x0',
          note0Data.salt
        );

        const oldNote1 = note1Data ? new Note(
          note1Data.owner0,
          note1Data.owner1,
          note1Data.value,
          token1Value,
          note1Data.viewingKey || '0x0',
          note1Data.salt
        ) : null;

        // Calculate combined value
        const combinedValue = BigInt(note0Data.value) + (note1Data ? BigInt(note1Data.value) : BigInt(0));

        // Generate salt for combined note
        const mask254 = (BigInt(1) << BigInt(254)) - BigInt(1);
        const combinedSaltBigInt = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
        const combinedSalt = '0x' + (combinedSaltBigInt & mask254).toString(16).padStart(64, '0');

        // Create combined note with owner's public key
        const combinedNote = new Note(
          Web3Utils.padLeft(ownerPublicKey.x, 64),
          Web3Utils.padLeft(ownerPublicKey.y, 64),
          Web3Utils.padLeft(Web3Utils.toHex(combinedValue.toString()), 64),
          note0Data.token === '0x1' ? 1 : 0,
          Web3Utils.padLeft('0x0', 64),
          Web3Utils.padLeft(combinedSalt, 64)
        );

        // Create zero-value change note (also owned by the same account)
        const zeroSaltBigInt = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
        const zeroSalt = '0x' + (zeroSaltBigInt & mask254).toString(16).padStart(64, '0');
        const zeroNote = new Note(
          Web3Utils.padLeft(ownerPublicKey.x, 64),
          Web3Utils.padLeft(ownerPublicKey.y, 64),
          Web3Utils.padLeft('0x0', 64),
          note0Data.token === '0x1' ? 1 : 0,
          Web3Utils.padLeft('0x0', 64),
          Web3Utils.padLeft(zeroSalt, 64)
        );

        // Generate transfer proof
        const combineProof = await noteProofHelper.generateTransferProof(
          oldNote0, oldNote1, combinedNote, zeroNote, sk0, sk1
        );

        proof = {
          a: combineProof.a,
          b: combineProof.b,
          c: combineProof.c,
          input: combineProof.input,
          combinedNote: {
            owner0: combinedNote.owner0,
            owner1: combinedNote.owner1,
            value: combinedNote.value,
            token: combinedNote.token,
            viewingKey: combinedNote.viewingKey,
            salt: combinedNote.salt,
            hash: combinedNote.hash()
          }
        };
        break;
      }

      case 'convertNote': {
        // Convert a smart note back to a regular note
        // params: [smartNoteData, originNoteData, sk, ownerPublicKey]
        // smartNoteData: The smart note to convert (isSmart = 1)
        // originNoteData: The origin note whose hash is the smart note's owner
        // sk: Secret key of the origin note
        // ownerPublicKey: { x, y } BabyJubJub public key for the new note
        const [smartNoteData, originNoteData, sk, ownerPublicKey] = params;

        if (!ownerPublicKey) {
          throw new Error('convertNote requires ownerPublicKey param');
        }

        const { Note } = require('../../scripts/lib/Note');
        const Web3Utils = require('web3-utils');
        const crypto = require('crypto');

        // Ensure token is converted consistently (same as mint)
        const smartTokenValue = (smartNoteData.token === '0x1' || smartNoteData.token === 1 || smartNoteData.token === '1') ? 1 : 0;
        const originTokenValue = (originNoteData.token === '0x1' || originNoteData.token === 1 || originNoteData.token === '1') ? 1 : 0;

        // Reconstruct smart note
        const smartNote = new Note(
          smartNoteData.owner0,
          smartNoteData.owner1,
          smartNoteData.value,
          smartTokenValue,
          smartNoteData.viewingKey || '0x0',
          smartNoteData.salt
        );

        // Reconstruct origin note
        const originNote = new Note(
          originNoteData.owner0,
          originNoteData.owner1,
          originNoteData.value,
          originTokenValue,
          originNoteData.viewingKey || '0x0',
          originNoteData.salt
        );

        // Generate salt for new note
        const mask254 = (BigInt(1) << BigInt(254)) - BigInt(1);
        const newSaltBigInt = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
        const newSalt = '0x' + (newSaltBigInt & mask254).toString(16).padStart(64, '0');

        // Create new regular note with owner's public key
        const newNote = new Note(
          Web3Utils.padLeft(ownerPublicKey.x, 64),
          Web3Utils.padLeft(ownerPublicKey.y, 64),
          Web3Utils.padLeft(Web3Utils.toHex(smartNoteData.value || '0'), 64),
          smartNoteData.token === '0x1' ? 1 : 0,
          Web3Utils.padLeft('0x0', 64),
          Web3Utils.padLeft(newSalt, 64)
        );

        // Generate convert proof
        const convertProof = await noteProofHelper.generateConvertProof(smartNote, originNote, newNote, sk);

        proof = {
          a: convertProof.a,
          b: convertProof.b,
          c: convertProof.c,
          input: convertProof.input,
          newNote: {
            owner0: newNote.owner0,
            owner1: newNote.owner1,
            value: newNote.value,
            token: newNote.token,
            viewingKey: newNote.viewingKey,
            salt: newNote.salt,
            hash: newNote.hash()
          }
        };
        break;
      }

      case 'settleOrder': {
        const [makerNote, takerStakeNote, rewardNote, paymentNote, changeNote, price, sk] = params;
        const settleProof = await noteProofHelper.generateSettleOrderProof(
          makerNote, takerStakeNote, rewardNote, paymentNote, changeNote, price, sk
        );
        proof = settleProof;
        break;
      }

      default:
        throw new Error('Unknown circuit: ' + circuit);
    }

    return res.status(200).json({
      proof,
    });
  }
));

module.exports = router;
