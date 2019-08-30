const express = require('express');

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

router.get('/:userKey/history', asyncWrap(
  async function (req, res) {
    const userKey = req.params.userKey;
    const histories = TransferHistory.getHistoriesByUser(userKey);

    return res.status(200).json({
      histories,
    });
  }
));

router.post('/', asyncWrap(
  async function (req, res) {
    const userKey = req.body.userKey;
    const note = req.body.note;
    addNote(userKey, note);
    return res.status(200).json({});
  }
));

router.post('/transfer/:userKey', asyncWrap(
  async function (req, res) {
    const userKey = req.params.userKey;
    const note = req.body.note;
    addTransferNote(userKey, note);
    return res.status(200).json({});
  }
));

router.put('/', asyncWrap(
  async function (req, res) {
    const userKey = req.body.userKey;
    const note = req.body.note;
    updateNote(userKey, note);
    return res.status(200).json({});
  }
));


module.exports = router;
