const express = require('express');

const asyncWrap = require('../lib/asyncWrap');

const {
  getViewingKeys,
  addViewingKeys,
  addUserKey,
} = require('../localstorage');

const router = express.Router();

router.get('/:userKey', asyncWrap(
  async function (req, res) {
    const userKey = req.params.userKey;
    const vks = getViewingKeys(userKey);
    return res.status(200).json({
      vks,
    });
  }
));

router.post('/:userKey', asyncWrap(
  async function (req, res) {
    const userKey = req.params.userKey;
    const vk = req.body.vk;
    const vks = addViewingKeys(userKey, vk);
    addUserKey(userKey);
    return res.status(200).json({
      vks,
    });
  }
));

module.exports = router;
