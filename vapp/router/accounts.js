const express = require('express');
const asyncWrap = require('../lib/asyncWrap');
const localStorage = require('../localstorage');

const {
  createAccount,
  unlockAccount,
} = require('../lib/accounts');

const router = express.Router();

router.get('/:key', asyncWrap(
  async function (req, res) {
    const key = req.params.key;
    const accounts = localStorage.getAccounts(key);

    return res.status(200).json({
      accounts,
    });
  }
));

router.post('/', asyncWrap(
  async function (req, res) {
    const key = req.body.key;
    const account = req.body.account;
    localStorage.addAccount(key, account);

    return res.status(200).json({
      account,
    });
  }
));

// createAccount using keythereum.
router.post('/create', asyncWrap(
  async function (req, res) {
    const passphrase = req.body.passphrase;
    const address = createAccount(passphrase);

    return res.status(200).json({
      address,
    });
  }
));

module.exports = router;
