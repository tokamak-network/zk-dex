const express = require('express');

const asyncWrap = require("../lib/asyncWrap");

const {
  getMintNBurnProof,
  getTransferProof,
  getMakeOrderProof,
  getTakeOrderProof,
  getSettleOrderProof,
} = require('../../scripts/lib/dockerUtils');

const router = express.Router();

const generators = {
  mintNBurnNote: getMintNBurnProof,
  transferNote: getTransferProof,
  makeOrder: getMakeOrderProof,
  takeOrder: getTakeOrderProof,
  settleOrder: getSettleOrderProof,
};

router.post('/', asyncWrap(
  async function (req, res) {
    const circuit = req.body.circuit;
    const params = req.body.params;

    const generator = generators[circuit];
    if (!generator) {
      throw new Error('Unknown circuit ' + circuit);
    }

    const proof = await generator(...params);
    return res.status(200).json({
      proof,
    });
  }
));

module.exports = router;
