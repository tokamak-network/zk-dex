const Market = artifacts.require("Market");
const MockDai = artifacts.require("MockDai");
const { expect } = require('chai');

const util = require('./util');
const { Note, decrypt } = require('./lib/Note');

const ether = (n) => web3.utils.toBN(n).mul(web3.utils.toBN(1e18.toString(10)));

contract('Market', function(accounts) {
  let dai, market;

  let note0;

  // Initial setup
  before(async () => {
    dai = await MockDai.new();
    market = await Market.new(0, ether(1), dai.address);
  });

  it("should create a new note from DAI", async () => {
    // check dai balance and approve the zkdai contract to be able to move tokens
    expect(await dai.balanceOf(accounts[0]), ether(100), '100 dai tokens were not assigned to the 1st account');
    expect(await dai.balanceOf(market.address), 0, 'Zkdai contract should have 0 dai tokens');
    expect(await dai.balanceOf(accounts[0]), ether(100), 'user should have 100 dai tokens');
    await dai.approve(market.address, ether(5));

    const proof = util.parseProof('./test/mintNoteProof.json');
    note0 = new Note('0x01', '0x01', '0x01', '0x01', '0x01');
    const sk = accounts[0] + 'vitalik';
    const encryptedNote = '0x' + note0.encrypt(sk);
    const noteHash = util.calcHash(
      proof[proof.length - 1][0], proof[proof.length - 1][1]
    );

    // the zk proof corresponds to a secret note of value 5
    const mint = await market.mint(...proof, encryptedNote, {value: 1e18});
    const proofHash = mint.logs[0].args.proofHash;

    expect(await dai.balanceOf(market.address), ether(5), 'Zkdai contract should have 5 dai tokens');
    expect(await dai.balanceOf(accounts[0]), ether(95), 'user should have 95 dai');

    await util.sleep(1);
    await market.commit(proofHash);

    expect(await market.encryptedNotes(noteHash), encryptedNote, "encrypted note mismatch");
  });
})