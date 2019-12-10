const express = require('express');

const asyncWrap = require('../lib/asyncWrap');

const {
  getMintNBurnProof,
  getTransferProof,
  getMakeOrderProof,
  getTakeOrderProof,
  getSettleOrderProof,
} = require('../../scripts/lib/dockerUtils');

const { Note, createProof } = require('../../scripts/lib/Note');

const { TransferHistory, TransferHistoryState } = require('../localstorage');

const router = express.Router();

const generators = {
  mintNBurnNote: getMintNBurnProof,
  transferNote: getTransferProof,
  makeOrder: getMakeOrderProof,
  takeOrder: getTakeOrderProof,
  settleOrder: getSettleOrderProof,
};

const dummyGenerators = {
  mintNBurnNote: createProof.dummyProofCreateNote,
  transferNote: createProof.dummyProofSpendNote,
  makeOrder: createProof.dummyProofMakeOrder,
  takeOrder: createProof.dummyProofTakeOrder,
  settleOrder: createProof.dummyProofSettleOrder,
};

console.log('process.env.USE_DUMMY', process.env.USE_DUMMY);

const useDummy = process.env.USE_DUMMY || false;

router.post('/', asyncWrap(
  async function (req, res) {
    const circuit = req.body.circuit;
    const params = req.body.params;
    const generator = useDummy
      ? dummyGenerators[circuit]
      : generators[circuit];

    if (!generator) {
      throw new Error('Unknown circuit ' + circuit);
    }

    const proof = await generator(...params);

    if (circuit === 'transferNote') {
      const input = Note.fromJSON(params[0]);
      const output1 = Note.fromJSON(params[1]);
      const output2 = Note.fromJSON(params[2]);

      const history = TransferHistory.getHistory(input.hash());
      if (!history) {
        (new TransferHistory(input, output1, output2)).setHistory();
      }
    }

    return res.status(200).json({
      proof,
    });
  }
));

module.exports = router;
