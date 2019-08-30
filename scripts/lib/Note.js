const crypto = require('crypto');
const Web3Utils = require('web3-utils');

const util = require('./util');
const noteHelper = require('../helper/noteHelper');


const ETH_TOKEN_TYPE = Web3Utils.padLeft('0x0', 32);
const DAI_TOKEN_TYPE = Web3Utils.padLeft('0x1', 32);

const { BN } = Web3Utils;
const SCALING_FACTOR = new BN('1000000000000000000');

const MODE = 'aes-256-cbc';

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
  constructor(owner, value, token, viewingKey, salt, isSmart = false) {
    this.owner = Web3Utils.padLeft(Web3Utils.toHex(owner), 64);
    this.value = Web3Utils.padLeft(Web3Utils.toHex(value), 32);
    this.token = Web3Utils.padLeft(Web3Utils.toHex(token), 32);
    this.viewingKey = Web3Utils.padLeft(Web3Utils.toHex(viewingKey), 64);
    this.salt = Web3Utils.padLeft(Web3Utils.toHex(salt), 32);
    if (typeof isSmart === 'string') {
      isSmart = Web3Utils.toBN(isSmart)
    }
    if (BN.isBN(isSmart)) {
      isSmart = isSmart.cmp(new BN('1')) === 0;
    }
    this.isSmart = Web3Utils.padLeft((isSmart) ? '0x1' : '0x0', 32);
  }

  static hashFromJSON(v) {
    return this.fromJSON(v).hash();
  }

  static fromJSON(v) {
    const {
      owner,
      value,
      token,
      viewingKey,
      salt,
      isSmart,
    } = typeof v === 'object' ? v : JSON.parse(v);

    return new Note(owner, value, token, viewingKey, salt, isSmart);
  }

  getOwner() {
    if (this.owner.slice(0, 26) !== '0x000000000000000000000000') {
      return this.owner;
    }

    return util.marshal(this.owner.slice(-40));
  }

  hash() {
    return util.marshal(noteHelper.getNoteHash(
      util.unmarshal(this.owner),
      util.unmarshal(this.value),
      util.unmarshal(this.token),
      util.unmarshal(this.viewingKey),
      util.unmarshal(this.salt),
      util.unmarshal(this.isSmart),
    ));
  }

  hashArr() {
    return util.split32BytesTo16BytesArr(this.hash());
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

    return util.marshal(
      Web3Utils.fromAscii(r1 + r2),
    );
  }
}

function marshalEncDecKey(_key) {
  const key = util.unmarshal(_key.toLowerCase());
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
    return new Note(note.owner, note.value, note.token, note.viewingKey, note.salt, note.isSmart);
  } catch (e) {
    console.error("Failed to parse decrypted note JSON", e);
    return null;
  }

}

function dummyProofCreateNote(note) {
  note = Note.fromJSON(note);

  const proof = JSON.parse(sampleProof);

  proof.input = [
    ...note.hashArr(),
    note.value,
    note.token,
    1,
  ];

  return util.parseProofObj(proof);
}

function dummyProofSpendNote(oldNote, newNote1, newNote2, originalNote = null) {
  const proof = JSON.parse(sampleProof);

  oldNote = Note.fromJSON(oldNote);
  newNote1 = Note.fromJSON(newNote1);
  newNote2 = Note.fromJSON(newNote2);
  originalNote = originalNote && Note.fromJSON(originalNote);

  proof.input = [
    ...oldNote.hashArr(),
    ...newNote1.hashArr(),
    ...newNote2.hashArr(),
    ...(originalNote === null ? EMPTY_NOTE.hashArr() : originalNote.hashArr()),
    1,
  ];

  return util.parseProofObj(proof);
}

function dummyProofMakeOrder(makerNote) {
  const proof = JSON.parse(sampleProof);

  makerNote = Note.fromJSON(makerNote);

  proof.input = [
    ...makerNote.hashArr(),
    makerNote.token,
    1,
  ];

  return util.parseProofObj(proof);
}

function dummyProofTakeOrder(makerNoteHash, parentNote, stakeNote) {
  const proof = JSON.parse(sampleProof);

  parentNote = Note.fromJSON(parentNote);
  stakeNote = Note.fromJSON(stakeNote);

  proof.input = [
    ...parentNote.hashArr(),
    parentNote.token,
    ...stakeNote.hashArr(),
    stakeNote.token,
    ...util.split32BytesTo16BytesArr(makerNoteHash),
    1,
  ];

  return util.parseProofObj(proof);
}

function dummyProofSettleOrder(makerNote, parentNoteOrHash, stakeNote, rewardNote, paymentNote, changeNote, price) {
  const proof = JSON.parse(sampleProof);

  makerNote = Note.fromJSON(makerNote);
  stakeNote = Note.fromJSON(stakeNote);
  rewardNote = Note.fromJSON(rewardNote);
  paymentNote = Note.fromJSON(paymentNote);
  changeNote = Note.fromJSON(changeNote);

  parentNoteOrHash = parentNoteOrHash instanceof Note ? parentNoteOrHash.hash() : parentNoteOrHash;

  proof.input = [
    ...makerNote.hashArr(),
    makerNote.token,

    ...stakeNote.hashArr(),
    stakeNote.token,

    ...rewardNote.hashArr(),
    rewardNote.token,
    ...util.split32BytesTo16BytesArr(parentNoteOrHash),

    ...paymentNote.hashArr(),
    paymentNote.token,
    ...makerNote.hashArr(),

    ...changeNote.hashArr(),
    changeNote.token,

    price,

    1,
  ];

  return util.parseProofObj(proof);
}

const EMPTY_NOTE = new Note('0', '0', '0', '0', '0', false);
const EMPTY_NOTE_HASH = EMPTY_NOTE.hash();

console.log('EMPTY_NOTE_HASH', EMPTY_NOTE_HASH);

module.exports = {
  constants: {
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
    dummyProofMakeOrder,
    dummyProofTakeOrder,
    dummyProofSettleOrder,
  },
};
