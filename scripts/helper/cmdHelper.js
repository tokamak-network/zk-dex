const BN = require('bn.js');

const noteHelper = require('./noteHelper.js');
const zokratesHelper = require('./zokratesHelper.js');


function getMintAndBurnCmd(owner, value, type, viewKey, salt, sk) {
  const params = noteHelper.getNoteParams(owner, value, type, viewKey, salt).concat(sk);
  if (require.main === module) {
    zokratesHelper.printZokratesCommand(params);
  }
  return reduceParams(params);
}

function getTransferCmd(
  fromOwner, fromValue, fromType, fromViewKey, fromSalt, fromSk,
  toOwner, toValue, toType, toViewKey, toSalt,
  changeOwner, changeValue, changeType, changeViewKey, changeSalt,
  originOwner, originValue, originType, originViewKey, originSalt, 
) {
  const fromParams = noteHelper.getNoteParams(fromOwner, fromValue, fromType, fromViewKey, fromSalt).concat(fromSk);
  const toParams = noteHelper.getNoteParams(toOwner, toValue, toType, toViewKey, toSalt);
  const changeParams = noteHelper.getNoteParams(changeOwner, changeValue, changeType, changeViewKey, changeSalt);
  const originParams = noteHelper.getNoteParams(originOwner, originValue, originType, originViewKey, originSalt);

  const transferParams = fromParams.concat(toParams, changeParams, originParams);
  if (require.main === module) {
    zokratesHelper.printZokratesCommand(transferParams);
  }
  return reduceParams(transferParams);
}

function getMakeOrderCmd(owner, value, type, viewKey, salt, sk) {
  const params = noteHelper.getNoteParams(owner, value, type, viewKey, salt).concat(sk);
  if (require.main === module) {
    zokratesHelper.printZokratesCommand(params);
  }
  return reduceParams(params);
}

function getTakeOrderCmd(
  parentOwner, parentValue, parentType, parentViewKey, parentSalt, parentSk, // parent note's variables
  makerToTakerOwner, makerToTakerValue, makerToTakerType, makerToTakerViewKey, makerToTakerSalt, // takerNoteToMaker note's variables
) {
  const parentNoteParams = noteHelper.getNoteParams(parentOwner, parentValue, parentType, parentViewKey, parentSalt).concat(parentSk);
  const makerToTakerNoteParams = noteHelper.getNoteParams(makerToTakerOwner, makerToTakerValue, makerToTakerType, makerToTakerViewKey, makerToTakerSalt);
  const params = parentNoteParams.concat(makerToTakerNoteParams);

  if (require.main === module) {
    zokratesHelper.printZokratesCommand(params);
  }
  return reduceParams(params);
}

function getSettleOrderCmd(
  makerNoteOwner, makerNoteValue, makerNoteType, makerNoteViewKey, makerNoteSalt, makerNoteSk, // makerNote's variables
  takerToMakerOwner, takerToMakerValue, takerToMakerType, takerToMakerViewKey, takerToMakerSalt, // takerNoteToMakerNote's variables
  newNoteToTakerOwner, newNoteToTakerValue, newNoteToTakerType, newNoteToTakerViewKey, newNoteToTakerSalt, // newNoteToTakerNote's variables
  newNoteToMakerOwner, newNoteToMakerValue, newNoteToMakerType, newNoteToMakerViewKey, newNoteToMakerSalt, // newNoteToMakerNote's variables
  changeOwner, changeValue, changeType, changeViewKey, changeSalt, // changeNote's variables
  price, // price
  quotient0, remainder0, // // makerNote.Value * price / 10**18, makerNote.Value * price % 10**18
  quotient1, remainder1 // stakeNote.Value / price, stakeNote.Value % price
) {
  const makerNoteHash = noteHelper.getNoteHash(makerNoteOwner, makerNoteValue, makerNoteType, makerNoteViewKey, makerNoteSalt);

  const makerNoteParams = noteHelper.getNoteParams(makerNoteOwner, makerNotePk1, makerNoteValue, makerNoteType, makerNoteViewKey, makerNoteSalt).concat(makerNoteSk);
  const takerToMakerNoteParams = noteHelper.getNoteParams(takerToMakerOwner, taker2MakerNoteValue, taker2MakerNoteType, taker2MakerNoteViewKey, taker2MakerNoteSalt);
  const newNoteToTakerParams = noteHelper.getNoteParams(newNoteToTakerOwner, newNote2TakerValue, newNote2TakerType, newNote2TakerViewKey, newNote2TakerSalt);
  const newNoteToMakerParams = noteHelper.getNoteParams(newNoteToMakerOwner, newNote2MakerValue, newNote2MakerType, newNote2MakerViewKey, newNote2MakerSalt);
  const changeNoteParams = noteHelper.getNoteParams(changeOwner, changeNoteValue, changeNoteType, changeNoteViewKey, changeNoteSalt);

  const params = makerNoteParams.concat(takerToMakerNoteParams, newNoteToTakerParams, newNoteToMakerParams, changeNoteParams).concat(price, quotient0, remainder0, quotient1, remainder1);

  if (require.main === module) {
    zokratesHelper.printZokratesCommand(params);
  }

  return reduceParams(params);
}

function reduceParams(params) {
  return params
    .map(p => new BN(p, 16).toString(10))
    .reduce((a, b) => `${a} ${b}`, '').trim();
}

module.exports = {
  getMintAndBurnCmd,
  getTransferCmd,
  getMakeOrderCmd,
  getTakeOrderCmd,
  getSettleOrderCmd,
};