const express = require('express');
const {
  addZkPrefix,
  removeZkPrefix,
} = require('zk-dex-keystore/lib/utils');


const asyncWrap = require('../lib/asyncWrap');

const {
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
    const addresses = getAccounts(userKey).map(account => addZkPrefix(account.address));
    return res.status(200).json({
      addresses,
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
      address: addZkPrefix(account.address),
    });
  }
));

// TODO: change /accounts/:userKey/orders to /orders?id&userKey
router.get('/:userKey/orders', asyncWrap(
  async function (req, res) {
    const userKey = req.params.userKey;
    const orders = getOrdersByUser(userKey);
    return res.status(200).json({
      orders,
    });
  }
));

// changed: HTTP 200: {privateKey} --> {address, success}
router.post('/:userKey/unlock', asyncWrap(
  async function (req, res) {
    const { userKey } = req.params;
    const {
      passphrase,
      address,
      duration = undefined,
    } = req.body;

    const account = getAccountByAddress(userKey, address);
    console.log('account', account);
    const privateKey = unlockAccount(passphrase, account);

    req.app.zkdexService.setPrivateKey(userKey, privateKey);

    return res.status(200).json({
      address: addZkPrefix(address),
      success: true,
    });
  }
));

// TODO: use zk-dex-keystore
router.post('/:userKey/import', asyncWrap(
  async function (req, res) {
    const userKey = req.params.userKey;
    const account = req.body.account;
    addAccount(userKey, account);
    return res.status(200).json({});
  }
));

// TODO: use zk-dex-keystore
router.delete('/:userKey', asyncWrap(
  async function (req, res) {
    const userKey = req.params.userKey;
    const address = removeZkPrefix(req.body.address);
    deleteAccount(userKey, address);
    return res.status(200).json({
      address: addZkPrefix(address),
    });
  }
));

module.exports = router;
