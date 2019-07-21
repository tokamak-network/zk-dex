const fs = require('fs');
const BN = require('bn.js');
const crypto = require('crypto');

const SCALING_FACTOR = new BN('1000000000000000000');

function getNoteHash(owner, amount, type, viewKey, salt, isSmart) {
  const paddedO = _toPadedObject(owner, amount, type, viewKey, salt, isSmart);
  const { noteOwner } = paddedO;
  const { splittedNoteOwner } = paddedO;
  const { noteValue } = paddedO;
  const { noteType } = paddedO;
  const { noteViewKey } = paddedO;
  const { splittedNoteViewKey } = paddedO;
  const { noteSalt } = paddedO;
  const { noteIsSmart } = paddedO;

  const note = splittedNoteOwner.join('') + noteValue + noteType + splittedNoteViewKey.join('') + noteSalt + noteIsSmart;

  const hashArr = toHashed(note);
  return hashArr[0] + hashArr[1];
}

// Example Params
// owner = "1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61";
// value = '6'
// type = '0'
// viewKey = "1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61";
// salt = "c517f646255d5492089b881965cbd3da";
// isSmart = '0';

// Return = [noteHash[2], noteValue, noteType, splittedNoteOwner[2], splittedNoteViewKey[2], noteSalt, noteIsSmart]
function getNoteParams(owner, amount, type, viewKey, salt, isSmart) {
  const paddedO = _toPadedObject(owner, amount, type, viewKey, salt, isSmart);
  const { noteOwner } = paddedO;
  const { splittedNoteOwner } = paddedO;
  const { noteValue } = paddedO;
  const { noteType } = paddedO;
  const { noteViewKey } = paddedO;
  const { splittedNoteViewKey } = paddedO;
  const { noteSalt } = paddedO;
  const { noteIsSmart } = paddedO;

  // To be hashed, raw note info
  const note = splittedNoteOwner.join('') + noteValue + noteType + splittedNoteViewKey.join('') + noteSalt + noteIsSmart;

  const noteHash = toHashed(note);

  const noteParams = noteHash.concat(noteValue, noteType, splittedNoteOwner, splittedNoteViewKey, noteSalt, noteIsSmart);

  // console.log(noteParams); //for check parameters
  return noteParams;
}

function getNoteParamsForTransfer(owner, amount, type, viewKey, salt, isSmart) {
  const paddedO = _toPadedObject(owner, amount, type, viewKey, salt, isSmart);
  const { noteOwner } = paddedO;
  const { splittedNoteOwner } = paddedO;
  const { noteValue } = paddedO;
  const { noteType } = paddedO;
  const { noteViewKey } = paddedO;
  const { splittedNoteViewKey } = paddedO;
  const { noteSalt } = paddedO;
  const { noteIsSmart } = paddedO;

  // To be hashed, raw note info
  const note = splittedNoteOwner.join('') + noteValue + noteType + splittedNoteViewKey.join('') + noteSalt + noteIsSmart;

  const noteHash = toHashed(note);

  const noteParams = noteHash.concat(splittedNoteOwner, noteValue, noteType, splittedNoteViewKey, noteSalt, noteIsSmart);

  // console.log(noteViewKey, noteParams); //for check parameters
  return noteParams;
}

function getNoteParamsForMakeOrder(owner, amount, type, viewKey, salt, isSmart) {
  const paddedO = _toPadedObject(owner, amount, type, viewKey, salt, isSmart);
  const { noteOwner } = paddedO;
  const { splittedNoteOwner } = paddedO;
  const { noteValue } = paddedO;
  const { noteType } = paddedO;
  const { noteViewKey } = paddedO;
  const { splittedNoteViewKey } = paddedO;
  const { noteSalt } = paddedO;
  const { noteIsSmart } = paddedO;

  // To be hashed, raw note info
  const note = splittedNoteOwner.join('') + noteValue + noteType + splittedNoteViewKey.join('') + noteSalt + noteIsSmart;

  const noteHash = toHashed(note);

  const noteParams = noteHash.concat(noteType, splittedNoteOwner, noteValue, splittedNoteViewKey, noteSalt, noteIsSmart);

  // console.log(noteParams); //for check parameters
  return noteParams;
}

function getNoteParamsForTakeOrder(owner, amount, type, viewKey, salt, isSmart) {
  const paddedO = _toPadedObject(owner, amount, type, viewKey, salt, isSmart);
  const { noteOwner } = paddedO;
  const { splittedNoteOwner } = paddedO;
  const { noteValue } = paddedO;
  const { noteType } = paddedO;
  const { noteViewKey } = paddedO;
  const { splittedNoteViewKey } = paddedO;
  const { noteSalt } = paddedO;
  const { noteIsSmart } = paddedO;

  // To be hashed, raw note info
  const note = splittedNoteOwner.join('') + noteValue + noteType + splittedNoteViewKey.join('') + noteSalt + noteIsSmart;

  const noteHash = toHashed(note);

  const noteParams = noteHash.concat(noteType, splittedNoteOwner, noteValue, splittedNoteViewKey, noteSalt, noteIsSmart);

  // console.log(noteParams); //for check parameters
  return noteParams;
}

function getNoteParamsForSettleOrder(owner, amount, type, viewKey, salt, isSmart) {
  const paddedO = _toPadedObject(owner, amount, type, viewKey, salt, isSmart);
  const { noteOwner } = paddedO;
  const { splittedNoteOwner } = paddedO;
  const { noteValue } = paddedO;
  const { noteType } = paddedO;
  const { noteViewKey } = paddedO;
  const { splittedNoteViewKey } = paddedO;
  const { noteSalt } = paddedO;
  const { noteIsSmart } = paddedO;

  // To be hashed, raw note info
  const note = splittedNoteOwner.join('') + noteValue + noteType + splittedNoteViewKey.join('') + noteSalt + noteIsSmart;

  const noteHash = toHashed(note);

  const noteParams = noteHash.concat(noteType, splittedNoteOwner, noteValue, splittedNoteViewKey, noteSalt, noteIsSmart);

  // console.log(noteParams); //for check parameters
  return noteParams;
}

function _toPadedObject(owner, amount, type, viewKey, salt, isSmart) {
  // all params should look like this "0001"(o), "0x0001"(x)
  const noteOwner = new BN(owner, 16).toString(16); // 32 bytes = 256 bits
  const splittedNoteOwner = _checkLenAndReturn(noteOwner);

  const noteValue = new BN(amount, 16).toString(16, 32); // 16 bytes = 128 bits
  const noteType = new BN(type, 16).toString(16, 32); // 16 bytes = 128 bits

  const noteViewKey = new BN(viewKey, 16).toString(16); // 32 bytes = 256 bits

  const splittedNoteViewKey = _checkLenAndReturn(noteViewKey);

  const noteSalt = new BN(salt, 16).toString(16, 32); // 16 bytes = 128 bits
  const noteIsSmart = new BN(isSmart, 16).toString(16, 32); // 16 bytes = 128 bits

  const result = {
    noteOwner,
    splittedNoteOwner,
    noteValue,
    noteType,
    noteViewKey,
    splittedNoteViewKey,
    noteSalt,
    noteIsSmart,
  };

  return result;
}

function _checkLenAndReturn(targetHex) {
  let splittedData;
  const targetLen = targetHex.length;
  const remainLen = 64 - targetLen;

  if (targetHex == '0') {
    splittedData = ['0'.repeat(32), '0'.repeat(32)];
  } else if (targetLen < 32) {
    splittedData = ['0'.repeat(32), '0'.repeat(32 - noteOwnerLen).concat(noteOwner.slice(0, 32))];
  } else if (targetLen > 32 && targetLen < 64) {
    splittedData = ['0'.repeat(remainLen).concat(targetHex.slice(0, 32 - remainLen)), targetHex.slice(32 - remainLen)];
  } else {
    splittedData = [targetHex.slice(0, 32), targetHex.slice(32)];
  }

  return splittedData;
}

function toHashed(encodedValue) {
  const buf = Buffer.from(encodedValue, 'hex');
  const digest = crypto.createHash('sha256').update(buf).digest('hex');
  // console.log('digest', digest)
  // split into 128 bits each
  return [digest.slice(0, 32), digest.slice(32)];
}

module.exports = {
  getNoteHash,
  getNoteParams,
  getNoteParamsForTransfer,
  getNoteParamsForMakeOrder,
  getNoteParamsForTakeOrder,
  getNoteParamsForSettleOrder,
  toHashed,
};
