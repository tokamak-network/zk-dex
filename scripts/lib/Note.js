const crypto = require('crypto');
const Web3Utils = require('web3-utils');

const {
  marshal,
  unmarshal,
  split32BytesTo16BytesArr,
} = require('./util');

const circomlibBabyJub = require('./circomlibBabyJub');

const mode = 'aes-256-cbc';

const ETH_TOKEN_TYPE = Web3Utils.padLeft('0x0', 64);
const DAI_TOKEN_TYPE = Web3Utils.padLeft('0x1', 64);

const { BN } = Web3Utils;
const SCALING_FACTOR = new BN('1000000000000000000');
const MAX_FIELD_VALUE = new BN('21888242871839275222246405745257275088548364400416034343698204186575808495616')

// --- Poseidon state (initialized via init()) ---
let _poseidon = null;
let _poseidonF = null;
let _EMPTY_NOTE_HASH = null;

/**
 * Initialize Poseidon hash function.
 * Must be called once before using Note.hash() or EMPTY_NOTE_HASH.
 */
async function init() {
    if (!_poseidon) {
        _poseidon = await circomlibBabyJub.getPoseidon();
        _poseidonF = _poseidon.F;
    }
    if (!_EMPTY_NOTE_HASH) {
        _EMPTY_NOTE_HASH = EMPTY_NOTE.hash();
    }
    return _EMPTY_NOTE_HASH;
}

// --- Poseidon helpers ---

function _hexToBigInt(hex) {
    if (typeof hex === 'bigint') return hex;
    if (typeof hex === 'number') return BigInt(hex);
    if (typeof hex === 'string') {
        if (!hex || hex === '0x0' || hex === '0x00') return BigInt(0);
        return BigInt(hex.startsWith('0x') ? hex : '0x' + hex);
    }
    return BigInt(0);
}

function _split256To128(value) {
    const big = _hexToBigInt(value);
    const mask = (BigInt(1) << BigInt(128)) - BigInt(1);
    return [big >> BigInt(128), big & mask];
}

const NoteState = {
  Invalid: Web3Utils.toBN('0'),
  Valid: Web3Utils.toBN('1'),
  Traiding: Web3Utils.toBN('2'),
  Spent: Web3Utils.toBN('3'),

  toString(s) {
    if (this.Invalid.cmp(s) === 0) { return 'Invalid'; }
    if (this.Valid.cmp(s) === 0) { return 'Valid'; }
    if (this.Traiding.cmp(s) === 0) { return 'Traiding'; }
    if (this.Spent.cmp(s) === 0) { return 'Spent'; }

    throw new Error(`Undefined state: ${s}`);
  },
};

/**
 * Note class with address-based ownership (160-bit)
 * Uses Poseidon hash: hash = Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)
 *
 * IMPORTANT: Call init() once before using hash().
 */
class Note {
  /**
   * @param { String | BN } ownerAddress 160-bit address
   * @param { String | BN } value The amount of token
   * @param { String | BN } token The type of token
   * @param { String | BN } viewingKey The viewing key of the sender
   * @param { String | BN } salt Random salt to prevent pre-image attack on note hash
   */
  constructor(ownerAddress, value, token, viewingKey, salt) {
    // ownerAddress is 160-bit (40 hex chars)
    this.ownerAddress = Web3Utils.padLeft(ownerAddress, 40);
    this.value = Web3Utils.padLeft(Web3Utils.toHex(value), 64);
    this.token = Web3Utils.padLeft(Web3Utils.toHex(token), 64);
    this.viewingKey = Web3Utils.padLeft(Web3Utils.toHex(viewingKey), 64);
    this.salt = Web3Utils.padLeft(Web3Utils.toHex(salt), 64);
  }

  /**
   * @returns { String } The owner address (160-bit)
   */
  getOwner() {
    return this.ownerAddress;
  }

  /**
   * Compute Poseidon note hash (synchronous, requires init() first)
   * hash = Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)
   * @returns { String } 0x-prefixed 64-char hex string
   */
  hash() {
    if (!_poseidon) {
      throw new Error('Poseidon not initialized. Call init() before using Note.hash()');
    }
    const [vk0, vk1] = _split256To128(this.viewingKey);
    const hash = _poseidon([
      _hexToBigInt(this.ownerAddress),
      _hexToBigInt(this.value),
      _hexToBigInt(this.token),
      vk0,
      vk1,
      _hexToBigInt(this.salt)
    ]);
    return '0x' + _poseidonF.toObject(hash).toString(16).padStart(64, '0');
  }

  hashArr() {
    return split32BytesTo16BytesArr(this.hash());
  }

  toString() {
    return JSON.stringify(this);
  }

  encrypt(encKey) {
    const key = marshalEncDecKey(encKey);
    const cipher = crypto.createCipher(mode, key);

    const r1 = cipher.update(this.toString(), 'utf8', 'base64');
    const r2 = cipher.final('base64');

    return marshal(
      Web3Utils.fromAscii(r1 + r2),
    );
  }
}

/**
 * Get smart note owner address from a note hash (Poseidon version)
 * Smart note owner = lower 160 bits of the Poseidon note hash
 * @param {String} noteHash - Note hash (hex string)
 * @returns {String} - 160-bit address (hex string with 0x prefix)
 */
function getSmartNoteOwner(noteHash) {
  const hashBigInt = _hexToBigInt(noteHash);
  const mask160 = (BigInt(1) << BigInt(160)) - BigInt(1);
  const address = hashBigInt & mask160;
  return '0x' + address.toString(16).padStart(40, '0');
}

/**
 * Create a smart note with owner derived from origin note hash
 * @param {Note} originNote - The origin note whose hash becomes the owner
 * @param {String|BN} value - Note value
 * @param {String|BN} token - Token type
 * @param {String|BN} viewingKey - Viewing key
 * @param {String|BN} salt - Salt
 * @returns {Note} - Smart note with owner = truncated origin hash
 */
function createSmartNote(originNote, value, token, viewingKey, salt) {
  const originHash = originNote.hash();
  const smartOwner = getSmartNoteOwner(originHash);
  return new Note(smartOwner, value, token, viewingKey, salt);
}

function marshalEncDecKey(_key) {
  const key = unmarshal(_key.toLowerCase());
  const reg = new RegExp(/^0*(.+)/, 'g');
  const match = reg.exec(key);

  let res = match[1];

  if (!res) {
    throw new Error("Failed to marshal key:", _key);
  }

  if (res.length % 2 === 1) {
    res = '0' + res;
  }

  return res;
}

function decrypt(v, decKey) {
  const key = marshalEncDecKey(decKey);
  if (!v) {
    throw new Error(`invalid value to decrypt: ${v}`);
  }

  const decipher = crypto.createDecipher(mode, key);

  const r1 = decipher.update(Web3Utils.toAscii(v), 'base64', 'utf8');
  const r2 = decipher.final('utf8');

  const note = JSON.parse(r1 + r2);
  return new Note(note.ownerAddress, note.value, note.token, note.viewingKey, note.salt);
}

// --- Dummy proof functions (Groth16 / Poseidon format) ---
// Used in development mode only (proofs are not verified)

// MintNBurnNote: [output, noteHash, value, tokenType]
function dummyProofCreateNote(note) {
  return {
    a: ['0x1', '0x2'],
    b: [['0x3', '0x4'], ['0x5', '0x6']],
    c: ['0x7', '0x8'],
    input: [
      1,
      note.hash(),
      note.value,
      note.token,
    ]
  };
}

// TransferNote: [output, o0Hash, o1Hash, newHash, changeHash]
function dummyProofSpendNote(oldNote0, oldNote1, newNote, changeNote) {
  return {
    a: ['0x1', '0x2'],
    b: [['0x3', '0x4'], ['0x5', '0x6']],
    c: ['0x7', '0x8'],
    input: [
      1,
      oldNote0.hash(),
      (oldNote1 || EMPTY_NOTE).hash(),
      newNote.hash(),
      changeNote.hash(),
    ]
  };
}

// ConvertNote: [output, smartHash, originHash, newHash]
function dummyProofConvertNote(smartNote, originNote, convertedNote) {
  return {
    a: ['0x1', '0x2'],
    b: [['0x3', '0x4'], ['0x5', '0x6']],
    c: ['0x7', '0x8'],
    input: [
      1,
      smartNote.hash(),
      originNote.hash(),
      convertedNote.hash(),
    ]
  };
}

// MakeOrder: [output, noteHash, tokenType]
function dummyProofMakeOrder(makerNote) {
  return {
    a: ['0x1', '0x2'],
    b: [['0x3', '0x4'], ['0x5', '0x6']],
    c: ['0x7', '0x8'],
    input: [
      1,
      makerNote.hash(),
      makerNote.token,
    ]
  };
}

// TakeOrder: [output, oldNoteHash, oldType, newNoteHash, newOwnerAddress, newType]
function dummyProofTakeOrder(parentNote, stakeNote) {
  return {
    a: ['0x1', '0x2'],
    b: [['0x3', '0x4'], ['0x5', '0x6']],
    c: ['0x7', '0x8'],
    input: [
      1,
      parentNote.hash(),
      parentNote.token,
      stakeNote.hash(),
      stakeNote.ownerAddress,
      stakeNote.token,
    ]
  };
}

// SettleOrder: [output, o0Hash, o0Type, o1Hash, o1Type,
//               n0Hash, n0OwnerAddress, n0Type,
//               n1Hash, n1OwnerAddress, n1Type,
//               n2Hash, n2Type, price]
function dummyProofSettleOrder(makerNote, stakeNote, rewardNote, paymentNote, changeNote, price) {
  return {
    a: ['0x1', '0x2'],
    b: [['0x3', '0x4'], ['0x5', '0x6']],
    c: ['0x7', '0x8'],
    input: [
      1,
      makerNote.hash(),
      makerNote.token,
      stakeNote.hash(),
      stakeNote.token,
      rewardNote.hash(),
      rewardNote.ownerAddress,
      rewardNote.token,
      paymentNote.hash(),
      paymentNote.ownerAddress,
      paymentNote.token,
      changeNote.hash(),
      changeNote.token,
      price,
    ]
  };
}

const EMPTY_NOTE = new Note('0x00', '0x00', '0x00', '0x00', '0x00');

const constants = {
    MAX_FIELD_VALUE,
    ETH_TOKEN_TYPE,
    DAI_TOKEN_TYPE,
    get EMPTY_NOTE_HASH() { return _EMPTY_NOTE_HASH; },
    EMPTY_NOTE,
};

module.exports = {
  init,
  constants,
  NoteState,
  Note,
  decrypt,
  getSmartNoteOwner,
  createSmartNote,
  createProof: {
    dummyProofCreateNote,
    dummyProofSpendNote,
    dummyProofLiquidateNote: dummyProofCreateNote,
    dummyProofConvertNote,
    dummyProofMakeOrder,
    dummyProofTakeOrder,
    dummyProofSettleOrder,
  },
};
