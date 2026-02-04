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
 * Initialize the Poseidon hash function and compute the empty note hash.
 * Must be called once before using Note.hash() or EMPTY_NOTE_HASH.
 * @returns {Promise<string>} The computed empty note hash
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

/**
 * Convert a hex string, number, or bigint to a BigInt value.
 * Handles 0x-prefixed hex strings, plain numbers, and existing bigints.
 * Returns BigInt(0) for falsy, '0x0', or '0x00' inputs.
 * @param {string|number|bigint} hex - The value to convert
 * @returns {bigint} The converted BigInt value
 */
function _hexToBigInt(hex) {
    if (typeof hex === 'bigint') return hex;
    if (typeof hex === 'number') return BigInt(hex);
    if (typeof hex === 'string') {
        if (!hex || hex === '0x0' || hex === '0x00') return BigInt(0);
        return BigInt(hex.startsWith('0x') ? hex : '0x' + hex);
    }
    return BigInt(0);
}

/**
 * Split a 256-bit value into its high and low 128-bit halves.
 * @param {string|number|bigint} value - The 256-bit value to split (hex string, number, or bigint)
 * @returns {bigint[]} An array of two bigints: [highBits, lowBits]
 */
function _split256To128(value) {
    const big = _hexToBigInt(value);
    const mask = (BigInt(1) << BigInt(128)) - BigInt(1);
    return [big >> BigInt(128), big & mask];
}

const NoteState = {
  Invalid: Web3Utils.toBN('0'),
  Valid: Web3Utils.toBN('1'),
  Trading: Web3Utils.toBN('2'),
  Spent: Web3Utils.toBN('3'),

  /**
   * Convert a numeric note state to its human-readable string name.
   * @param {BN} s - The note state as a BN (0=Invalid, 1=Valid, 2=Trading, 3=Spent)
   * @returns {string} The state name ('Invalid', 'Valid', 'Trading', or 'Spent')
   */
  toString(s) {
    if (this.Invalid.cmp(s) === 0) { return 'Invalid'; }
    if (this.Valid.cmp(s) === 0) { return 'Valid'; }
    if (this.Trading.cmp(s) === 0) { return 'Trading'; }
    if (this.Spent.cmp(s) === 0) { return 'Spent'; }

    throw new Error(`Undefined state: ${s}`);
  },
};

/**
 * Note class with 7-input Poseidon hash
 * hash = Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)
 *
 * Regular notes: owner0=pkX, owner1=pkY, vk0=pkX, vk1=pkY
 * Smart notes: owner0=parentHash>>128, owner1=parentHash&MASK_128, vk0=owner0, vk1=owner1
 *
 * IMPORTANT: Call init() once before using hash().
 */
class Note {
  /**
   * @param { String | BN } owner0 - Owner field 0 (regular: pkX, smart: parentHash_hi)
   * @param { String | BN } owner1 - Owner field 1 (regular: pkY, smart: parentHash_lo)
   * @param { String | BN } value - The amount of token
   * @param { String | BN } token - The type of token
   * @param { String | BN } vk0 - Viewing key part 0 (regular: pkX, smart: owner0)
   * @param { String | BN } vk1 - Viewing key part 1 (regular: pkY, smart: owner1)
   * @param { String | BN } salt - Random salt to prevent pre-image attack on note hash
   */
  constructor(owner0, owner1, value, token, vk0, vk1, salt) {
    this.owner0 = Web3Utils.padLeft(Web3Utils.toHex(owner0), 64);
    this.owner1 = Web3Utils.padLeft(Web3Utils.toHex(owner1), 64);
    this.value = Web3Utils.padLeft(Web3Utils.toHex(value), 64);
    this.token = Web3Utils.padLeft(Web3Utils.toHex(token), 64);
    this.vk0 = Web3Utils.padLeft(Web3Utils.toHex(vk0), 64);
    this.vk1 = Web3Utils.padLeft(Web3Utils.toHex(vk1), 64);
    this.salt = Web3Utils.padLeft(Web3Utils.toHex(salt), 64);
  }

  /**
   * Compute Poseidon note hash
   * hash = Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)
   * @returns { String } 0x-prefixed 64-char hex string
   * Note: Automatically initializes Poseidon on first call (synchronous contexts only)
   */
  hash() {
    if (!_poseidon) {
      // For synchronous contexts, throw a helpful error
      throw new Error('Poseidon not initialized. Call await init() before using Note.hash()');
    }
    const hash = _poseidon([
      _hexToBigInt(this.owner0),
      _hexToBigInt(this.owner1),
      _hexToBigInt(this.value),
      _hexToBigInt(this.token),
      _hexToBigInt(this.vk0),
      _hexToBigInt(this.vk1),
      _hexToBigInt(this.salt)
    ]);
    return '0x' + _poseidonF.toObject(hash).toString(16).padStart(64, '0');
  }

  /**
   * Compute the Poseidon note hash and split it into an array of two 16-byte hex strings.
   * @returns {string[]} An array of two hex strings representing the high and low halves of the hash
   */
  hashArr() {
    return split32BytesTo16BytesArr(this.hash());
  }

  /**
   * For smart notes: reconstruct parentHash from (owner0, owner1).
   * parentHash = owner0 * 2^128 + owner1
   * @returns {string} 0x-prefixed 64-char hex string
   */
  getParentHash() {
    const hi = _hexToBigInt(this.owner0);
    const lo = _hexToBigInt(this.owner1);
    const parentHash = (hi << BigInt(128)) + lo;
    return '0x' + parentHash.toString(16).padStart(64, '0');
  }

  /**
   * Get the 160-bit owner address.
   * Both regular and smart notes: first 32 bits of owner0 + all 128 bits of owner1
   * This equals: hash[0:8] + hash[32:64] in hex (40 chars = 160 bits)
   * @returns {string} 0x-prefixed 40-char hex string (160 bits)
   */
  get ownerAddress() {
    // Reconstruct owner hash: owner0 << 128 + owner1
    const owner0BigInt = _hexToBigInt(this.owner0);
    const owner1BigInt = _hexToBigInt(this.owner1);
    const ownerHash = (owner0BigInt << BigInt(128)) + owner1BigInt;
    const ownerHashHex = ownerHash.toString(16).padStart(64, '0');

    // Take first 32 bits (8 hex chars) + last 128 bits (32 hex chars) = 160 bits (40 hex chars)
    const address = ownerHashHex.slice(0, 8) + ownerHashHex.slice(32, 64);
    return '0x' + address;
  }

  /**
   * Serialize the note to a JSON string representation.
   * @returns {string} A JSON string containing all note fields
   */
  toString() {
    return JSON.stringify(this);
  }

  /**
   * Encrypt the note using AES-256-CBC with the given encryption key.
   * The note is serialized to JSON, encrypted, and the ciphertext is marshalled to a hex string.
   * @param {string} encKey - The encryption key (hex-encoded)
   * @returns {string} The encrypted note as a marshalled hex string
   */
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
 * Create a smart note with owner derived from origin note hash.
 * Smart note: owner0=parentHash_hi, owner1=parentHash_lo, vk0=owner0, vk1=owner1
 * @param {Note} originNote - The origin note whose hash becomes the parent
 * @param {String|BN} value - Note value
 * @param {String|BN} token - Token type
 * @param {String|BN} salt - Salt
 * @returns {Note} - Smart note with split parent hash as owner
 */
function createSmartNote(originNote, value, token, salt) {
  const originHash = originNote.hash();
  const [hi, lo] = _split256To128(originHash);
  // Smart note: owner = split(parentHash), vk = owner
  return new Note(
    '0x' + hi.toString(16).padStart(64, '0'),
    '0x' + lo.toString(16).padStart(64, '0'),
    value,
    token,
    '0x' + hi.toString(16).padStart(64, '0'),
    '0x' + lo.toString(16).padStart(64, '0'),
    salt
  );
}

/**
 * Marshal an encryption/decryption key by stripping the 0x prefix, lowering case,
 * and removing leading zeros to produce a clean hex key string.
 * @param {string} _key - The raw key as a hex string (with or without 0x prefix)
 * @returns {string} The cleaned and normalized key string suitable for AES operations
 */
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

/**
 * Decrypt an encrypted note string using AES-256-CBC and reconstruct the Note object.
 * @param {string} v - The encrypted note data as a marshalled hex string
 * @param {string} decKey - The decryption key (hex-encoded)
 * @returns {Note} The decrypted and reconstructed Note instance
 */
function decrypt(v, decKey) {
  const key = marshalEncDecKey(decKey);
  if (!v) {
    throw new Error(`invalid value to decrypt: ${v}`);
  }

  const decipher = crypto.createDecipher(mode, key);

  const r1 = decipher.update(Web3Utils.toAscii(v), 'base64', 'utf8');
  const r2 = decipher.final('utf8');

  const note = JSON.parse(r1 + r2);
  return new Note(note.owner0, note.owner1, note.value, note.token, note.vk0, note.vk1, note.salt);
}

// --- Dummy proof functions (Groth16 / Poseidon format) ---
// Used in development mode only (proofs are not verified)

/**
 * Generate a dummy proof for the MintNBurnNote circuit (development mode only).
 * Public inputs: [output, noteHash, value, tokenType].
 * @param {Note} note - The note for which to create a dummy mint/burn proof
 * @returns {Object} A dummy Groth16 proof object with placeholder a, b, c values and computed public inputs
 */
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

/**
 * Generate a dummy proof for the TransferNote circuit (development mode only).
 * Public inputs: [output, o0Hash, o1Hash, newHash, changeHash].
 * @param {Note} oldNote0 - The first input note being spent
 * @param {Note|null} oldNote1 - The second input note being spent (null uses EMPTY_NOTE)
 * @param {Note} newNote - The new output note for the recipient
 * @param {Note} changeNote - The change note returned to the sender
 * @returns {Object} A dummy Groth16 proof object with placeholder a, b, c values and computed public inputs
 */
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

/**
 * Generate a dummy proof for the ConvertNote circuit (development mode only).
 * Public inputs: [output, smartHash, originHash, newHash].
 * @param {Note} smartNote - The smart note (stake note) being converted
 * @param {Note} originNote - The original note that owns the smart note
 * @param {Note} convertedNote - The new note created from conversion
 * @returns {Object} A dummy Groth16 proof object with placeholder a, b, c values and computed public inputs
 */
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

/**
 * Generate a dummy proof for the MakeOrder circuit (development mode only).
 * Public inputs: [output, noteHash, tokenType].
 * @param {Note} makerNote - The maker's note being placed as an order
 * @returns {Object} A dummy Groth16 proof object with placeholder a, b, c values and computed public inputs
 */
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

/**
 * Generate a dummy proof for the TakeOrder circuit (development mode only).
 * Public inputs: [output, oldNoteHash, oldType, newNoteHash, newParentHash, newType].
 * @param {Note} parentNote - The taker's parent note being committed
 * @param {Note} stakeNote - The stake note created with maker note hash as owner
 * @returns {Object} A dummy Groth16 proof object with placeholder a, b, c values and computed public inputs
 */
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
      stakeNote.getParentHash(),
      stakeNote.token,
    ]
  };
}

/**
 * Generate a dummy proof for the SettleOrder circuit (development mode only).
 * Public inputs: [output, o0Hash, o0Type, o1Hash, o1Type,
 *                 n0Hash, n0ParentHash, n0Type,
 *                 n1Hash, n1ParentHash, n1Type,
 *                 n2Hash, n2Type, price].
 * @param {Note} makerNote - The maker's original note (o0)
 * @param {Note} stakeNote - The taker's stake note (o1)
 * @param {Note} rewardNote - The reward note for the taker (n0)
 * @param {Note} paymentNote - The payment note for the maker (n1)
 * @param {Note} changeNote - The change note for remaining value (n2)
 * @param {string|number} price - The order settlement price
 * @returns {Object} A dummy Groth16 proof object with placeholder a, b, c values and computed public inputs
 */
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
      rewardNote.getParentHash(),
      rewardNote.token,
      paymentNote.hash(),
      paymentNote.getParentHash(),
      paymentNote.token,
      changeNote.hash(),
      changeNote.token,
      price,
    ]
  };
}

const EMPTY_NOTE = new Note('0x00', '0x00', '0x00', '0x00', '0x00', '0x00', '0x00');

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
  createSmartNote,
  // Shared hash utilities (used by snarkjsUtils.js)
  _hexToBigInt,
  _split256To128,
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
