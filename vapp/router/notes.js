const express = require('express');
const Web3Utils = require('web3-utils');

const asyncWrap = require('../lib/asyncWrap');

const {
  getNotes,
  getTransferNotes,
  addNote,
  addTransferNote,
  updateNote,
  TransferHistory,
} = require('../localstorage');


const router = express.Router();

router.get('/:userKey', asyncWrap(
  async function (req, res) {
    const userKey = req.params.userKey;
    const notes = getNotes(userKey);
    return res.status(200).json({
      notes,
    });
  }
));

router.get('/transfer/histories/:account', asyncWrap(
  async function (req, res) {
    const account = req.params.account;
    const noteTransferHistories = TransferHistory.getHistoriesByUser(account);

    return res.status(200).json({
      noteTransferHistories,
    });
  }
));

router.post('/', asyncWrap(
  async function (req, res) {
    const account = req.body.account;
    const note = req.body.note;
    addNote(account, note);
    return res.status(200).json({
      note,
    });
  }
));

router.post('/transfer/histories', asyncWrap(
  async function (req, res) {
    const notes = req.body.notes;

    const originalNote = notes.originalNote;
    const paymentNote = notes.paymentNote;
    const changeNote = notes.changeNote;

    const sender = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(originalNote.owner)), 40);

    const noteTransferHistory = {
      token: originalNote.token,
      value: originalNote.value,
      from: originalNote.owner,
      to: paymentNote.owner,
      change: changeNote.value,
    };

    new TransferHistory(originalNote, paymentNote, changeNote).addHistoryByUser(sender, noteTransferHistory);
    return res.status(200).json({});
  }
));

router.put('/', asyncWrap(
  async function (req, res) {
    const account = req.body.account;
    const note = req.body.note;
    updateNote(account, note);
    return res.status(200).json({
      note,
    });
  }
));


module.exports = router;
