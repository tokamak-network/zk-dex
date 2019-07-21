const { BN, balance } = require('openzeppelin-test-helpers');
const { expect } = require('chai');
const rlp = require('rlp');

const util = require('../scripts/lib/util');
const dockerUtils = require('../scripts/lib/dockerUtils');
const {
  constants,
  Note,
  NoteState,
  decrypt,
  createProof
} = require('../scripts/lib/Note');
const { Wallet } = require('../scripts/lib/Wallet');

const ether = (n) => web3.utils.toBN(n).mul(web3.utils.toBN(1e18.toString(10)));



context("Note class", () => {
  it("#hash", () => {
    const arr = [];
    arr.push("255813832693635097065676052633603542908");
    arr.push("329284760944238137919747288476235081528");
    arr.push("0");
    arr.push("0");
    arr.push("22685491128062564526039545674804039953");
    arr.push("22685491128062564230891640495451214097");
    arr.push("22685491128062564230891640495451214097");
    arr.push("22685491128062564230891640495451214097");
    arr.push("0");
    arr.push("0");
    arr = arr.map(web3.utils.toBN)


    const testNote = new Note(
      util.marshal(arr[3] + arr[4]),
      util.marshal(arr[5]),
      util.marshal(arr[6]),
      util.marshal(arr[7] + arr[8]),
      util.marshal(arr[9]),
      util.marshal(arr[10]),
    );

    const testHash = util.marshal(arr[0] + arr[1]);

    if(testNote.hash() !== testHash) {
      throw new Error( "note hash doesn't match!")
    }

  });
})