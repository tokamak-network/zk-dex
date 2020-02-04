const fs = require('fs');
const BN = require('bn.js');
const crypto = require('crypto');
const Web3Utils = require('web3-utils');

const SCALING_FACTOR = new BN('1000000000000000000');

function getNoteHash(owner0, owner1, value, type, viewKey, salt) {

  const paddedO = _toPadedObject(owner0, owner1, value, type, viewKey, salt);
  const { noteOwner0 } = paddedO;
  const { noteOwner1 } = paddedO;
  const { noteValue } = paddedO;
  const { noteType } = paddedO;
  const { splittedNoteViewKey } = paddedO;
  const { noteSalt } = paddedO;

  const note = noteOwner0 + noteOwner1 + noteValue + noteType + splittedNoteViewKey.join('') + noteSalt;

  const hashArr = toHashed(note);

  return hashArr[0] + hashArr[1];
}

function getNoteParams(owner0, owner1, value, type, viewKey, salt) {
  const paddedO = _toPadedObject(owner0, owner1, value, type, viewKey, salt);
  const { noteOwner0 } = paddedO;
  const { noteOwner1 } = paddedO;
  const { noteValue } = paddedO;
  const { noteType } = paddedO;
  const { splittedNoteViewKey } = paddedO;
  const { noteSalt } = paddedO;

  // To be hashed, raw note info
  const note = noteOwner0 + noteOwner1 + noteValue + noteType + splittedNoteViewKey.join('') + noteSalt;
  const noteHash = toHashed(note);
  const noteParams = noteHash.concat(noteOwner0, noteOwner1, noteValue, noteType, splittedNoteViewKey, noteSalt);

  return noteParams;
}

function _toPadedObject(owner0, owner1, value, type, viewKey, salt) {
  // all params should look like this "0001"(o), "0x0001"(x)

  let noteOwner0; // 256bits
  let noteOwner1; // 256bits
  if (owner1 == null) {
    const noteHash = new BN(owner0, 16).toString(16, 64)
    noteOwner0 = splitNoteHash(noteHash)[0];
    noteOwner1 = splitNoteHash(noteHash)[1];
  } else {
    noteOwner0 = new BN(owner0, 16).toString(16, 64);
    noteOwner1 = new BN(owner1, 16).toString(16, 64);
  }

  const noteValue = new BN(value, 16).toString(16, 64); // 256bits
  const noteType = new BN(type, 16).toString(16, 64); // 256bits
  const noteViewKey = new BN(viewKey, 16).toString(16, 64); // 256bits
  const splittedNoteViewKey = _checkLenAndReturn(noteViewKey);
  const noteSalt = new BN(salt, 16).toString(16, 64); // 256bits

  const result = {
    noteOwner0,
    noteOwner1,
    noteValue,
    noteType,
    noteViewKey,
    splittedNoteViewKey,
    noteSalt,
  };

  return result;
}

function splitNoteHash(noteHash) {
  const noteHash0 = '0'.repeat(32) + noteHash.slice(0,32)
  const noteHash1 = '0'.repeat(32) + noteHash.slice(32)

  return [noteHash0, noteHash1]
}

function _checkLenAndReturn(targetHex) {
  let splittedData;
  const targetLen = targetHex.length;
  const remainLen = 64 - targetLen;

  if (targetHex === '0') {
    return ['0'.repeat(32), '0'.repeat(32)];
  }

  if (targetLen <= 32) {
    return [
      '0'.repeat(32),
      '0'.repeat(32 - targetLen).concat(targetHex),
    ];
  }

  if (targetLen > 32 && targetLen < 64) {
    return [
      '0'.repeat(remainLen).concat(targetHex.slice(0, 32 - remainLen)),
      targetHex.slice(32 - remainLen),
    ];
  }

  if (targetLen > 64) throw new Error(`viewing key length exceeds 32 bytes ${targetLen/2}`);

  return [targetHex.slice(0, 32), targetHex.slice(32)];
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