const fs = require('fs');
const BN = require('bn.js');
const crypto = require('crypto');

const noteHelper = require('./noteHelper.js');

function reduceParams(params) {
  return params
    .map(p => new BN(p, 16).toString(10))
    .reduce((a, b) => `${a} ${b}`, "").trim();
}

function getTakeOrderCommand(
  parentOwner, parentValue, parentType, parentViewKey, parentSalt, parentIsSmart, //parent note's variables
  maker2TakerNoteOwner, maker2TakerValue, maker2TakerType, maker2TakerViewKey, maker2TakerSalt, maker2TakerIsSmart //takerNoteToMaker note's variables
){

  let parentNoteParams  = noteHelper.getNoteParamsForTakeOrder(
    parentOwner, parentValue, parentType, parentViewKey, parentSalt, parentIsSmart
  );

  let maker2TakerNoteParams  = noteHelper.getNoteParamsForTakeOrder(
    maker2TakerNoteOwner, maker2TakerValue, maker2TakerType, maker2TakerViewKey, maker2TakerSalt, maker2TakerIsSmart
  );

  let params = parentNoteParams.concat(maker2TakerNoteParams);
  return reduceParams(params);
}

// It pass because maker2TakerIsSmart = '1';
function test1(){
  //parent variables
  parentOwner = "1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61";
  parentValue = '6'
  parentType = '0'
  parentViewKey = "1aba488300a9d72s97a315d127837be4219107c62c61966ecdf7a75431d75cc6";
  parentSalt = "c517f646255d5492089b881965cbd3da";
  parentIsSmart = '0';

  //takerNoteToMaker note's variables
  maker2TakerNoteOwner = "1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61";
  maker2TakerValue = '6'
  maker2TakerType = '0'
  maker2TakerViewKey = "1aba488300a9d72s97a315d127837be4219107c62c61966ecdf7a75431d75cc6"
  maker2TakerSalt = "c517f646255d5492089b881965cbd3da";
  maker2TakerIsSmart = '1';

  getTakeOrderCommand(
    parentOwner, parentValue, parentType, parentViewKey, parentSalt, parentIsSmart,
    maker2TakerNoteOwner, maker2TakerValue, maker2TakerType, maker2TakerViewKey, maker2TakerSalt, maker2TakerIsSmart
  );
  // input
  // ./zokrates compute-witness -a 42506636700999808740256801842565816051 328950857246332021701192061140886785235 0 35527165818681367460734522247605632578 33316299488818974410722173859617164385 6 35527165818681367352175737833940810724 44617564583168493833591961795197099206 261982333027672377144177477746906878938 0 276264684250560691084644971779248451084 231161444574278892328751884475139065400 0 35527165818681367460734522247605632578 33316299488818974410722173859617164385 6 35527165818681367352175737833940810724 44617564583168493833591961795197099206 261982333027672377144177477746906878938 1
}


// It fails because maker2TakerIsSmart = '0';
function test2(){
  //parent variables
  parentOwner = "1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61";
  parentValue = '6'
  parentType = '0'
  parentViewKey = "1aba488300a9d72s97a315d127837be4219107c62c61966ecdf7a75431d75cc6";
  parentSalt = "c517f646255d5492089b881965cbd3da";
  parentIsSmart = '0';

  //takerNoteToMaker note's variables
  maker2TakerNoteOwner = "1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61";
  maker2TakerValue = '6'
  maker2TakerType = '0'
  maker2TakerViewKey = "1aba488300a9d72s97a315d127837be4219107c62c61966ecdf7a75431d75cc6"
  maker2TakerSalt = "c517f646255d5492089b881965cbd3da";
  maker2TakerIsSmart = '0';

  getTakeOrderCommand(
    parentOwner, parentValue, parentType, parentViewKey, parentSalt, parentIsSmart,
    maker2TakerNoteOwner, maker2TakerValue, maker2TakerType, maker2TakerViewKey, maker2TakerSalt, maker2TakerIsSmart
  );
  // input
  // ./zokrates compute-witness -a 42506636700999808740256801842565816051 328950857246332021701192061140886785235 0 35527165818681367460734522247605632578 33316299488818974410722173859617164385 6 35527165818681367352175737833940810724 44617564583168493833591961795197099206 261982333027672377144177477746906878938 0 42506636700999808740256801842565816051 328950857246332021701192061140886785235 0 35527165818681367460734522247605632578 33316299488818974410722173859617164385 6 35527165818681367352175737833940810724 44617564583168493833591961795197099206 261982333027672377144177477746906878938 0
}

// It fails because parentValue != maker2TakerValue;
function test3(){
  //parent variables
  parentOwner = "1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61";
  parentValue = '6'
  parentType = '0'
  parentViewKey = "1aba488300a9d72s97a315d127837be4219107c62c61966ecdf7a75431d75cc6";
  parentSalt = "c517f646255d5492089b881965cbd3da";
  parentIsSmart = '0';

  //takerNoteToMaker note's variables
  maker2TakerNoteOwner = "1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61";
  maker2TakerValue = '3'
  maker2TakerType = '0'
  maker2TakerViewKey = "1aba488300a9d72s97a315d127837be4219107c62c61966ecdf7a75431d75cc6"
  maker2TakerSalt = "c517f646255d5492089b881965cbd3da";
  maker2TakerIsSmart = '1';

  getTakeOrderCommand(
    parentOwner, parentValue, parentType, parentViewKey, parentSalt, parentIsSmart,
    maker2TakerNoteOwner, maker2TakerValue, maker2TakerType, maker2TakerViewKey, maker2TakerSalt, maker2TakerIsSmart
  );
  // input
  // ./zokrates compute-witness -a 42506636700999808740256801842565816051 328950857246332021701192061140886785235 0 35527165818681367460734522247605632578 33316299488818974410722173859617164385 6 35527165818681367352175737833940810724 44617564583168493833591961795197099206 261982333027672377144177477746906878938 0 106607616413726012423683390381814645909 6519878271921534948782062679329610818 0 35527165818681367460734522247605632578 33316299488818974410722173859617164385 3 35527165818681367352175737833940810724 44617564583168493833591961795197099206 261982333027672377144177477746906878938 1
}

//pass
// test1();

//fails : intend
// test2();

//fails : intend
// test3();

module.exports = {
  getTakeOrderCommand,
}
