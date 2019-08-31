const BN = require('bn.js');

const noteHelper = require('./noteHelper.js');
const zokratesHelper = require('./zokratesHelper.js');


function getMintAndBurnCmd(owner0, owner1, value, type, viewKey, salt, sk) {
  const params = noteHelper.getNoteParams(owner0, owner1, value, type, viewKey, salt).concat(sk);
  if (require.main === module) {
    zokratesHelper.printZokratesCommand(params);
  }
  return reduceParams(params);
}

function getTransferCmd(
  from0Owner0, from0Owner1, from0Value, from0Type, from0ViewKey, from0Salt,
  from1Owner0, from1Owner1, from1Value, from1Type, from1ViewKey, from1Salt,
  toOwner0, toOwner1, toValue, toType, toViewKey, toSalt,
  changeOwner0, changeOwner1, changeValue, changeType, changeViewKey, changeSalt,
  sk,
) {
  const from0Params = noteHelper.getNoteParams(from0Owner0, from0Owner1, from0Value, from0Type, from0ViewKey, from0Salt);
  const from1Params = noteHelper.getNoteParams(from1Owner0, from1Owner1, from1Value, from1Type, from1ViewKey, from1Salt);
  const toParams = noteHelper.getNoteParams(toOwner0, toOwner1, toValue, toType, toViewKey, toSalt);
  const changeParams = noteHelper.getNoteParams(changeOwner0, changeOwner1, changeValue, changeType, changeViewKey, changeSalt);

  const transferParams = from0Params.concat(from1Params, toParams, changeParams, sk);
  if (require.main === module) {
    zokratesHelper.printZokratesCommand(transferParams);
  }
  return reduceParams(transferParams);
}

function getConvertCmd(
  smartOwner0, smartOwner1, smartValue, smartType, smartViewKey, smartSalt,
  originOwner0, originOwner1, originValue, originType, originViewKey, originSalt,
  noteOwner0, noteOwner1, noteValue, noteType, noteViewKey, noteSalt,
  sk,
) {
  const smartParams = noteHelper.getNoteParams(smartOwner0, smartOwner1, smartValue, smartType, smartViewKey, smartSalt);
  const originParams = noteHelper.getNoteParams(originOwner0, originOwner1, originValue, originType, originViewKey, originSalt);
  const noteParams = noteHelper.getNoteParams(noteOwner0, noteOwner1, noteValue, noteType, noteViewKey, noteSalt);

  const convertParams = smartParams.concat(originParams, noteParams, sk);
  if (require.main === module) {
    zokratesHelper.printZokratesCommand(convertParams);
  }
  return reduceParams(convertParams);
}

function getMakeOrderCmd(owner0, owner1, value, type, viewKey, salt, sk) {
  const params = noteHelper.getNoteParams(owner0, owner1, value, type, viewKey, salt).concat(sk);
  if (require.main === module) {
    zokratesHelper.printZokratesCommand(params);
  }
  return reduceParams(params);
}

function getTakeOrderCmd(
  parentOwner0, parentOwner1, parentValue, parentType, parentViewKey, parentSalt, // parent note's variables
  makerToTakerOwner0, makerToTakerOwner1, makerToTakerValue, makerToTakerType, makerToTakerViewKey, makerToTakerSalt, // takerNoteToMaker note's variables
  sk,
) {
  const parentNoteParams = noteHelper.getNoteParams(parentOwner0, parentOwner1, parentValue, parentType, parentViewKey, parentSalt);
  const makerToTakerNoteParams = noteHelper.getNoteParams(makerToTakerOwner0, makerToTakerOwner1, makerToTakerValue, makerToTakerType, makerToTakerViewKey, makerToTakerSalt);
  const params = parentNoteParams.concat(makerToTakerNoteParams, sk);

  if (require.main === module) {
    zokratesHelper.printZokratesCommand(params);
  }
  return reduceParams(params);
}

function getSettleOrderCmd(
  makerNoteOwner0, makerNoteOwner1, makerNoteValue, makerNoteType, makerNoteViewKey, makerNoteSalt, // makerNote's variables
  takerToMakerOwner0, takerToMakerOwner1, takerToMakerValue, takerToMakerType, takerToMakerViewKey, takerToMakerSalt, // takerNoteToMakerNote's variables
  newNoteToTakerOwner0, newNoteToTakerOwner1, newNoteToTakerValue, newNoteToTakerType, newNoteToTakerViewKey, newNoteToTakerSalt, // newNoteToTakerNote's variables
  newNoteToMakerOwner0, newNoteToMakerOwner1, newNoteToMakerValue, newNoteToMakerType, newNoteToMakerViewKey, newNoteToMakerSalt, // newNoteToMakerNote's variables
  changeOwner0, changeOwner1, changeValue, changeType, changeViewKey, changeSalt, // changeNote's variables
  price, // price
  quotient0, remainder0, // // makerNote.Value * price / 10**18, makerNote.Value * price % 10**18
  quotient1, remainder1, // stakeNote.Value / price, stakeNote.Value % price
  sk,
) {
  const makerNoteParams = noteHelper.getNoteParams(makerNoteOwner0, makerNoteOwner1, makerNoteValue, makerNoteType, makerNoteViewKey, makerNoteSalt);
  const takerToMakerNoteParams = noteHelper.getNoteParams(takerToMakerOwner0, takerToMakerOwner1, takerToMakerValue, takerToMakerType, takerToMakerViewKey, takerToMakerSalt);
  const newNoteToTakerParams = noteHelper.getNoteParams(newNoteToTakerOwner0, newNoteToTakerOwner1, newNoteToTakerValue, newNoteToTakerType, newNoteToTakerViewKey, newNoteToTakerSalt);
  const newNoteToMakerParams = noteHelper.getNoteParams(newNoteToMakerOwner0, newNoteToMakerOwner1, newNoteToMakerValue, newNoteToMakerType, newNoteToMakerViewKey, newNoteToMakerSalt);
  const changeNoteParams = noteHelper.getNoteParams(changeOwner0, changeOwner1, changeValue, changeType, changeViewKey, changeSalt);

  const params = makerNoteParams.concat(takerToMakerNoteParams, newNoteToTakerParams, newNoteToMakerParams, changeNoteParams, price, quotient0, remainder0, quotient1, remainder1, sk);

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
  getConvertCmd,
  getMakeOrderCmd,
  getTakeOrderCmd,
  getSettleOrderCmd,
};