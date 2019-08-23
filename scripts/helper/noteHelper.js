const fs = require('fs');
const BN = require('bn.js');
const crypto = require('crypto');

const SCALING_FACTOR = new BN('1000000000000000000');

function getNoteHash(owner, value, type, viewKey, salt) {
  const paddedO = _toPadedObject(owner, value, type, viewKey, salt);
  const { splittedNoteOwner } = paddedO;
  const { noteValue } = paddedO;
  const { noteType } = paddedO;
  const { splittedNoteViewKey } = paddedO;
  const { noteSalt } = paddedO;

  const note = splittedNoteOwner.join('') + noteValue + noteType + splittedNoteViewKey.join('') + noteSalt;
  console.log("owner", splittedNoteOwner.join(''));
  console.log("value", noteValue);
  console.log("type", noteType);
  console.log("viewKey", splittedNoteViewKey.join(''));
  console.log("salt", noteSalt);
  console.log("note", note)
  
  const hashArr = toHashed(note);
  
  return hashArr[0] + hashArr[1];
}

function getNoteParams(owner, value, type, viewKey, salt) {
  const paddedO = _toPadedObject(owner, value, type, viewKey, salt);
  const { splittedNoteOwner } = paddedO;
  const { noteValue } = paddedO;
  const { noteType } = paddedO;
  const { splittedNoteViewKey } = paddedO;
  const { noteSalt } = paddedO;
  console.log("splittedNoteOwner", splittedNoteOwner);
  console.log("noteValue", noteValue);
  console.log("noteType", noteType);
  console.log("splittedNoteViewKey", splittedNoteViewKey);
  console.log("noteSalt", noteSalt);

  // To be hashed, raw note info
  const note = splittedNoteOwner.join('') + noteValue + noteType + splittedNoteViewKey.join('') + noteSalt;
  const noteHash = toHashed(note);
  const noteParams = noteHash.concat(splittedNoteOwner, noteValue, noteType, splittedNoteViewKey, noteSalt);

  return noteParams;
}

// function getNoteParamsForTransfer(owner, amount, type, viewKey, salt, isSmart) {
//   const paddedO = _toPadedObject(owner, amount, type, viewKey, salt, isSmart);
//   const { noteOwner } = paddedO;
//   const { splittedNoteOwner } = paddedO;
//   const { noteValue } = paddedO;
//   const { noteType } = paddedO;
//   const { noteViewKey } = paddedO;
//   const { splittedNoteViewKey } = paddedO;
//   const { noteSalt } = paddedO;
//   const { noteIsSmart } = paddedO;

//   // To be hashed, raw note info
//   const note = splittedNoteOwner.join('') + noteValue + noteType + splittedNoteViewKey.join('') + noteSalt + noteIsSmart;

//   const noteHash = toHashed(note);

//   const noteParams = noteHash.concat(splittedNoteOwner, noteValue, noteType, splittedNoteViewKey, noteSalt, noteIsSmart);

//   // console.log(noteViewKey, noteParams); //for check parameters
//   return noteParams;
// }

// function getNoteParamsForMakeOrder(owner, amount, type, viewKey, salt, isSmart) {
//   const paddedO = _toPadedObject(owner, amount, type, viewKey, salt, isSmart);
//   const { noteOwner } = paddedO;
//   const { splittedNoteOwner } = paddedO;
//   const { noteValue } = paddedO;
//   const { noteType } = paddedO;
//   const { noteViewKey } = paddedO;
//   const { splittedNoteViewKey } = paddedO;
//   const { noteSalt } = paddedO;
//   const { noteIsSmart } = paddedO;

//   // To be hashed, raw note info
//   const note = splittedNoteOwner.join('') + noteValue + noteType + splittedNoteViewKey.join('') + noteSalt + noteIsSmart;

//   const noteHash = toHashed(note);

//   const noteParams = noteHash.concat(noteType, splittedNoteOwner, noteValue, splittedNoteViewKey, noteSalt, noteIsSmart);

//   // console.log(noteParams); //for check parameters
//   return noteParams;
// }

// function getNoteParamsForTakeOrder(owner, amount, type, viewKey, salt, isSmart) {
//   const paddedO = _toPadedObject(owner, amount, type, viewKey, salt, isSmart);
//   const { noteOwner } = paddedO;
//   const { splittedNoteOwner } = paddedO;
//   const { noteValue } = paddedO;
//   const { noteType } = paddedO;
//   const { noteViewKey } = paddedO;
//   const { splittedNoteViewKey } = paddedO;
//   const { noteSalt } = paddedO;
//   const { noteIsSmart } = paddedO;

//   // To be hashed, raw note info
//   const note = splittedNoteOwner.join('') + noteValue + noteType + splittedNoteViewKey.join('') + noteSalt + noteIsSmart;

//   const noteHash = toHashed(note);

//   const noteParams = noteHash.concat(noteType, splittedNoteOwner, noteValue, splittedNoteViewKey, noteSalt, noteIsSmart);

//   // console.log(noteParams); //for check parameters
//   return noteParams;
// }

// function getNoteParamsForSettleOrder(owner, amount, type, viewKey, salt, isSmart) {
//   const paddedO = _toPadedObject(owner, amount, type, viewKey, salt, isSmart);
//   const { noteOwner } = paddedO;
//   const { splittedNoteOwner } = paddedO;
//   const { noteValue } = paddedO;
//   const { noteType } = paddedO;
//   const { noteViewKey } = paddedO;
//   const { splittedNoteViewKey } = paddedO;
//   const { noteSalt } = paddedO;
//   const { noteIsSmart } = paddedO;

//   // To be hashed, raw note info
//   const note = splittedNoteOwner.join('') + noteValue + noteType + splittedNoteViewKey.join('') + noteSalt + noteIsSmart;

//   const noteHash = toHashed(note);

//   const noteParams = noteHash.concat(noteType, splittedNoteOwner, noteValue, splittedNoteViewKey, noteSalt, noteIsSmart);

//   // console.log(noteParams); //for check parameters
//   return noteParams;
// }

function _toPadedObject(owner, value, type, viewKey, salt) {
  // all params should look like this "0001"(o), "0x0001"(x)
  const noteOwner = new BN(owner, 16).toString(16, 64) // 256bits
  let splittedNoteOwner;
  let isSmartNote = isSmart(owner);
  if (isSmartNote) {
    splittedNoteOwner = _checkLenAndReturn(noteOwner)
  } else {
    splittedNoteOwner = _split160(noteOwner)
  }
  const noteValue = new BN(value, 16).toString(16, 64); // 256bits
  const noteType = new BN(type, 16).toString(16, 32); // 256bits
  const noteViewKey = new BN(viewKey, 16).toString(16, 64); // 256bits
  const splittedNoteViewKey = _checkLenAndReturn(noteViewKey);
  const noteSalt = new BN(salt, 16).toString(16, 32); // 256bits

  const result = {
    noteOwner,
    splittedNoteOwner,
    noteValue,
    noteType,
    noteViewKey,
    splittedNoteViewKey,
    noteSalt,
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
    splittedData = ['0'.repeat(32), '0'.repeat(32 - targetLen).concat(targetHex.slice(0, 32))];
  } else if (targetLen > 32 && targetLen < 64) {
    splittedData = ['0'.repeat(remainLen).concat(targetHex.slice(0, 32 - remainLen)), targetHex.slice(32 - remainLen)];
  } else {
    splittedData = [targetHex.slice(0, 32), targetHex.slice(32)];
  }

  return splittedData;
}

function isSmart(owner) {
  const noteOwner = new BN(owner, 16)
  const address_value = 2**160
  const address = new BN(address_value.toString(16), 16)
  if (noteOwner.cmp(address) == 1) {
    return true
  } 
  return false
}

function _split160(targetHex) {
  const splittedData = ['0'.repeat(24), targetHex.slice(24)]
  return splittedData
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
  toHashed,
};