const BN = require('bn.js');
const Web3Utils = require('web3-utils');
const circomlibBabyJub = require('../lib/circomlibBabyJub');

const SCALING_FACTOR = new BN('1000000000000000000');

// Poseidon state (initialized via init())
let _poseidon = null;
let _poseidonF = null;

/**
 * Initialize Poseidon hash function.
 * Must be called once before using getNoteHash().
 */
async function init() {
    if (!_poseidon) {
        _poseidon = await circomlibBabyJub.getPoseidon();
        _poseidonF = _poseidon.F;
    }
}

function _hexToBigInt(hex) {
    if (typeof hex === 'bigint') return hex;
    if (typeof hex === 'number') return BigInt(hex);
    if (typeof hex === 'string') {
        if (!hex || hex === '0' || hex === '0x0' || hex === '0x00') return BigInt(0);
        return BigInt(hex.startsWith('0x') ? hex : '0x' + hex);
    }
    return BigInt(0);
}

function _split256To128(value) {
    const big = _hexToBigInt(value);
    const mask = (BigInt(1) << BigInt(128)) - BigInt(1);
    return [big >> BigInt(128), big & mask];
}

/**
 * Compute note hash using Poseidon (synchronous after init())
 * hash = Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)
 *
 * @param {String} ownerAddress - 160-bit owner address (hex without 0x)
 * @param {String} value - 256-bit value (hex without 0x)
 * @param {String} type - 256-bit token type (hex without 0x)
 * @param {String} viewKey - 256-bit viewing key (hex without 0x)
 * @param {String} salt - 256-bit salt (hex without 0x)
 * @returns {String} - Poseidon hash as 64 hex chars (without 0x)
 */
function getNoteHash(ownerAddress, value, type, viewKey, salt) {
  if (!_poseidon) {
    throw new Error('Poseidon not initialized. Call init() before using getNoteHash()');
  }

  const [vk0, vk1] = _split256To128(viewKey);
  const hash = _poseidon([
    _hexToBigInt(ownerAddress),
    _hexToBigInt(value),
    _hexToBigInt(type),
    vk0,
    vk1,
    _hexToBigInt(salt)
  ]);
  return _poseidonF.toObject(hash).toString(16).padStart(64, '0');
}

/**
 * Get smart note owner address from origin note hash (Poseidon version)
 * Takes the last 160 bits of the hash
 * @param {String} noteHash - 256-bit note hash (64 hex chars)
 * @returns {String} - 160-bit address (40 hex chars)
 */
function getSmartNoteOwner(noteHash) {
  const hashBigInt = _hexToBigInt(noteHash);
  const mask160 = (BigInt(1) << BigInt(160)) - BigInt(1);
  const address = hashBigInt & mask160;
  return address.toString(16).padStart(40, '0');
}

module.exports = {
  init,
  getNoteHash,
  getSmartNoteOwner,
};
