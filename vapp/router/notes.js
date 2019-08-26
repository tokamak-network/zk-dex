const express = require('express');

const asyncWrap = require("../lib/asyncWrap");

const {
  getNotes,
  getTransferNotes,
  addNote,
  addTransferNote,
  updateNote,
} = require('../localstorage');


const router = express.Router();

router.get('/:account', asyncWrap(
  async function (req, res) {
    const account = req.params.account;
    const notes = getNotes(account);
    return res.status(200).json({
      notes,
    });
  }
));

router.get('/transfer/:account', asyncWrap(
  async function (req, res) {
    const account = req.params.account;
    const notes = getTransferNotes(account);
    return res.status(200).json({
      notes,
    });
  }
));

router.post('/', asyncWrap(
  async function (req, res) {
    const account = req.body.account;
    const note = req.body.note;
    addNote(account, note);
    return res.status(200).json({});
  }
));

router.post('/transfer', asyncWrap(
  async function (req, res) {
    const account = req.body.account;
    const note = req.body.note;
    addTransferNote(account, note);
    return res.status(200).json({});
  }
));

router.put('/', asyncWrap(
  async function (req, res) {
    const account = req.body.account;
    const note = req.body.note;
    updateNote(account, note);
    return res.status(200).json({});
  }
));


module.exports = router;