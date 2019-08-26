const express = require('express');

const asyncWrap = require("../lib/asyncWrap");

const {
  getViewingKey,
  setViewingKey,
} = require('../localstorage');

const router = express.Router();

router.get('/:key', asyncWrap(
  async function (req, res) {
    const key = req.params.key;
    const vk = getViewingKey(key);

    return res.status(200).json({
      vk,
    });
  }
));

router.post('/', asyncWrap(
  async function (req, res) {
    const key = req.body.key;
    const vk = req.body.vk;
    setViewingKey(key, vk);
    return res.status(200).json({});
  }
));

module.exports = router;
