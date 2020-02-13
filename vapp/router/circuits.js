const express = require('express');
const isEmpty = require('lodash/isEmpty');

const asyncWrap = require('../lib/asyncWrap');

const {
  getMintNBurnProof,
  getTransferProof,
  getConvertProof,
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
  convertNote: getConvertProof,
  makeOrder: getMakeOrderProof,
  takeOrder: getTakeOrderProof,
  settleOrder: getSettleOrderProof,
};

const dummyGenerators = {
  mintNBurnNote: createProof.dummyProofCreateNote,
  transferNote: createProof.dummyProofSpendNote,
  convertNote: createProof.dummyProofConvertNote,
  makeOrder: createProof.dummyProofMakeOrder,
  takeOrder: createProof.dummyProofTakeOrder,
  settleOrder: createProof.dummyProofSettleOrder,
};

const lengthChecker = (min, max) => len => min <= len && len <= max;

const checkOwnersLength = {
  mintNBurnNote: lengthChecker(1, 1),
  transferNote: lengthChecker(1, 2),
  convertNote: lengthChecker(1, 1),
  makeOrder: lengthChecker(1, 1),
  takeOrder: lengthChecker(1, 1),
  settleOrder: lengthChecker(1, 1),
};

const USE_DUMMY = process.env.USE_DUMMY === 'true';
console.log('USE_DUMMY', USE_DUMMY);

// /circuits/:circuit requires { owners: [{userKey, address}], params }
router.use('/:circuit', asyncWrap(
  async function (req, res, next) {
    const { circuit } = req.params;
    const { owners = [] } = req.body;

    const checker = checkOwnersLength[circuit];
    if (!checker) throw new Error('Unknown circuit ' + circuit);

    if (!checker(owners.length)) throw new Error(`circuits ${circuit} requires at least one owner`);

    req.body.privKeyHexs = owners.map(({ userKey = '', address = '' }) => {
      if (!userKey && !address) return null;

      if (!userKey || !address) throw new Error(`circuits ${circuit} requires both userKey and address`);

      if (!req.app.zkdexService.hasPrivateKey(userKey, address)) throw new Error('unlock account before making proof');

      const privKey = req.app.zkdexService.getPrivateKey(userKey, address);

      if (!privKey) throw new Error('unlock account before making proof');

      return privKey.toHex();
    });

    next();
  }
));

// TODO: get private key from DB.
router.post('/:circuit', asyncWrap(
  async function (req, res) {
    const { circuit } = req.params;
    const {
      params = [],
      privKeyHexs = [],
    } = req.body;

    params.push(...privKeyHexs);

    const generator = USE_DUMMY
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
