const crypto = require('crypto');
const Web3Utils = require('web3-utils');

const {
  marshal,
  unmarshal,
  split32BytesTo16BytesArr,
  parseProofObj,
} = require('./util');

const noteHelper = require('../helper/noteHelper');

const ETH_TOKEN_TYPE = Web3Utils.padLeft('0x0', 64);
const DAI_TOKEN_TYPE = Web3Utils.padLeft('0x1', 64);

const { BN } = Web3Utils;
const SCALING_FACTOR = new BN('1000000000000000000');

const MODE = 'aes-256-cbc';
const MAX_FIELD_VALUE = new BN('21888242871839275222246405745257275088548364400416034343698204186575808495616')

const sampleProof = `{
  "proof": {
    "A": ["0x1ebd3ba93ae1f0a7cb61c4c0223b2d3f593cd9ea7976cd5e5b47c6761456c847", "0x2044c32f4c51c765693a20c65217290d7b3e2ad6ead397f9390b673a17e96079"],
    "A_p": ["0x1df310dc80836414fb0332d06628eca5b172b56a4e6892a09f8a01069f47cc5a", "0x180361828a69a9b3165ef17661447d7b5b4061df0e1b2366e33e4b9765f0cfcc"],
    "B": [
      ["0x17a7b64179ee2c86f962a09a25ea39253401d0b054f159605118ce8ed83e22e5", "0x28c8b5151c180db95e9eb1ccba363fb798931f01d38591d3a6081328ce45c94c"],
      ["0x194a069c0a2b7c0f198a3d2a6c7753de5d9abe8956348a07d611bc782ffb0146", "0x6800507968aa736f3ee6b10c8ea7f5fcfd157858f11d36ca800becf7a96e525"]
    ],

    "B_p": ["0x2886bcd342c57300ac74e2a3ec3870bd6d82b13a66ab2bd3425a8a423e28df6d", "0x1445d5c9b234318356cd23d5889f12704529b05a3777b67a2a468d4f05c4d853"],
    "C": ["0x230a584beb0fcab0bfcde7ac17d4fe7b7399115018e1dffb2e3a42d68f84c90c", "0x24052feb5111e81d06043638d33a5d90bcc755ae22bafcef551d3ea8946b6ec7"],
    "C_p": ["0x6e7f7364bea9aef0f94b9a7695be1f4860d9e952ba12c988c12ee502665563f", "0x88053e7a885b8b2a052d2db836a20f0e1da7c3e7e4da9007fafc70baf0513b"],
    "H": ["0x2de3d197c35b71922e5f28d740f618e754c3385602ac096489c0d1cf0591b604", "0x11068548997da3e4631e1f8557fddc182ceab9b360e32377290d0d952367e624"],
    "K": ["0x219fd00e97e37d2ebfa37c5a42766c3af1b855d702839df857bf907af66e39be", "0x9ded2a2660333cd94bea038de71504c76a5b5b28837ac9ce0a02b4f19f29f1a"]
  },
  "input": []
}`;

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

class Note {
  /**
   *
   * @param { String | BN } pubKey0 x-coordinates of public key for normal note, original note hash for smart note
   * @param { String | BN | Null } pubKey1 y-coordinates of public key for normal note, null for smart note
   * @param { String | BN } value The amount of token
   * @param { String | BN } token The type of token
   * @param { String | BN } viewingKey The viewing key of the sender. It is only used when taker reveals his viewing key only to maker in encrypted note data.
   * @param { String | BN } salt Random salt to prevent pre-image attack on note hash.
   */
  constructor(pubKey0, pubKey1, value, token, viewingKey, salt) {
    this.pubKey0 = Web3Utils.padLeft(pubKey0, 64);

    this.pubKey1 = pubKey1 ? Web3Utils.padLeft(pubKey1, 64) : Web3Utils.padLeft(0, 64);

    this.value = Web3Utils.padLeft(Web3Utils.toHex(value), 64);
    this.token = Web3Utils.padLeft(Web3Utils.toHex(token), 64);
    this.viewingKey = Web3Utils.padLeft(Web3Utils.toHex(viewingKey), 64);
    this.salt = Web3Utils.padLeft(Web3Utils.toHex(salt), 32);
  }

  static hashFromJSON(v) {
    return this.fromJSON(v).hash();
  }

  /**
   *
   * @param { Object } v a JSON-encoded note
   * @param { String } v.pubKey0
   * @param { String } v.pubKey1
   * @param { String } v.value
   * @param { String } v.token
   * @param { String } v.viewingKey
   * @param { String } v.salt
   */
  static fromJSON(v) {
    console.log("v", v);
    const {
      pubKey0,
      pubKey1,
      value,
      token,
      viewingKey,
      salt,
    } = typeof v === 'object' ? v : JSON.parse(v);

    return new Note(pubKey0, pubKey1, value, token, viewingKey, salt);
  }

  isSmart() {
    return this.pubKey1 === Web3Utils.padLeft(0, 64);
  }

  /**
   * @returns { String | Array } Array of x and y coordinates of public key of the owner for normal note, or String of the original note hash for smart note.
   */
  getOwner() {
    if (this.isSmart()) {
      return this.pubKey0;
    }

    return [this.pubKey0, this.pubKey1];
  }

  hash() {
    return marshal(noteHelper.getNoteHash(
      unmarshal(this.pubKey0),
      this.pubKey1 ? unmarshal(this.pubKey1) : null,
      unmarshal(this.value),
      unmarshal(this.token),
      unmarshal(this.viewingKey),
      unmarshal(this.salt),
    ));
  }

  hashArr() {
    return split32BytesTo16BytesArr(this.hash());
  }

  toString() {
    return JSON.stringify(this);
  }

  encrypt(_encKey) {
    const encKey = marshalEncDecKey(_encKey);

    const v = this.toString();

    let cipher;
    let r1;
    let r2;
    try {
      cipher = crypto.createCipher(MODE, encKey);
      r1 = cipher.update(v, 'utf8', 'base64');
      r2 = cipher.final('base64');
    } catch (e) {
      throw new EncryptError("Failed to encrypt", v, encKey);
    }

    // console.warn(`Note#${this.hash()} is encrypted by ${encKey}`);

    return marshal(
      Web3Utils.fromAscii(r1 + r2),
    );
  }
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

class DecryptError extends Error {
  constructor(message, value, key) {
    super(message);
    this.value = value;
    this.key = key;
    Error.captureStackTrace(this, this.constructor);
  }
}
class EncryptError extends DecryptError {}

function decrypt(v, _decKey) {
  const decKey = marshalEncDecKey(_decKey);

  if (!v) {
    throw new Error(`invalid value to decrypt: ${v}`);
  }

  let decipher;
  let r1;
  let r2;

  try {
    decipher = crypto.createDecipher(MODE, decKey);
    r1 = decipher.update(Web3Utils.toAscii(v), 'base64', 'utf8');
    r2 = decipher.final('utf8');
  } catch (e) {
    throw new DecryptError(`Failed to decrypt`, v, decKey)
  }

  const str = r1 + r2;

  try {
    const note = JSON.parse(str);
    return new Note(note.pubKey0, note.pubKey1, note.value, note.token, note.viewingKey, note.salt);
  } catch (e) {
    console.error("Failed to parse decrypted note JSON", e);
    return null;
  }
}

function dummyProofCreateNote(note) {
  console.log("note", JSON.stringify(note, null, 2));

  note = Note.fromJSON(note);

  const proof = JSON.parse(sampleProof);

  proof.input = [
    ...note.hashArr(),
    note.value,
    note.token,
    1,
  ];

  return parseProofObj(proof);
}

function dummyProofSpendNote(
  oldNote0,
  oldNote1,
  newNote0,
  newNote1,
) {
  const proof = JSON.parse(sampleProof);

  console.log(`
oldNote0: ${JSON.stringify(oldNote0, null ,2)}
oldNote1: ${JSON.stringify(oldNote1, null ,2)}
newNote0: ${JSON.stringify(newNote0, null ,2)}
newNote1: ${JSON.stringify(newNote1, null ,2)}

${typeof oldNote1}: ${oldNote1}
  `)

  oldNote0 = oldNote0 && Note.fromJSON(oldNote0);
  oldNote1 = oldNote1 && Note.fromJSON(oldNote1);
  newNote0 = newNote0 && Note.fromJSON(newNote0);
  newNote1 = newNote1 && Note.fromJSON(newNote1);

  console.log(`
oldNote0: ${JSON.stringify(oldNote0, null ,2)}
oldNote1: ${JSON.stringify(oldNote1, null ,2)}
newNote0: ${JSON.stringify(newNote0, null ,2)}
newNote1: ${JSON.stringify(newNote1, null ,2)}

oldNote1 || EMPTY_NOTE: ${oldNote1 || EMPTY_NOTE}
  `)

  proof.input = [
    ...(oldNote0 || EMPTY_NOTE).hashArr(),
    ...(oldNote1 || EMPTY_NOTE).hashArr(),
    ...(newNote0 || EMPTY_NOTE).hashArr(),
    ...(newNote1 || EMPTY_NOTE).hashArr(),
    1,
  ];

  return parseProofObj(proof);
}

function dummyProofConvertNote(smartNote, originNote, convertedNote) {
  const proof = JSON.parse(sampleProof);

  proof.input = [
    ...smartNote.hashArr(),
    ...originNote.hashArr(),
    ...convertedNote.hashArr(),
    1,
  ];

  return parseProofObj(proof);
}

function dummyProofMakeOrder(_makerNote) {
  const proof = JSON.parse(sampleProof);

  const makerNote = Note.fromJSON(_makerNote);

  proof.input = [
    ...makerNote.hashArr(),
    makerNote.token,
    1,
  ];

  return parseProofObj(proof);
}

function dummyProofTakeOrder(_parentNote, _stakeNote) {
  const proof = JSON.parse(sampleProof);

  const parentNote = Note.fromJSON(parentNote);
  const stakeNote = Note.fromJSON(stakeNote);

  proof.input = [
    ...parentNote.hashArr(),
    parentNote.token,

    ...stakeNote.hashArr(),
    ...split32BytesTo16BytesArr(stakeNote.pubKey0),
    stakeNote.token,

    1,
  ];

  return parseProofObj(proof);
}

function dummyProofSettleOrder(_makerNote, _stakeNote, _rewardNote, _paymentNote, _changeNote, price) {
  const proof = JSON.parse(sampleProof);

  const makerNote = Note.fromJSON(_makerNote);
  const stakeNote = Note.fromJSON(_stakeNote);
  const rewardNote = Note.fromJSON(_rewardNote);
  const paymentNote = Note.fromJSON(_paymentNote);
  const changeNote = Note.fromJSON(_changeNote);

  proof.input = [
    ...makerNote.hashArr(),
    makerNote.token,

    ...stakeNote.hashArr(),
    stakeNote.token,

    ...rewardNote.hashArr(),
    ...split32BytesTo16BytesArr(rewardNote.pubKey0),
    rewardNote.token,

    ...paymentNote.hashArr(),
    ...split32BytesTo16BytesArr(paymentNote.pubKey0),
    paymentNote.token,

    ...changeNote.hashArr(),
    changeNote.token,

    price,

    1,
  ];

  return parseProofObj(proof);
}

const EMPTY_NOTE = new Note('0x00', '0x00', '0x00', '0x00', '0x00', '0x00');
const EMPTY_NOTE_HASH = EMPTY_NOTE.hash();

console.log('EMPTY_NOTE_HASH', EMPTY_NOTE_HASH);

module.exports = {
  constants: {
    MAX_FIELD_VALUE,
    ETH_TOKEN_TYPE,
    DAI_TOKEN_TYPE,
    EMPTY_NOTE_HASH,
    EMPTY_NOTE,
  },
  NoteState,
  Note,
  DecryptError,
  EncryptError,
  decrypt,
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
