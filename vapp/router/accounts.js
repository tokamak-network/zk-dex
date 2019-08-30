const express = require('express');

const {
  marshal,
  unmarshal,
} = require('../../scripts/lib/util');
const asyncWrap = require('../lib/asyncWrap');

const {
  localStorage: db,
  getAccounts,
  getAccountByAddress,
  addAccount,
  deleteAccount,
  getOrdersByUser,
} = require('../localstorage');

const {
  createAccount,
  unlockAccount,
} = require('../lib/accounts');

const router = express.Router();

router.get('/:userKey', asyncWrap(
  async function (req, res) {
    const userKey = req.params.userKey;
    const accounts = getAccounts(userKey);
    return res.status(200).json({
      accounts,
    });
  }
));

router.post('/:userKey', asyncWrap(
  async function (req, res) {
    const userKey = req.params.userKey;
    const passphrase = req.body.passphrase;
    const account = createAccount(passphrase);
    addAccount(userKey, account);
    return res.status(200).json({
      address: marshal(account.address),
    });
  }
));

router.get('/:userKey/orders', asyncWrap(
  async function (req, res) {
    const userKey = req.params.userKey;
    const orders = getOrdersByUser(userKey);
    return res.status(200).json({
      orders,
    });
  }
));

router.post('/unlock/:userKey', asyncWrap(
  async function (req, res) {
    const {
      passphrase,
      address,
    } = req.body;

    const account = getAccountByAddress(unmarshal(address));
    const privateKey = unlockAccount(passphrase, account);

    return res.status(200).json({
      privateKey,
    });
  }
));

// TODO: import account by userKey
router.post('/import/:userKey', asyncWrap(
  async function (req, res) {
    const userKey = req.params.userKey;
    const account = req.body.account;
    addAccount(userKey, account);
    return res.status(200).json({});
  }
));

// TODO: delete account by userKey
router.delete('/:userKey', asyncWrap(
  async function (req, res) {
    const userKey = req.params.userKey;
    const address = unmarshal(req.body.address);
    deleteAccount(userKey, address);
    return res.status(200).json({
      address: marshal(address),
    });
  }
));

module.exports = router;
