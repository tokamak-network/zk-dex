const { balance } = require('openzeppelin-test-helpers');
const { expect } = require('chai');

const ZkDex = artifacts.require("ZkDex");
const MockDai = artifacts.require("MockDai");

const util = require('./util');
const { Note, decrypt } = require('./lib/Note');

const ether = (n) => web3.utils.toBN(n).mul(web3.utils.toBN(1e18.toString(10)));

contract('ZkDex', function(accounts) {
  let dai, market;

  // Initial setup
  beforeEach(async () => {
    dai = await MockDai.new();
    market = await ZkDex.new(true, dai.address);
  });

  describe("create a note", () => {
    it("should create a new note from DAI", async () => {
      // check dai balance and approve the zkdai contract to be able to move tokens
      expect(await dai.balanceOf(accounts[0]), ether(100), '100 dai tokens were not assigned to the 1st account');
      expect(await dai.balanceOf(market.address), 0, 'Zkdai contract should have 0 dai tokens');
      expect(await dai.balanceOf(accounts[0]), ether(100), 'user should have 100 dai tokens');
      await dai.approve(market.address, ether(5));

      const proof = util.parseProof('./test/mintNoteProof.json');
      const sk = accounts[0] + 'vitalik';
      const note = new Note(accounts[0], ether(5), dai.address, sk, '0x00');
      const encryptedNote = '0x' + note.encrypt(sk);
      const noteHash = util.calcHash(
        proof[proof.length - 1][0], proof[proof.length - 1][1]
      );

      // the zk proof corresponds to a secret note of value 5
      const mintTx = await market.mintDAI(...proof, encryptedNote, {value: ether(1)});
      const proofHash = mintTx.logs[0].args.proofHash;

      expect(await dai.balanceOf(market.address), ether(5), 'Zkdai contract should have 5 dai tokens');
      expect(await dai.balanceOf(accounts[0]), ether(95), 'user should have 95 dai');

      await util.sleep(1);
      await market.commit(proofHash);

      expect(await market.encryptedNotes(noteHash), encryptedNote, "encrypted note mismatch");
    });

    it("should create a new note from ETH", async () => {
      const proof = util.parseProof('./test/mintNoteProof.json');
      const sk = accounts[0] + 'vitalik';
      note = new Note(accounts[0], ether(5), '0x00', sk, '0x00');
      const encryptedNote = '0x' + note.encrypt(sk);
      const noteHash = util.calcHash(
        proof[proof.length - 1][0], proof[proof.length - 1][1]
      );

      const userBalance = await balance.tracker(accounts[0]);
      const marketBalance = await balance.tracker(market.address);

      // the zk proof corresponds to a secret note of value 5
      const mintTx = await market.mintETH(...proof, encryptedNote, {value: ether(6)});
      const proofHash = mintTx.logs[0].args.proofHash;

      expect(await marketBalance.delta(), ether(5), 'Zkdai contract should have 5 dai tokens');
      expect(await userBalance.delta(), ether(5).add(await calcTxFee(mintTx)).neg(), 'user should have 95 dai');

      await util.sleep(1);
      await market.commit(proofHash);

      expect(await market.encryptedNotes(noteHash), encryptedNote, "encrypted note mismatch");
    });
  })
})


async function calcTxFee(txWithReceipt) {
  const tx = await web3.eth.getTransaction(txWithReceipt.tx);
  return web3.utils.toBN(txWithReceipt.receipt.gasUsed).mul(web3.utils.toBN(tx.gasPrice));
}