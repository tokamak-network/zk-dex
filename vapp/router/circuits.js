const express = require('express');
const isEmpty = require('lodash/isEmpty');

const asyncWrap = require('../lib/asyncWrap');

const {
  getMintNBurnProof,
  getTransferProof,
  getMakeOrderProof,
  getTakeOrderProof,
  getSettleOrderProof,
} = require('../../scripts/lib/dockerUtils');

const { Note, createProof, constants: { EMPTY_NOTE } } = require('../../scripts/lib/Note');

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

// TODO: get private key from DB.
router.post('/:circuit', asyncWrap(
  async function (req, res) {
    const circuit = req.params.circuit;
    const params = req.body.params;

    // console.log('params', JSON.stringify(params));

    const generator = useDummy
      ? dummyGenerators[circuit]
      : generators[circuit];

    if (!generator) {
      throw new Error('Unknown circuit ' + circuit);
    }

    const proof = await generator(...params);

    if (circuit === 'transferNote') {
      const oldNote0 = isEmpty(params[0]) ? EMPTY_NOTE : Note.fromJSON(params[0]);
      const oldNote1 = isEmpty(params[1]) ? EMPTY_NOTE : Note.fromJSON(params[1]);
      const newNote0 = isEmpty(params[2]) ? EMPTY_NOTE : Note.fromJSON(params[2]);
      const newNote1 = isEmpty(params[3]) ? EMPTY_NOTE : Note.fromJSON(params[3]);

      const oldNote0Hash = oldNote0.hash();
      const oldNote1Hash = oldNote1.hash();
      const newNote0Hash = newNote0.hash();
      const newNote1Hash = newNote1.hash();

      const history = TransferHistory.getHistory(oldNote0Hash, oldNote1Hash);

      if (!history) {
        (new TransferHistory(oldNote0Hash, oldNote1Hash, newNote0Hash, newNote1Hash)).setHistory();
      }
    }

    return res.status(200).json({
      proof,
    });
  }
));

module.exports = router;
