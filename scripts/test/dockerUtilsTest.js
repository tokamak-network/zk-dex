const { expect } = require('chai');
const BN = require('bn.js');
const Web3Utils = require('web3-utils');
const { PublicKey, PrivateKey } = require('babyjubjub');

const util = require('../lib/util');
const {
  constants, 
  Note,
} = require('../lib/Note');

const noteHelper = require('../helper/noteHelper')

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

  

  //get PrivateKey object(field, hexstring)
  // let sk = PrivateKey.getRandObj().field;
  //get PrivateKey object from field(or hexstring)
  // let privKey = new PrivateKey(sk);
  //get PublicKey object from privateKey object
  // let pubKey = PublicKey.fromPrivate(privKey);
  // console.log(Web3Utils.toHex(sk.n.toFixed()))
  // console.log(privKey)
  // console.log(Web3Utils.toHex(pubKey.p.x.n));
  // console.log(Web3Utils.toHex(pubKey.p.y.n));
  


  let pk0 = '0x17eb53a377deda14f1a807edd3f6a6072c8196534af2d0b978510572dee7e2fa';
  let pk1 = '0x25a3286749f867c10f409c523892abc951b1539bf6d7453cd2ee66bbe908ca40';
  let value = Web3Utils.toHex(new BN(100).mul(SCALING_FACTOR));
  let viewKey = '0x1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61';
  let salt = '0x025642aeb6fbd5438257f3b080aff4e2a1a8f186798d9c761710bcdc392970d7';

  // let note = new Note(pk0, pk1, value, constants.ETH_TOKEN_TYPE, viewKey, salt)
  let note = new Note(0, 0, 0, 0, 0, 0)

  let hash = note.hashArr();


  console.log(Web3Utils.hexToNumberString(pk0))
  console.log(Web3Utils.hexToNumberString(pk1))
  console.log(Web3Utils.hexToNumberString(value))
  console.log(Web3Utils.hexToNumberString(constants.ETH_TOKEN_TYPE))
  console.log(Web3Utils.hexToNumberString('0x1aba488300a9d7297a315d127837be42'))
  console.log(Web3Utils.hexToNumberString('0x19107c62c61966ecdf7a75431d75cc61'))
  console.log(Web3Utils.hexToNumberString(salt))

  console.log("hash0", Web3Utils.hexToNumberString(hash[0]))
  console.log("hash1", Web3Utils.hexToNumberString(hash[1]))

  console.log(Web3Utils.hexToNumberString('a007ded8fdb296dda1fe5029c7d12a6')) 

  emptyHash = noteHelper.toHashed('0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000')
  console.log("emptyHash0", Web3Utils.hexToNumberString(emptyHash[0]))
  console.log("emptyHash1", Web3Utils.hexToNumberString(emptyHash[1]))



  // console.log(new BN('17eb53a377deda14f1a807edd3f6a6072c8196534af2d0b978510572dee7e2fa', 16).toString(16, 64));


  // console.log(Web3Utils.hexToNumberString('17eb53a377deda14f1a807edd3f6a6072c8196534af2d0b978510572dee7e2fa')) // 10818981829679976267837886507869326672452508998420962784860259541650843886330
  
  
  

  

  // 10818981829679976267837886507869326672452508998420962784860259541650843886330 17023850323658096655434238068451231242851008000927434464509267799240534968896 100000000000000000000 0 97607619938831112993492948406801901391126915887319108763757852299081597541081 1057034770297517286726678809951732795809480855961249264955303249348255117527

//  let pk0 = '17eb53a377deda14f1a807edd3f6a6072c8196534af2d0b978510572dee7e2fa';
//  let pk1 = '25a3286749f867c10f409c523892abc951b1539bf6d7453cd2ee66bbe908ca40';
//  let value = '6';
//  let type = '0';
//  let viewKey1 = '1aba488300a9d7297a315d127837be42';
//  let viewKey2 = '19107c62c61966ecdf7a75431d75cc61';
//  let salt = 'c517f646255d5492089b881965cbd3da';
//  let isSmart = '0';

//  console.log(Web3Utils.hexToNumberString(nh0))
//  console.log(Web3Utils.hexToNumberString(nh1))

//  console.log(Web3Utils.hexToNumberString(pk1))
//  console.log(new BN(pk1, 16).toString(10))
//  console.log(Web3Utils.hexToNumberString(pk2))
//  console.log(Web3Utils.hexToNumberString(value))
//  console.log(Web3Utils.hexToNumberString(type))
//  console.log(Web3Utils.hexToNumberString(viewKey1))
//  console.log(Web3Utils.hexToNumberString(viewKey2))
//  console.log(Web3Utils.hexToNumberString(salt))
//  console.log(Web3Utils.hexToNumberString(isSmart))

 

 






  /*
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
      await util.sleep(500);
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
  */
});