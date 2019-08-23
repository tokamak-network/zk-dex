const { expect } = require('chai');
const BN = require('bn.js');
const Web3Utils = require('web3-utils');

const util = require('../lib/util');
const {
  constants, 
  Note,
} = require('../lib/Note');

const noteHelper = require('../helper/noteHelper')

const { 
  getSk,
  getPrivKey,
  getPubKey,
  getAddress,
} = require('../helper/accountHelper');

const {
  getMintNBurnProof,
  getTransferProof,
  getMakeOrderProof,
  getTakeOrderProof,
  getSettleOrderProof,
} = require('../lib/dockerUtils');


const SCALING_FACTOR = new BN('1000000000000000000');
    
let sk;
let address;
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
    sk = getSk()
    sk_hex = sk.n.toString(16, 64);
    address = getAddress(sk);
    viewingKey = Web3Utils.randomHex(32);
    salt = Web3Utils.randomHex(16);

    let oldDAIValue = Web3Utils.toHex(new BN(10000).mul(SCALING_FACTOR));
    let newDAIValue1 = Web3Utils.toHex(new BN(5000).mul(SCALING_FACTOR));
    let newDAIValue2 = Web3Utils.toHex(new BN(5000).mul(SCALING_FACTOR));

    emptyNote = new Note(0, 0, 0, 0, 0)
    oldDAINote = new Note(address, oldDAIValue, constants.DAI_TOKEN_TYPE, viewingKey, salt);
    newDAINote1 = new Note(address, newDAIValue1, constants.DAI_TOKEN_TYPE, viewingKey, salt);
    newDAINote2 = new Note(address, newDAIValue2, constants.DAI_TOKEN_TYPE, viewingKey, salt);

    parentNoteValue = Web3Utils.toHex(new BN(20000).mul(SCALING_FACTOR));
    parentNote = new Note(address, parentNoteValue, constants.DAI_TOKEN_TYPE, viewingKey, salt);

    
    // await util.sleep(3);
    
  });

  // 얘는 잘됨
  it('should get proof of mintNBurn', async () => {
    console.log("sk", sk.n.toString(10));
    console.log("pkx", getPubKey(sk).p.x.n.toString(10));
    console.log("pky", getPubKey(sk).p.y.n.toString(10));
    console.log("address", new BN(address[0], 16).toString());
    console.log("addressHash0", new BN(address[1], 16).toString());
    console.log("addressHash1", new BN(address[2], 16).toString());

    // let hash = oldDAINote.hashArr()
    // console.log(hash)
    // console.log(Web3Utils.toBN(hash[0]).toString())
    // console.log(Web3Utils.toBN(hash[1]).toString())
    // // console.log(new BN(hash[0], 16));
    // // console.log(new BN(hash[1], 16));
    // proof = await getMintNBurnProof(oldDAINote, sk_hex)
    // console.log(proof);
  });

  // TODO: proof 생성안됨..
  // it('should get proof of trasnfer', async () => {
  //   proof = await getTransferProof(oldDAINote, sk_hex, newDAINote1, newDAINote2)
  //   console.log(proof);
  // });
  
  // compute-witness 직접 돌려봤을 때 됐음
  // it('should get proof of makeOrder', async () => {
  //   console.log("sk.n", sk.n);
  //   console.log("sk_hex", sk_hex);

  //   console.log(new BN('e5165cd4ebb725e07019cb88f481419c', 16))
  //   proof = await getMakeOrderProof(oldDAINote, sk_hex)
  //   console.log(proof);
  // });

  // it('should get proof of takeOrder', async () => {
  //   proof = await getTakeOrderProof(makerNote.hash(), parentNote, stakeNote)
  //   console.log(proof);
  // });

  // describe('when makerNote.value >= stakeNote.value * price', function () {
  //   before(async() => {
  //     makerNoteValue = Web3Utils.toHex(new BN(100).mul(SCALING_FACTOR));
  //     stakeNoteValue = Web3Utils.toHex(new BN(5000).mul(SCALING_FACTOR));
  //     rewardNoteValue = Web3Utils.toHex(new BN(50).mul(SCALING_FACTOR));
  //     paymentNoteValue = Web3Utils.toHex(new BN(5000).mul(SCALING_FACTOR));
  //     changeNoteValue = Web3Utils.toHex(new BN(50).mul(SCALING_FACTOR));
  
  //     price = Web3Utils.toHex(new BN(100).mul(SCALING_FACTOR));

  //     makerNote = new Note(owner, makerNoteValue, constants.ETH_TOKEN_TYPE, viewingKey, salt);
  //     stakeNote = new Note(makerNote.hash(), stakeNoteValue, constants.DAI_TOKEN_TYPE, viewingKey, salt, true);
  //     rewardNote = new Note(parentNote.hash(), rewardNoteValue, constants.ETH_TOKEN_TYPE, viewingKey, salt, true);
  //     paymentNote = new Note(makerNote.hash(), paymentNoteValue, constants.DAI_TOKEN_TYPE, viewingKey, salt, true);
  //     changeNote = new Note(makerNote.hash(), changeNoteValue, constants.ETH_TOKEN_TYPE, viewingKey, salt, true);
  //   })
    
  //   it('should get proof of settleOrder when makerNote.value >= stakeNote.value * price', async () => {
  //     proof = await getSettleOrderProof(makerNote, stakeNote, rewardNote, paymentNote, changeNote, price)
  //     console.log(proof);
  //   });
  // })

  // describe('makerNote.value < stakeNote.value * price', function () {
  //   before(async() => {
  //     makerNoteValue = Web3Utils.toHex(new BN(100).mul(SCALING_FACTOR));
  //     stakeNoteValue = Web3Utils.toHex(new BN(20000).mul(SCALING_FACTOR));
  //     rewardNoteValue = Web3Utils.toHex(new BN(100).mul(SCALING_FACTOR));
  //     paymentNoteValue = Web3Utils.toHex(new BN(10000).mul(SCALING_FACTOR));
  //     changeNoteValue = Web3Utils.toHex(new BN(10000).mul(SCALING_FACTOR));
  
  //     price = Web3Utils.toHex(new BN(100).mul(SCALING_FACTOR));

  //     makerNote = new Note(owner, makerNoteValue, constants.ETH_TOKEN_TYPE, viewingKey, salt);
  //     stakeNote = new Note(makerNote.hash(), stakeNoteValue, constants.DAI_TOKEN_TYPE, viewingKey, salt, true);
  //     rewardNote = new Note(parentNote.hash(), rewardNoteValue, constants.ETH_TOKEN_TYPE, viewingKey, salt, true);
  //     paymentNote = new Note(makerNote.hash(), paymentNoteValue, constants.DAI_TOKEN_TYPE, viewingKey, salt, true);
  //     changeNote = new Note(parentNote.hash(), changeNoteValue, constants.DAI_TOKEN_TYPE, viewingKey, salt, true);
  //   })

  //   it('should get proof of settleOrder when makerNote.value < stakeNote.value * price', async () => {
  //     proof = await getSettleOrderProof(makerNote, stakeNote, rewardNote, paymentNote, changeNote, price)
  //     console.log(proof);
  //   });
  // })
});