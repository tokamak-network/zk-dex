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

function getSettleOrderCommand(
  makerNoteOwner, makerNoteValue, makerNoteType, makerNoteViewKey, makerNoteSalt, makerNoteIsSmart, //makerNote's variables
  taker2MakerNoteOwner, taker2MakerNoteValue, taker2MakerNoteType, taker2MakerNoteViewKey, taker2MakerNoteSalt, taker2MakerNoteIsSmart, //takerNoteToMakerNote's variables
  newNote2TakerOwner, newNote2TakerValue, newNote2TakerType, newNote2TakerViewKey, newNote2TakerSalt, newNote2TakerIsSmart, //newNoteToTakerNote's variables
  newNote2MakerOwner, newNote2MakerValue, newNote2MakerType, newNote2MakerViewKey, newNote2MakerSalt, newNote2MakerIsSmart, //newNoteToMakerNote's variables
  changeNoteOwner, changeNoteValue, changeNoteType, changeNoteViewKey, changeNoteSalt, changeNoteIsSmart, //changeNote's variables
  price // price
){
  let makerNoteParams = noteHelper.getNoteParamsForSettleOrder(makerNoteOwner, makerNoteValue, makerNoteType, makerNoteViewKey, makerNoteSalt, makerNoteIsSmart);
  let taker2MakerNoteParams = noteHelper.getNoteParamsForSettleOrder(makerNoteParams[0]+makerNoteParams[1], taker2MakerNoteValue, taker2MakerNoteType, taker2MakerNoteViewKey, taker2MakerNoteSalt, taker2MakerNoteIsSmart);
  let newNote2TakerParams = noteHelper.getNoteParamsForSettleOrder(newNote2TakerOwner, newNote2TakerValue, newNote2TakerType, newNote2TakerViewKey, newNote2TakerSalt, newNote2TakerIsSmart);
  let newNote2MakerParams = noteHelper.getNoteParamsForSettleOrder(makerNoteParams[0]+makerNoteParams[1], newNote2MakerValue, newNote2MakerType, newNote2MakerViewKey, newNote2MakerSalt, newNote2MakerIsSmart);
  let changeNoteParams;

  if(makerNoteValue - taker2MakerNoteValue >= 0){
    //if takerAmount >= makerAmount
    //change is given to "hash(makerNote)"
    changeNoteParams = noteHelper.getNoteParamsForSettleOrder(makerNoteParams[0]+makerNoteParams[1], changeNoteValue, changeNoteType, changeNoteViewKey, changeNoteSalt, changeNoteIsSmart);
  } else {
    //if takerAmount < makerAmount
    //change is given to "hash(taker2MakerNoteOwner.parent) => newNote2TakerOwner"
    changeNoteParams = noteHelper.getNoteParamsForSettleOrder(newNote2TakerOwner, changeNoteValue, changeNoteType, changeNoteViewKey, changeNoteSalt, changeNoteIsSmart);
  }

  let params = makerNoteParams.concat(taker2MakerNoteParams, newNote2TakerParams, newNote2MakerParams, changeNoteParams).concat(price);

  if (require.main === module) {
    zokratesHelper.printZokratesCommand(params);
  }
  return reduceParams(params);
}


// v1 - v2/price >= 0, makerNote --> (newNoteToTaker, Change), takerNoteToMaker --> newNoteToMaker
// price == 1
// all note type == 0
// taker tried to buy some of makerNote's amount
function test1(){
  // makerNote's variables
  // hash(makerNote) : 'ef17beaef3f11a36a7e22d4d6e03cee6bd059ec8fa9553d16223a1859f22b48b'
  // makerNote --> (newNoteToTakerNote, ChangeNote)
  makerNoteOwner = "1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61";
  makerNoteValue = '7';
  makerNoteType = '0';
  makerNoteViewKey = "1111111111111111111111111111111111111111111111111111111111111111";
  makerNoteSalt = "c517f646255d5492089b881965cbd3da";
  makerNoteIsSmart = '0';

  // takerNoteToMakerNote's variables
  // hash(takerNoteToMakerNote) : "cbb0f25efa51213a96d54ffee7fba8969b909045ac10c4da610e9f5821b53cf8"
  // makerNote --> (newNoteToTakerNote, ChangeNote)
  taker2MakerNoteOwner = "ef17beaef3f11a36a7e22d4d6e03cee6bd059ec8fa9553d16223a1859f22b48b"; // It automatically calculated
  taker2MakerNoteValue = '4';
  taker2MakerNoteType = '0';
  taker2MakerNoteViewKey = '1111111111111111111111111111111111111111111111111111111111111111';
  taker2MakerNoteSalt = "c517f646255d5492089b881965cbd3da"
  taker2MakerNoteIsSmart = '1'

  // takerNoteToMakerNote's variables
  // hash(newNoteToTakerNote) :
  // newNoteToTakerNote's variables
  newNote2TakerOwner = "2aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61"; //taker2MakerNote.parent
  newNote2TakerValue = '4'; // takerNoteToMakerNote.value == newNoteToTakerNote.value
  newNote2TakerType = '0';
  newNote2TakerViewKey = '1111111111111111111111111111111111111111111111111111111111111111';
  newNote2TakerSalt = "c517f646255d5492089b881965cbd3da";
  newNote2TakerIsSmart = '1'; // It is smartNote

  //newNoteToMakerNote's variables
  newNote2MakerOwner = "ef17beaef3f11a36a7e22d4d6e03cee6bd059ec8fa9553d16223a1859f22b48b"; // It automatically calculated
  newNote2MakerValue = '4';
  newNote2MakerType = '0';
  newNote2MakerViewKey = '1111111111111111111111111111111111111111111111111111111111111111';
  newNote2MakerSalt = 'c517f646255d5492089b881965cbd3da';
  newNote2MakerIsSmart = '1'; // It is smartNote

  //changeNote's variables
  changeNoteOwner = "ef17beaef3f11a36a7e22d4d6e03cee6bd059ec8fa9553d16223a1859f22b48b"; // It automatically calculated
  changeNoteValue = '3';
  changeNoteType = '0';
  changeNoteViewKey = '1111111111111111111111111111111111111111111111111111111111111111';
  changeNoteSalt = 'c517f646255d5492089b881965cbd3da';
  changeNoteIsSmart = '1';

  //price
  price = '1'

  let command = getSettleOrderCommand(
    makerNoteOwner, makerNoteValue, makerNoteType, makerNoteViewKey, makerNoteSalt, makerNoteIsSmart, //makerNote's variables
    taker2MakerNoteOwner, taker2MakerNoteValue, taker2MakerNoteType, taker2MakerNoteViewKey, taker2MakerNoteSalt, taker2MakerNoteIsSmart, //takerNoteToMakerNote's variables
    newNote2TakerOwner, newNote2TakerValue, newNote2TakerType, newNote2TakerViewKey, newNote2TakerSalt, newNote2TakerIsSmart, //newNoteToTakerNote's variables
    newNote2MakerOwner, newNote2MakerValue, newNote2MakerType, newNote2MakerViewKey, newNote2MakerSalt, newNote2MakerIsSmart, //newNoteToMakerNote's variables
    changeNoteOwner, changeNoteValue, changeNoteType, changeNoteViewKey, changeNoteSalt, changeNoteIsSmart, //changeNote's variables
    price // price
  );
}

// v1 - v2/price < 0, makerNote --> (newNoteToTaker), takerNoteToMaker --> (newNoteToMaker, Change)
// price == 1
// all note type == 0
// taker tried to buy some of makerNote's amount
function test2(){
  // makerNote's variables
  // hash(makerNote) : 'ef17beaef3f11a36a7e22d4d6e03cee6bd059ec8fa9553d16223a1859f22b48b'
  // makerNote --> (newNoteToTakerNote, ChangeNote)
  makerNoteOwner = "1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61";
  makerNoteValue = '7';
  makerNoteType = '0';
  makerNoteViewKey = "1111111111111111111111111111111111111111111111111111111111111111";
  makerNoteSalt = "c517f646255d5492089b881965cbd3da";
  makerNoteIsSmart = '0';

  // takerNoteToMakerNote's variables
  // hash(takerNoteToMakerNote) : "cbb0f25efa51213a96d54ffee7fba8969b909045ac10c4da610e9f5821b53cf8"
  // makerNote --> (newNoteToTakerNote, ChangeNote)
  taker2MakerNoteOwner = "ef17beaef3f11a36a7e22d4d6e03cee6bd059ec8fa9553d16223a1859f22b48b"; // It automatically calculated
  taker2MakerNoteValue = '8';
  taker2MakerNoteType = '0';
  taker2MakerNoteViewKey = '1111111111111111111111111111111111111111111111111111111111111111';
  taker2MakerNoteSalt = "c517f646255d5492089b881965cbd3da";
  taker2MakerNoteIsSmart = '1';

  // takerNoteToMakerNote's variables
  // hash(newNoteToTakerNote) :
  // newNoteToTakerNote's variables
  newNote2TakerOwner = "2aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61"; //taker2MakerNote.parent
  newNote2TakerValue = '7'; // takerNoteToMakerNote.value == newNoteToTakerNote.value
  newNote2TakerType = '0';
  newNote2TakerViewKey = '1111111111111111111111111111111111111111111111111111111111111111';
  newNote2TakerSalt = "c517f646255d5492089b881965cbd3da";
  newNote2TakerIsSmart = '1'; // It is smartNote

  //newNoteToMakerNote's variables
  newNote2MakerOwner = "ef17beaef3f11a36a7e22d4d6e03cee6bd059ec8fa9553d16223a1859f22b48b"; // It automatically calculated
  newNote2MakerValue = '7';
  newNote2MakerType = '0';
  newNote2MakerViewKey = '1111111111111111111111111111111111111111111111111111111111111111';
  newNote2MakerSalt = 'c517f646255d5492089b881965cbd3da';
  newNote2MakerIsSmart = '1'; // It is smartNote

  //changeNote's variables
  changeNoteOwner = "2aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61"; // It automatically calculated
  changeNoteValue = '1';
  changeNoteType = '0';
  changeNoteViewKey = '1111111111111111111111111111111111111111111111111111111111111111';
  changeNoteSalt = 'c517f646255d5492089b881965cbd3da';
  changeNoteIsSmart = '1';

  //price
  price = '1'

  let command = getSettleOrderCommand(
    makerNoteOwner, makerNoteValue, makerNoteType, makerNoteViewKey, makerNoteSalt, makerNoteIsSmart, //makerNote's variables
    taker2MakerNoteOwner, taker2MakerNoteValue, taker2MakerNoteType, taker2MakerNoteViewKey, taker2MakerNoteSalt, taker2MakerNoteIsSmart, //takerNoteToMakerNote's variables
    newNote2TakerOwner, newNote2TakerValue, newNote2TakerType, newNote2TakerViewKey, newNote2TakerSalt, newNote2TakerIsSmart, //newNoteToTakerNote's variables
    newNote2MakerOwner, newNote2MakerValue, newNote2MakerType, newNote2MakerViewKey, newNote2MakerSalt, newNote2MakerIsSmart, //newNoteToMakerNote's variables
    changeNoteOwner, changeNoteValue, changeNoteType, changeNoteViewKey, changeNoteSalt, changeNoteIsSmart, //changeNote's variables
    price // price
  );
}

// test1();
// test2();

module.exports = {
  getSettleOrderCommand,
}
