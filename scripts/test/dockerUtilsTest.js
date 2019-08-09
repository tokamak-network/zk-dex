const { expect } = require('chai');
const BN = require('bn.js');
const Web3Utils = require('web3-utils');

const {
  constants, 
  Note,
} = require('../lib/Note');

const {
  getMintNBurnProof,
  getTransferProof,
  getMakeOrderProof,
  getTakeOrderProof,
  getSettleOrderProof,
} = require('../lib/dockerUtils');

const SCALING_FACTOR = new BN('1000000000000000000');
    
let owner;
let viewingKey;
let salt;

let oldDAINote;
let newDAINote1;
let newDAINote2;

let makerNoteValue;
let parentNoteValue;
let stakeNoteValue;
let rewardNoteValue;
let paymentNoteValue;
let changeNoteValue;

let makerNote;
let parentNote;
let stakeNote;
let rewardNote;
let paymentNote;
let changeNote;
let price;

describe('dockerUtils', function() {
  before(async() => {
    owner = Web3Utils.randomHex(32);
    viewingKey = Web3Utils.randomHex(32);
    salt = Web3Utils.randomHex(16);

    let oldDAIValue = Web3Utils.toHex(new BN(10000).mul(SCALING_FACTOR));
    let newDAIValue1 = Web3Utils.toHex(new BN(5000).mul(SCALING_FACTOR));
    let newDAIValue2 = Web3Utils.toHex(new BN(5000).mul(SCALING_FACTOR));
    parentNoteValue = Web3Utils.toHex(new BN(20000).mul(SCALING_FACTOR));

    oldDAINote = new Note(owner, oldDAIValue, constants.DAI_TOKEN_TYPE, viewingKey, salt);
    newDAINote1 = new Note(owner, newDAIValue1, constants.DAI_TOKEN_TYPE, viewingKey, salt);
    newDAINote2 = new Note(owner, newDAIValue2, constants.DAI_TOKEN_TYPE, viewingKey, salt);
    parentNote = new Note(owner, parentNoteValue, constants.DAI_TOKEN_TYPE, viewingKey, salt);

    
    for(var i = 0; i < 5; i++) {
      await sleep(500);
    }
  });

  it('should get proof of mintNBurn', async () => {
    proof = await getMintNBurnProof(oldDAINote)
    console.log(proof);
  });

  it('should get proof of trasnfer', async () => {
    proof = await getTransferProof(oldDAINote, newDAINote1, newDAINote2)
    console.log(proof);
  });
  
  it('should get proof of makeOrder', async () => {
    proof = await getMakeOrderProof(oldDAINote)
    console.log(proof);
  });

  it('should get proof of takeOrder', async () => {
    proof = await getTakeOrderProof(makerNote.hash(), parentNote, stakeNote)
    console.log(proof);
  });

  describe('when makerNote.value >= stakeNote.value * price', function () {
    before(async() => {
      makerNoteValue = Web3Utils.toHex(new BN(100).mul(SCALING_FACTOR));
      stakeNoteValue = Web3Utils.toHex(new BN(5000).mul(SCALING_FACTOR));
      rewardNoteValue = Web3Utils.toHex(new BN(50).mul(SCALING_FACTOR));
      paymentNoteValue = Web3Utils.toHex(new BN(5000).mul(SCALING_FACTOR));
      changeNoteValue = Web3Utils.toHex(new BN(50).mul(SCALING_FACTOR));
  
      price = Web3Utils.toHex(new BN(100).mul(SCALING_FACTOR));

      makerNote = new Note(owner, makerNoteValue, constants.ETH_TOKEN_TYPE, viewingKey, salt);
      stakeNote = new Note(makerNote.hash(), stakeNoteValue, constants.DAI_TOKEN_TYPE, viewingKey, salt, true);
      rewardNote = new Note(parentNote.hash(), rewardNoteValue, constants.ETH_TOKEN_TYPE, viewingKey, salt, true);
      paymentNote = new Note(makerNote.hash(), paymentNoteValue, constants.DAI_TOKEN_TYPE, viewingKey, salt, true);
      changeNote = new Note(makerNote.hash(), changeNoteValue, constants.ETH_TOKEN_TYPE, viewingKey, salt, true);
    })
    
    it('should get proof of settleOrder when makerNote.value >= stakeNote.value * price', async () => {
      proof = await getSettleOrderProof(makerNote, stakeNote, rewardNote, paymentNote, changeNote, price)
      console.log(proof);
    });
  })

  describe('makerNote.value < stakeNote.value * price', function () {
    before(async() => {
      makerNoteValue = Web3Utils.toHex(new BN(100).mul(SCALING_FACTOR));
      stakeNoteValue = Web3Utils.toHex(new BN(20000).mul(SCALING_FACTOR));
      rewardNoteValue = Web3Utils.toHex(new BN(100).mul(SCALING_FACTOR));
      paymentNoteValue = Web3Utils.toHex(new BN(10000).mul(SCALING_FACTOR));
      changeNoteValue = Web3Utils.toHex(new BN(10000).mul(SCALING_FACTOR));
  
      price = Web3Utils.toHex(new BN(100).mul(SCALING_FACTOR));

      makerNote = new Note(owner, makerNoteValue, constants.ETH_TOKEN_TYPE, viewingKey, salt);
      stakeNote = new Note(makerNote.hash(), stakeNoteValue, constants.DAI_TOKEN_TYPE, viewingKey, salt, true);
      rewardNote = new Note(parentNote.hash(), rewardNoteValue, constants.ETH_TOKEN_TYPE, viewingKey, salt, true);
      paymentNote = new Note(makerNote.hash(), paymentNoteValue, constants.DAI_TOKEN_TYPE, viewingKey, salt, true);
      changeNote = new Note(parentNote.hash(), changeNoteValue, constants.DAI_TOKEN_TYPE, viewingKey, salt, true);
    })

    it('should get proof of settleOrder when makerNote.value < stakeNote.value * price', async () => {
      proof = await getSettleOrderProof(makerNote, stakeNote, rewardNote, paymentNote, changeNote, price)
      console.log(proof);
    });
  })
});


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}