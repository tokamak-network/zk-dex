const fs = require('fs');
const BN = require('bn.js');
const crypto = require('crypto');

const noteHelper = require('./noteHelper.js');
const zokratesHelper = require('./zokratesHelper.js');

function reduceParams(params) {
  return params
    .map(p => new BN(p, 16).toString(10))
    .reduce((a, b) => `${a} ${b}`, "").trim();
}

function getMakeOrderCommand(owner, value, type, viewKey, salt, isSmart){
  let params = noteHelper.getNoteParamsForMakeOrder(owner, value, type, viewKey, salt, isSmart);
  if (require.main === module) {
    zokratesHelper.printZokratesCommand(params);
  }
  return reduceParams(params);
}

function test1(){
  owner = "1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61";
  value = '6'
  type = '0'
  viewKey = "1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61";
  salt = "c517f646255d5492089b881965cbd3da";
  isSmart = '0';

  getMakeOrderCommand(owner, value, type, viewKey, salt, isSmart);
  //input
  // ./zokrates compute-witness -a 42506636700999808740256801842565816051 328950857246332021701192061140886785235 6 0 35527165818681367460734522247605632578 33316299488818974410722173859617164385 35527165818681367352175737833940810724 44617564583168493833591961795197099206 261982333027672377144177477746906878938 0
}

// test1();

module.exports = {
  getMakeOrderCommand,
}
