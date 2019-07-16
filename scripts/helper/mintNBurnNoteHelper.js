const fs = require('fs');
const BN = require('bn.js');
const crypto = require('crypto');

const noteHelper = require('./noteHelper.js');
const zokratesHelper = require('./zokratesHelper.js');

const SCALING_FACTOR = new BN('1000000000000000000');

function getMintAndBurnCommand(owner, value, type, viewKey, salt, isSmart){
  let params = noteHelper.getNoteParams(owner, value, type, viewKey, salt, isSmart);
  zokratesHelper.printZokratesCommand(params);
}

function test1(){
  owner = "1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61";
  value = '6'
  type = '0'
  viewKey = "1aba488300a9d72s97a315d127837be4219107c62c61966ecdf7a75431d75cc6";
  salt = "c517f646255d5492089b881965cbd3da";
  isSmart = '0';

  getMintAndBurnCommand(owner, value, type, viewKey, salt, isSmart);
  //input
  // ./zokrates compute-witness -a 42506636700999808740256801842565816051 328950857246332021701192061140886785235 6 0 35527165818681367460734522247605632578 33316299488818974410722173859617164385 35527165818681367352175737833940810724 44617564583168493833591961795197099206 261982333027672377144177477746906878938 0
}

function test2(){
  owner = "ad4aba886f3dac973beef31e714c11dff0811b69ab55b135d9c56e8b06e27f5c";
  value = '6'
  type = '0'
  viewKey = "1aba488300a9d72s97a315d127837be4219107c62c61966ecdf7a75431d75cc6";
  // salt = "1111111111111111111111111111";
  salt = "c517f646255d5492089b881965cbd3da";
  isSmart = '0';

  getMintAndBurnCommand(owner, value, type, viewKey, salt, isSmart);
}

function test3(){
  owner = "ad4aba886f3dac973beef31e714c11dff0811b69ab55b135d9c56e8b06e27f5c";
  value = '6'
  type = '0'
  viewKey = '0';
  // salt = "1111111111111111111111111111";
  salt = "c517f646255d5492089b881965cbd3da";
  isSmart = '0';

  getMintAndBurnCommand(owner, value, type, viewKey, salt, isSmart);
  // not working : ./zokrates compute-witness -a 317338196103683763455787326016028405949 52370317287365943234144238403349548283 6 0 1991934371 238901472809632685297681554166372231397 35527165818681367352175737833940810724 44617564583168493833591961795197099206 261982333027672377144177477746906878938 0
  // TODO :  it makes an error, because of owner is not 64 bytes and view key is 0
}

function test4(){
  owner = "ad4aba886f3dac973beef31e714c11dff0811b69ab55b135d9c56e8b06e27f5c";
  value = '6'
  type = '0'
  viewKey = '1111111111111111111111111111111111111111111111111111111111111111';
  // salt = "1111111111111111111111111111";
  salt = "c517f646255d5492089b881965cbd3da";
  isSmart = '0';

  getMintAndBurnCommand(owner, value, type, viewKey, salt, isSmart);
  // not working : ./zokrates compute-witness -a 317338196103683763455787326016028405949 52370317287365943234144238403349548283 6 0 1991934371 238901472809632685297681554166372231397 35527165818681367352175737833940810724 44617564583168493833591961795197099206 261982333027672377144177477746906878938 0
}

function test5(){
  owner = "1111111111111111111111111111111111111111111111111111111111111111";
  value = '0'
  type = '0'
  viewKey = "1111111111111111111111111111111111111111111111111111111111111111";
  salt = "0";
  isSmart = '0';

  getMintAndBurnCommand(owner, value, type, viewKey, salt, isSmart);
}

// test1();
// test2();

//It fails
// test3();

// it works
// test4();
test5();

module.exports = {
  getMintAndBurnCommand,
}
