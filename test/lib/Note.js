const crypto = require('crypto');
const util = require('../util');
const mode = 'aes-256-cbc';

const ETH_TOKEN_TYPE = web3.utils.padLeft('0x0', 64);
const DAI_TOKEN_TYPE = web3.utils.padLeft('0x1', 64);

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

class Note {
  constructor(owner, value, token, viewingKey, salt) {
    this.owner = web3.utils.padLeft(web3.utils.toHex(owner), 64);
    this.value = web3.utils.padLeft(web3.utils.toHex(value), 64);
    this.token = web3.utils.padLeft(web3.utils.toHex(token), 64);
    this.viewingKey = web3.utils.padLeft(web3.utils.toHex(viewingKey), 64);
    this.salt = web3.utils.padLeft(web3.utils.toHex(salt), 64);
  }

  getOwner() {
    if (this.owner.slice(0, 26) !== '0x000000000000000000000000') {
      return this.owner;
    }

    return util.marshal(this.owner.slice(-40));
  }

  hash() {
    const args = [this.owner, this.value, this.token, this.viewingKey, this.salt];
    const v = args.map(util.unmarshal).join('');
    return web3.utils.soliditySha3(util.marshal(v));
  }

  hashArr() {
    const h = util.unmarshal(this.hash());
    return [util.marshal(h.slice(0, 32)), util.marshal(h.slice(32))];
  }

  toString() {
    return JSON.stringify(this);
  }

  encrypt() {
    const cipher = crypto.createCipher(mode, this.viewingKey);

    const r1 = cipher.update(this.toString(), 'utf8', 'base64');
    const r2 = cipher.final('base64');

    return util.marshal(
      web3.utils.fromAscii(r1 + r2)
    );
  }
}

function decrypt(v, sk) {
  if (!v) {
    throw new Error(`invalid value to decrypt: ${v}`);
  }

  const decipher = crypto.createDecipher(mode, sk);

  const r1 = decipher.update(web3.utils.toAscii(v), 'base64', 'utf8');
  const r2 = decipher.final('utf8');

  const note = JSON.parse(r1 + r2);
  return new Note(note.owner, note.value, note.token, note.viewingKey, note.salt);
}

function dummyProofCreateNote(note) {
  const proof = JSON.parse(sampleProof);

  proof.input = [
    ...note.hashArr(),
    note.value,
    note.token,
    1,
  ];

  return util.parseProofObj(proof);
}

function dummyProofSpendNote(oldNote, newNote1, newNote2) {
  const proof = JSON.parse(sampleProof);

  proof.input = [
    ...oldNote.hashArr(),
    ...newNote1.hashArr(),
    ...newNote2.hashArr(),
    1,
  ];

  return util.parseProofObj(proof);
}

function dummyProofMakeOrder(makerNote) {
  const proof = JSON.parse(sampleProof);
  const hash = util.unmarshal(makerNote.hash());

  proof.input = [
    ...makerNote.hashArr(),
    makerNote.token,
    1,
  ];

  return util.parseProofObj(proof);
}

function dummyProofTakeOrder(makerNote, parentNote, stakeNote) {
  const proof = JSON.parse(sampleProof);

  proof.input = [
    ...parentNote.hashArr(),
    parentNote.token,
    ...stakeNote.hashArr(),
    stakeNote.token,
    ...makerNote.hashArr(),
    1,
  ];

  return util.parseProofObj(proof);
}

function dummyProofSettleOrder(makerNote, parentNote, stakeNote, rewardNote, paymentNote, changeNote, price) {
  const proof = JSON.parse(sampleProof);

  proof.input = [
    ...makerNote.hashArr(),
    makerNote.token,

    ...stakeNote.hashArr(),
    stakeNote.token,
    ...makerNote.hashArr(),

    ...rewardNote.hashArr(),
    rewardNote.token,
    ...parentNote.hashArr(),

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

module.exports = {
  ETH_TOKEN_TYPE,
  DAI_TOKEN_TYPE,
  Note,
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