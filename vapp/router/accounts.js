const express = require('express');

const asyncWrap = require('../lib/asyncWrap');

const {
  getAccounts,
  addAccount,
  deleteAccount,
} = require('../localstorage');

const {
  createAccount,
  unlockAccount,
} = require('../lib/accounts');

const router = express.Router();

router.get('/:key', asyncWrap(
  async function (req, res) {
    const key = req.params.key;
    const accounts = getAccounts(key);
    return res.status(200).json({
      accounts,
    });
  }
));

router.post('/', asyncWrap(
  async function (req, res) {
    const passphrase = req.body.passphrase;
    const address = createAccount(passphrase);
    return res.status(200).json({
      address,
    });
  }
));

// TODO: params should be {passphrase, address}
router.post('/unlock', asyncWrap(
  async function (req, res) {
    const passphrase = req.body.passphrase;
    const keystore = req.body.keystore;
    const privateKey = unlockAccount(passphrase, keystore);

    return res.status(200).json({
      privateKey,
    });
  }
));

router.post('/import', asyncWrap(
  async function (req, res) {
    const key = req.body.key;
    const account = req.body.account;
    addAccount(key, account);
    return res.status(200).json({});
  }
));

router.delete('/', asyncWrap(
  async function (req, res) {
    const key = req.body.key;
    const address = req.body.address;
    deleteAccount(key, address);
    return res.status(200).json({});
  }
));

module.exports = router;
