const express = require('express');

const asyncWrap = require('../lib/asyncWrap');

const {
  getNoteByNoteHash,
  getNotes,
  getTransferNotes,
  addNote,
  addTransferNote,
  updateNoteState,
} = require('../localstorage');


const router = express.Router();

router.get('/transfer/:account', asyncWrap(
  async function (req, res) {
    const account = req.params.account;
    const notes = getTransferNotes(account);
    return res.status(200).json({
      notes,
    });
  }
));

router.get('/:account/:hash', asyncWrap(
  async function (req, res) {
    const account = req.params.account;
    const hash = req.params.hash;
    const note = getNoteByNoteHash(account, hash);
    return res.status(200).json({
      note,
    });
  }
));

router.get('/:account', asyncWrap(
  async function (req, res) {
    const account = req.params.account;
    const notes = getNotes(account);
    return res.status(200).json({
      notes,
    });
  }
));

router.post('/', asyncWrap(
  async function (req, res) {
    const account = req.body.account;
    const note = req.body.note;
    const notes = addNote(account, note);
    return res.status(200).json({
      notes,
    });
  }
));

router.post('/transfer', asyncWrap(
  async function (req, res) {
    const account = req.body.account;
    const note = req.body.note;
    const notes = addTransferNote(account, note);
    return res.status(200).json({
      notes,
    });
  }
));

router.put('/', asyncWrap(
  async function (req, res) {
    const noteOwner = req.body.noteOwner;
    const noteHash = req.body.noteHash;
    const noteState = req.body.noteState;
    const notes = updateNoteState(noteOwner, noteHash, noteState);
    return res.status(200).json({
      notes,
    });
  }
));


module.exports = router;
