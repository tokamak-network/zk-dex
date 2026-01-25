const express = require('express');

const asyncWrap = require('../lib/asyncWrap.cjs');

const {
  getAccounts,
  addAccount,
  deleteAccount,
} = require('../localstorage.cjs');

const {
  createAccount,
  unlockAccount,
} = require('../lib/accounts.cjs');

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
    try {
      const passphrase = req.body.passphrase;
      if (!passphrase) {
        return res.status(400).json({ error: 'Passphrase is required' });
      }
      console.log('Creating new account...');
      const result = await createAccount(passphrase);
      console.log('Account created successfully');
      // result contains: { address, publicKey: {x, y}, keystore }
      return res.status(200).json({
        account: result,
      });
    } catch (err) {
      console.error('Error in POST /accounts:', err);
      return res.status(500).json({ error: err.message || 'Failed to create account' });
    }
  }
));

router.post('/unlock', asyncWrap(
  async function (req, res) {
    const passphrase = req.body.passphrase;
    const keystore = req.body.keystore;
    const result = await unlockAccount(passphrase, keystore);

    // result contains: { secretKey, publicKey: {x, y}, address }
    return res.status(200).json({
      secretKey: result.secretKey,
      publicKey: result.publicKey,
      address: result.address,
    });
  }
));

router.post('/import', asyncWrap(
  async function (req, res) {
    const key = req.body.key;
    const account = req.body.account;
    const accounts = addAccount(key, account);
    return res.status(200).json({
      accounts,
    });
  }
));

router.delete('/', asyncWrap(
  async function (req, res) {
    const key = req.body.key;
    const address = req.body.address;
    const accounts = deleteAccount(key, address);
    return res.status(200).json({
      accounts,
    });
  }
));

module.exports = router;
