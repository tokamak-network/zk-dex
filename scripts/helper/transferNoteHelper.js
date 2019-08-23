const fs = require('fs');
const BN = require('bn.js');
const crypto = require('crypto');

const noteHelper = require('./noteHelper.js');
const zokratesHelper = require('./zokratesHelper.js');

function reduceParams(params) {
  return params
    .map(p => new BN(p, 16).toString(10))
    .reduce((a, b) => `${a} ${b}`, '').trim();
}

function getTransferParams(
  fromPk0, fromPk1, fromValue, fromType, fromViewKey, fromSalt, fromSk, // from's note
  to1Pk0, to1Pk1, to1Value, to1Type, to1ViewKey, to1Salt, // to1's note
  to2Pk0, to1Pk1, to2Value, to2Type, to2ViewKey, to2Salt, // to2's note
  originPk0, originPk1, originValue, originType, originViewKey, originSalt, // if from note is smartNote, then it is smartNote's owner
) {
  const fromParams = noteHelper.getNoteParams(fromPk0, fromPk1, fromValue, fromType, fromViewKey, fromSalt);
  const to1Params = noteHelper.getNoteParams(to1Owner, to1Value, to1Type, to1ViewKey, to1Salt);
  const to2Params = noteHelper.getNoteParams(to2Owner, to2Value, to2Type, to2ViewKey, to2Salt);
  const originParams = noteHelper.getNoteParams(originPk0, originPk1, originValue, originType, originViewKey, originSalt);

  const transferParams = fromParams.concat(to1Params, to2Params, originParams);
  if (require.main === module) {
    zokratesHelper.printZokratesCommand(transferParams);
  }
  return reduceParams(transferParams);
}

function test() {
  // from info
  fromOwner = '1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61';
  fromValue = '6';
  fromType = '0';
  fromViewKey = '1111111111111111111111111111111111111111111111111111111111111111'; // it workss
  fromSalt = 'c517f646255d5492089b881965cbd3da';
  fromIsSmart = '0';

  // to1 info
  to1Owner = '1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61';
  to1Value = '4';
  to1Type = '0';
  to1ViewKey = '1111111111111111111111111111111111111111111111111111111111111111';
  to1Salt = 'c517f646255d5492089b881965cbd3da';
  to1IsSmart = '0';

  // to2 info
  to2Owner = '1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61';
  to2Value = '2';
  to2Type = '0';
  to2ViewKey = '1111111111111111111111111111111111111111111111111111111111111111';
  to2Salt = 'c517f646255d5492089b881965cbd3da';
  to2IsSmart = '0';

  // origin info
  originOwner = '1111111111111111111111111111111111111111111111111111111111111111';
  originValue = '0';
  originType = '0';
  originViewKey = '1111111111111111111111111111111111111111111111111111111111111111';
  originSalt = '0';
  originIsSmart = '0';

  getTransferParams(
    fromOwner, fromValue, fromType, fromViewKey, fromSalt, fromIsSmart, // from's note
    to1Owner, to1Value, to1Type, to1ViewKey, to1Salt, to1IsSmart, // to1's note
    to2Owner, to2Value, to2Type, to2ViewKey, to2Salt, to2IsSmart, // to2's note
    originOwner, originValue, originType, originViewKey, originSalt, originIsSmart, // if from note is smartNote, then it is smartNote's owner
  );
}

function test2() {
  // from info
  fromOwner = '1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61';
  fromValue = '6';
  fromType = '0';
  fromViewKey = '0';
  fromSalt = 'c517f646255d5492089b881965cbd3da';
  fromIsSmart = '0';

  // to1 info
  to1Owner = '1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61';
  to1Value = '4';
  to1Type = '0';
  to1ViewKey = '1111111111111111111111111111111111111111111111111111111111111111';
  to1Salt = 'c517f646255d5492089b881965cbd3da';
  to1IsSmart = '0';

  // to2 info
  to2Owner = '1aba488300a9d7297a315d127837be4219107c62c61966ecdf7a75431d75cc61';
  to2Value = '2';
  to2Type = '0';
  to2ViewKey = '1111111111111111111111111111111111111111111111111111111111111111';
  to2Salt = 'c517f646255d5492089b881965cbd3da';
  to2IsSmart = '0';

  // origin info
  originOwner = '1111111111111111111111111111111111111111111111111111111111111111';
  originValue = '0';
  originType = '0';
  originViewKey = '1111111111111111111111111111111111111111111111111111111111111111';
  originSalt = '0';
  originIsSmart = '0';

  getTransferParams(
    fromOwner, fromValue, fromType, fromViewKey, fromSalt, fromIsSmart, // from's note
    to1Owner, to1Value, to1Type, to1ViewKey, to1Salt, to1IsSmart, // to1's note
    to2Owner, to2Value, to2Type, to2ViewKey, to2Salt, to2IsSmart, // to2's note
    originOwner, originValue, originType, originViewKey, originSalt, originIsSmart, // if from note is smartNote, then it is smartNote's owner
  );
}

// it works
// test();

// it works
// test2();

module.exports = {
  getTransferParams,
};
