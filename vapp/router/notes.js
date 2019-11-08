const express = require('express');
const asyncWrap = require('../lib/asyncWrap');
const localStorage = require('../localstorage');
const Web3Utils = require('web3-utils');

// getNoteByNoteHash,
//   getNotes,
//   getTransferNotes,
//   addNote,
//   addTransferNote,
//   updateNoteState,
const router = express.Router();

router.get('/:account', asyncWrap(
  async function (req, res) {
    const account = req.params.account;
    const notes = localStorage.getNotes(account);

    return res.status(200).json({
      notes,
    });
  }
));

router.post('/', asyncWrap(
  async function (req, res) {
    const account = req.body.account;
    const note = req.body.note;

    localStorage.addNote(account, note);
    return res.status(200).json({
      note,
    });
  }
));

router.put('/', asyncWrap(
  async function (req, res) {
    const key = req.body.key;
    const noteHash = req.body.noteHash;
    const noteState = req.body.noteState;

    const note = localStorage.updateNoteState(key, noteHash, noteState);
    return res.status(200).json({
      note,
    });
  }
));

module.exports = router;
