// const verifier = artifacts.require("verifier");
const fs = require('fs');
const BN = require('bn.js');
const crypto = require('crypto');

// contract('verifier', function(accounts) {
//   it('makeWitness', async function(){
//
//   })
//   it('verifyTx', async function() {
//     //Read Proof
//     let proofJson = fs.readFileSync('../../circuit/createNote/proof.json', 'utf8');
//     proofJson = JSON.parse(proofJson);
//     console.log(proofJson)
//     const proof = proofJson.proof;
//     const input = proofJson.input;
//     const _proof = [];
//     Object.keys(proof).forEach(key => _proof.push(proof[key]));
//     _proof.push(input)
//
//     let instance = await verifier.deployed();
//     console.log('calling verifyTx with proof', _proof);
//     const success = await instance.verifyTx(..._proof);
//     assert(success);
//     console.log("success", success);
//   })
// })

function getCreateParams(owner, amount, type, viewKey, salt, isSmart){
  //TODO : all params need to be .slice(2), "0x0001" --> "0001"
  // let notePayLoad = getHexPayload(owner, amount, type, viewKey, salt, isSmart);
  let notePayLoad = getHexPayload(owner, amount, type, viewKey, salt, isSmart);
  console.log(notePayLoad);

  //note variables
  let noteHash = _toHashedDouble128(notePayLoad);
  let noteOwner = _toHashedDouble128(_toPadedHex(owner));
  let noteValue = _toPadedHexAndSplit(value);
  let noteType = _toPadedHexAndSplit(type);
  let noteViewKey = _toPadedHexAndSplit(viewKey);
  let noteSalt = _toPadedHexAndSplit(salt);
  let noteIsSmart = _toPadedHexAndSplit(isSmart);
  const noteParams = noteHash.concat(noteOwner, noteValue, noteType, noteViewKey, noteSalt, noteIsSmart);
  return noteParams;
}

function _toPadedHexAndSplit(under256bitValue){
  let paddedHex = new BN(under256bitValue, 16).toString(16, 64);
  return [paddedHex.slice(0, 32), paddedHex.slice(32)];
}

function _toPadedHex(under256bitValue){
  return new BN(under256bitValue, 16).toString(16, 64);
}

function _toHashedDouble128(paded256bitHex){
  const buf = Buffer.from(paded256bitHex, 'hex');
  const digest = crypto.createHash('sha256').update(buf).digest('hex');
  // console.log('digest', digest)
  // split into 128 bits each
  return [digest.slice(0, 32), digest.slice(32)]
}

function getHexPayload(address, amount, type, viewKey, salt, isSmart) {
  let paddedAddress = new BN(address, 16).toString(16, 64);
  let paddedAmount = new BN(amount, 16).toString(16, 64);
  let paddedType = new BN(type, 16).toString(16, 64);
  let paddedViewKey = new BN(viewKey, 16).toString(16, 64);
  let paddedSalt = new BN(salt, 16).toString(16, 64);
  let paddedIsSmart = new BN(isSmart, 16).toString(16, 64);
  return paddedAddress + paddedAmount + paddedType + paddedViewKey + paddedSalt + paddedIsSmart;
}

function printZokratesCommand(params) {
  let cmd = './zokrates compute-witness -a '
  params.forEach(p => {
    cmd += `${new BN(p, 16).toString(10)} `
  })
  console.log(cmd);

  return cmd;
}

function test(){
  addrs = "0x2c79f5cBeC4C79ad58659EC5655e7c0D2ce00B16".slice(2);
  value = "0x2".slice(2);
  type = "0x0".slice(2);
  viewKey = "0x0".slice(2);
  salt = "0x0".slice(2);
  isSmart = "0x0".slice(2);
  let params = getCreateParams(addrs, value, type, viewKey, salt, isSmart);
  console.log(params);
  printZokratesCommand(params);
}

test();
