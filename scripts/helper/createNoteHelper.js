// const verifier = artifacts.require("verifier");
const fs = require('fs');
const BN = require('bn.js');
const crypto = require('crypto');

const SCALING_FACTOR = new BN('1000000000000000000');

// Example Params
// owner = "1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61";
// value = '6'
// type = '0'
// viewKey = "1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61";
// salt = "c517f646255d5492089b881965cbd3da";
// isSmart = '0';
function getCreateParams(owner, amount, type, viewKey, salt, isSmart){
  //all params should look like this "0001"(o), "0x0001"(x)
  let noteOwner = new BN(owner, 16).toString(16); //32 bytes = 256 bits
  //TODO : if it is shorter then 32 bytes, index 1 returns ''
  let splittedNoteOwner = [noteOwner.slice(0, 32), noteOwner.slice(32)];

  let noteValue =  new BN(amount, 16).toString(16, 32); //16 bytes = 128 bits
  let noteType = new BN(type, 16).toString(16, 32); //16 bytes = 128 bits

  let noteViewKey = new BN(viewKey, 16).toString(16); //32 bytes = 256 bits
  //TODO : if it is shorter then 32 bytes, index 1 returns ''
  let splittedNoteViewKey = [noteViewKey.slice(0, 32), noteViewKey.slice(32)];

  let noteSalt = new BN(salt, 16).toString(16, 32); //16 bytes = 128 bits
  let noteIsSmart = new BN(isSmart, 16).toString(16, 32); //16 bytes = 128 bits

  //To be hashed, raw note info
  let note = noteOwner + noteValue + noteType + noteViewKey + noteSalt + noteIsSmart;

  let noteHash = _toHashed(note);

  const noteParams = noteHash.concat(noteValue, noteType, splittedNoteOwner, splittedNoteViewKey, noteSalt, noteIsSmart);
  // console.log(noteParams);
  return noteParams;
}

function _toHashed(encodedValue){
  const buf = Buffer.from(encodedValue, 'hex');
  const digest = crypto.createHash('sha256').update(buf).digest('hex');
  // console.log('digest', digest)
  // split into 128 bits each
  return [digest.slice(0, 32), digest.slice(32)]
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
  owner = "1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61";
  value = '6'
  type = '0'
  viewKey = "1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61";
  salt = "c517f646255d5492089b881965cbd3da";
  isSmart = '0';
  let params = getCreateParams(owner, value, type, viewKey, salt, isSmart);
  printZokratesCommand(params);
}

// function test(){
//   owner = "1234567123412414212411111111111111111111111111111";
//   value = '6'
//   type = '0'
//   viewKey = "1293129301112312422222222222222222222222";
//   salt = "1111111111111111111111111111";
//   isSmart = '0';
//   let params = getCreateParams(owner, value, type, viewKey, salt, isSmart);
//   console.log(params);
//   printZokratesCommand(params);
// }

// test();

module.exports = {
  printZokratesCommand, getCreateParams,
}
