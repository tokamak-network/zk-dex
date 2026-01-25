const fs = require('fs');
const BN = require('bn.js');
const crypto = require('crypto');
const Web3Utils = require('web3-utils');

const SCALING_FACTOR = new BN('1000000000000000000');

/**
 * Compute note hash with address-based ownership (160-bit)
 * Hash format: SHA256(ownerAddress || value || type || vk0 || vk1 || salt)
 *
 * @param {String} ownerAddress - 160-bit owner address (40 hex chars without 0x)
 * @param {String} value - 256-bit value (64 hex chars without 0x)
 * @param {String} type - 256-bit token type (64 hex chars without 0x)
 * @param {String} viewKey - 256-bit viewing key (64 hex chars without 0x)
 * @param {String} salt - 256-bit salt (64 hex chars without 0x)
 * @returns {String} - 256-bit hash (64 hex chars without 0x)
 */
function getNoteHash(ownerAddress, value, type, viewKey, salt) {
  const paddedO = _toPaddedObject(ownerAddress, value, type, viewKey, salt);
  const { noteOwnerAddress } = paddedO;
  const { noteValue } = paddedO;
  const { noteType } = paddedO;
  const { splittedNoteViewKey } = paddedO;
  const { noteSalt } = paddedO;

  // Build hash input: ownerAddress(160) + value(256) + type(256) + vk0(128) + vk1(128) + salt(256)
  // Total: 1184 bits = 296 hex chars
  const note = noteOwnerAddress + noteValue + noteType + splittedNoteViewKey.join('') + noteSalt;

  const hashArr = toHashed(note);

  return hashArr[0] + hashArr[1];
}

/**
 * Get note parameters for circuit input
 * @param {String} ownerAddress - 160-bit owner address
 * @param {String} value - 256-bit value
 * @param {String} type - 256-bit token type
 * @param {String} viewKey - 256-bit viewing key
 * @param {String} salt - 256-bit salt
 * @returns {Array} - Array of note parameters including hash
 */
function getNoteParams(ownerAddress, value, type, viewKey, salt) {
  const paddedO = _toPaddedObject(ownerAddress, value, type, viewKey, salt);
  const { noteOwnerAddress } = paddedO;
  const { noteValue } = paddedO;
  const { noteType } = paddedO;
  const { splittedNoteViewKey } = paddedO;
  const { noteSalt } = paddedO;

  // Build hash input
  const note = noteOwnerAddress + noteValue + noteType + splittedNoteViewKey.join('') + noteSalt;
  const noteHash = toHashed(note);
  const noteParams = noteHash.concat(noteOwnerAddress, noteValue, noteType, splittedNoteViewKey, noteSalt);

  return noteParams;
}

/**
 * Pad all note fields to their expected sizes
 * @param {String} ownerAddress - Owner address (160 bits)
 * @param {String} value - Note value (256 bits)
 * @param {String} type - Token type (256 bits)
 * @param {String} viewKey - Viewing key (256 bits)
 * @param {String} salt - Salt (256 bits)
 * @returns {Object} - Padded fields
 */
function _toPaddedObject(ownerAddress, value, type, viewKey, salt) {
  // ownerAddress is 160 bits = 40 hex chars
  const noteOwnerAddress = new BN(ownerAddress || '0', 16).toString(16, 40);

  // value, type, salt are 256 bits = 64 hex chars each
  const noteValue = new BN(value || '0', 16).toString(16, 64);
  const noteType = new BN(type || '0', 16).toString(16, 64);
  const noteSalt = new BN(salt || '0', 16).toString(16, 64);

  // viewKey is 256 bits, split into two 128-bit parts (32 hex chars each)
  const noteViewKey = new BN(viewKey || '0', 16).toString(16, 64);
  const splittedNoteViewKey = _splitViewKey(noteViewKey);

  const result = {
    noteOwnerAddress,
    noteValue,
    noteType,
    noteViewKey,
    splittedNoteViewKey,
    noteSalt,
  };

  return result;
}

/**
 * Split viewing key into two 128-bit parts
 * @param {String} viewKeyHex - 64 hex char viewing key
 * @returns {Array} - [vk0 (32 hex), vk1 (32 hex)]
 */
function _splitViewKey(viewKeyHex) {
  const padded = viewKeyHex.padStart(64, '0');
  return [padded.slice(0, 32), padded.slice(32)];
}

/**
 * Get smart note owner address from origin note hash
 * Takes the last 160 bits of the hash
 * @param {String} noteHash - 256-bit note hash (64 hex chars)
 * @returns {String} - 160-bit address (40 hex chars)
 */
function getSmartNoteOwner(noteHash) {
  const padded = noteHash.padStart(64, '0');
  return padded.slice(-40);
}

/**
 * Compute SHA256 hash of hex-encoded data
 * @param {String} encodedValue - Hex string to hash
 * @returns {Array} - [hash0 (32 hex), hash1 (32 hex)]
 */
function toHashed(encodedValue) {
  const buf = Buffer.from(encodedValue, 'hex');
  const digest = crypto.createHash('sha256').update(buf).digest('hex');
  // split into 128 bits each (32 hex chars each)
  return [digest.slice(0, 32), digest.slice(32)];
}

module.exports = {
  getNoteHash,
  getNoteParams,
  getSmartNoteOwner,
  toHashed,
};
