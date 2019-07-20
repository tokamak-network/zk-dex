const { balance } = require('openzeppelin-test-helpers');
const { expect } = require('chai');
const rlp = require('rlp');

const MakeNoteVerifier = artifacts.require("mintNBurnNote_Verifier.sol");
const SpendNoteVerifier = artifacts.require("transferNote_Verifier.sol");
const MakeOrderVerifier = artifacts.require("makeOrder_Verifier.sol");
const TakeOrderVerifier = artifacts.require("takeOrder_Verifier.sol");
const SettleOrderVerifier = artifacts.require("settleOrder_Verifier.sol");

const ZkDex = artifacts.require("ZkDex");
const MockDai = artifacts.require("MockDai");

const util = require('../scripts/lib/util');
const {
  constants,
  Note,
  NoteState,
  decrypt,
  createProof
} = require('../scripts/lib/Note');
const { Wallet } = require('../scripts/lib/Wallet');

const ether = (n) => web3.utils.toBN(n).mul(web3.utils.toBN(1e18.toString(10)));


const OrderState = {
  Created: web3.utils.toBN('0'),
  Taken: web3.utils.toBN('1'),
  Settled: web3.utils.toBN('3'),
};

contract('ZkDex', function(accounts) {
  let dai, market, wallet;

  // Initial setup
  beforeEach(async () => {
    const development = true;

    dai = await MockDai.new();
    market = await ZkDex.new(
      development,
      dai.address,
      (await MakeNoteVerifier.new()).address,
      (await SpendNoteVerifier.new()).address,
      (await MakeOrderVerifier.new()).address,
      (await TakeOrderVerifier.new()).address,
      (await SettleOrderVerifier.new()).address,
    );

    wallet = new Wallet();
    await wallet.init(market.address);

    accounts.forEach(a => {
      const vk = a + util.unmarshal(web3.utils.fromAscii('vitalik'));
      wallet.setVk(a, vk);
    });
  });

  async function checkOrderState(orderId, orderState) {
    const order = await market.orders(orderId);

    expect(order[order.length - 1], orderState, "order state mismatch");
  }

  async function checkNote(note, noteState, msg = "") {
    expect(await market.notes(note.hash()), noteState, "note state mismatch" + msg);

    if (noteState == NoteState.Invalid) {
      return;
    }

    const encryptedNote = await market.encryptedNotes(note.hash());

    const decryptedNote = decrypt(encryptedNote, note.viewingKey);

    expect(note.toString(), decryptedNote.toString(), "decrypted note doesn't match with original note" + msg);
  }

  async function createDAINote(owner, value, viewingKey, salt) {
    const note = new Note(owner, value, constants.DAI_TOKEN_TYPE, viewingKey, salt);

    const ownerBalance = await dai.balanceOf(owner);
    const marketBalance = await dai.balanceOf(market.address);

    await dai.approve(market.address, value, { from: owner });
    const mintTx = await market.mint(...createProof.dummyProofCreateNote(note), note.encrypt(), {
      from: owner
    });

    expect(mintTx.logs[0].args.note, note.hash(), 'note hash mismatch');

    const ownerBalanceDiff = (await dai.balanceOf(owner)).sub(ownerBalance);
    const marketBalanceDiff = (await dai.balanceOf(market.address)).sub(marketBalance);

    expect(ownerBalanceDiff.neg(), value, "owner dai balance mismatch");
    expect(marketBalanceDiff, value, "market dai balance mismatch");

    await checkNote(note, NoteState.Valid);
    return note;
  }

  async function createETHNote(owner, value, viewingKey, salt) {
    const note = new Note(owner, value, constants.ETH_TOKEN_TYPE, viewingKey, salt);

    const ownerBalance = web3.utils.toBN(await web3.eth.getBalance(owner));
    const marketBalance = web3.utils.toBN(await web3.eth.getBalance(market.address));

    const mintTx = await market.mint(...createProof.dummyProofCreateNote(note), note.encrypt(), {
      from: owner,
      value: value,
    });

    expect(mintTx.logs[0].args.note, note.hash(), 'note hash mismatch');

    const ownerBalanceDiff = web3.utils.toBN(await web3.eth.getBalance(owner)).sub(ownerBalance);
    const marketBalanceDiff = web3.utils.toBN(await web3.eth.getBalance(market.address)).sub(marketBalance);

    expect(ownerBalanceDiff.neg(), value, "owner eth balance mismatch");
    expect(marketBalanceDiff, value, "market eth balance mismatch");

    await checkNote(note, NoteState.Valid);
    return note;
  }

  async function spendNote(oldNote, newNote1, newNote2, originalNote = null) {
    await checkNote(oldNote, NoteState.Valid);
    await checkNote(newNote1, NoteState.Invalid);
    await checkNote(newNote2, NoteState.Invalid);

    await market.spend(
      ...createProof.dummyProofSpendNote(oldNote, newNote1, newNote2, originalNote),
      newNote1.encrypt(),
      newNote2.encrypt(),
    );

    await checkNote(oldNote, NoteState.Spent);
    await checkNote(newNote1, NoteState.Valid);
    await checkNote(newNote2, NoteState.Valid);
  }

  async function liquidateNote(note) {
    const getBalance =
      note.token === constants.DAI_TOKEN_TYPE ? dai.balanceOf :
      note.token === constants.ETH_TOKEN_TYPE ? async (addr) => web3.utils.toBN(await web3.eth.getBalance(addr)) :
      () => {throw new Error("undefined token type:" + note.token)};

    const owner = note.getOwner();

    const ownerBalance = await getBalance(owner);
    const marketBalance = await getBalance(market.address);

    await market.liquidate(
      owner,
      ...createProof.dummyProofLiquidateNote(note),
    );

    const ownerBalanceDiff = (await getBalance(owner)).sub(ownerBalance);
    const marketBalanceDiff = (await getBalance(market.address)).sub(marketBalance);

    expect(ownerBalanceDiff, note.value, "owner eth balance mismatch");
    expect(marketBalanceDiff.neg(), note.value, "market eth balance mismatch");

    await checkNote(note, NoteState.Spent);
  }

  describe("Wallet", async () => {
    describe("create a note", () => {
      it("should create a new note from DAI", async () => {
        const vk = wallet.getVk(accounts[0]);
        const salt = web3.utils.randomHex(32);

        console.log("vk,", vk, vk.length);
        await createDAINote(accounts[0], ether(5), vk, salt);
      });

      it("should create a new note from ETH", async () => {
        const vk = wallet.getVk(accounts[0]);
        const salt = web3.utils.randomHex(32);
        await createETHNote(accounts[0], ether(5), vk, salt);
      });
    });

    describe("spend and liquidate a note", () => {
      const oldNoteAmount = ether('5');
      const newNote1Amount = ether('4');
      const newNote2Amount = ether('1');

      const oldNoteOwner = accounts[0];
      const newNote1Owner = accounts[1];
      const newNote2Owner = accounts[2];

      let vk1, vk2, vk3;

      let daiNote, ethNote;

      beforeEach(async () => {
        vk1 = wallet.getVk(oldNoteOwner);
        vk2 = wallet.getVk(newNote1Owner);
        vk3 = wallet.getVk(newNote2Owner);


        daiNote = await createDAINote(oldNoteOwner, oldNoteAmount, vk1, web3.utils.randomHex(32));
        ethNote = await createETHNote(oldNoteOwner, oldNoteAmount, vk1, web3.utils.randomHex(32));
      });

      it("should spend DAI note", async () => {
        const newNote1 = new Note(newNote1Owner, newNote1Amount, constants.DAI_TOKEN_TYPE, vk2, web3.utils.randomHex(32));
        const newNote2 = new Note(newNote2Owner, newNote2Amount, constants.DAI_TOKEN_TYPE, vk3, web3.utils.randomHex(32));

        await spendNote(daiNote, newNote1, newNote2);
      });

      it("should spend ETH note", async () => {
        const newNote1 = new Note(newNote1Owner, newNote1Amount, constants.ETH_TOKEN_TYPE, vk2, web3.utils.randomHex(32));
        const newNote2 = new Note(newNote2Owner, newNote2Amount, constants.ETH_TOKEN_TYPE, vk3, web3.utils.randomHex(32));

        await spendNote(ethNote, newNote1, newNote2);
      });

      it('should liquidate a note without spending', async () => {
        await liquidateNote(daiNote);
        await liquidateNote(ethNote);
      });

      it('should liquidate a DAI note after spending', async () => {
        const newNote1 = new Note(newNote1Owner, newNote1Amount, constants.DAI_TOKEN_TYPE, vk2, web3.utils.randomHex(32));
        const newNote2 = new Note(newNote2Owner, newNote2Amount, constants.DAI_TOKEN_TYPE, vk3, web3.utils.randomHex(32));

        await spendNote(daiNote, newNote1, newNote2);

        await liquidateNote(newNote1);
        await liquidateNote(newNote2);
      });

      it('should liquidate a ETH note after spending', async () => {
        const newNote1 = new Note(newNote1Owner, newNote1Amount, constants.ETH_TOKEN_TYPE, vk2, web3.utils.randomHex(32));
        const newNote2 = new Note(newNote2Owner, newNote2Amount, constants.ETH_TOKEN_TYPE, vk3, web3.utils.randomHex(32));

        await spendNote(ethNote, newNote1, newNote2);

        await liquidateNote(newNote1);
        await liquidateNote(newNote2);
      });
    });
  })

  describe("Market", () => {
    const sourceToken = constants.DAI_TOKEN_TYPE;
    const targetToken = constants.ETH_TOKEN_TYPE;

    const makerDAIAmount = ether('10');
    const takerETHAmount = ether('100');
    const price = web3.utils.toBN('10');

    const maker = accounts[0];
    const taker = accounts[1];

    const makerVk = maker + util.unmarshal(web3.utils.fromAscii('vitalik'));
    const takerVk = taker + util.unmarshal(web3.utils.fromAscii('vitalik'));

    const orderId = 0; // event doesn't fired due to solidity stack limit

    let makerNote, takerNote;
    let stakeNote;
    let rewardNote, paymentNote, changeNote;

    beforeEach(async () => {
      makerNote = await createDAINote(maker, makerDAIAmount, makerVk, web3.utils.randomHex(32));
      takerNote = await createETHNote(taker, takerETHAmount, takerVk, web3.utils.randomHex(32));
    });

    async function makeOrder() {
      await market.makeOrder(makerVk, targetToken, price, ...createProof.dummyProofMakeOrder(makerNote));

      await checkNote(makerNote, NoteState.Traiding);
      await checkOrderState(orderId, OrderState.Created);
    }

    async function takeOrder() {
      stakeNote = new Note(makerNote.hash(), takerNote.value, targetToken, makerVk, web3.utils.randomHex(32), true);
      await market.takeOrder(
        orderId,
        ...createProof.dummyProofTakeOrder(makerNote, takerNote, stakeNote),
        stakeNote.encrypt(),
      );

      await checkNote(takerNote, NoteState.Traiding);
      await checkNote(stakeNote, NoteState.Traiding);
      await checkOrderState(orderId, OrderState.Taken);
    }

    async function settleOrder() {
      rewardNote = new Note(takerNote.hash(), makerNote.value, sourceToken, takerVk, web3.utils.randomHex(32), true);
      paymentNote = new Note(makerNote.hash(), takerNote.value, targetToken, takerVk, web3.utils.randomHex(32), true);
      changeNote = new Note(makerNote.hash(), ether('0'), sourceToken, makerVk, web3.utils.randomHex(32), true);


      await market.settleOrder(
        orderId,
        ...createProof.dummyProofSettleOrder(
          makerNote,
          takerNote,
          stakeNote,
          rewardNote,
          paymentNote,
          changeNote,
          price
        ),
        rlp.encode([rewardNote.encrypt(), paymentNote.encrypt(), changeNote.encrypt()]),
      );

      await checkNote(makerNote, NoteState.Spent);
      await checkNote(takerNote, NoteState.Spent);
      await checkNote(stakeNote, NoteState.Spent);

      await checkNote(rewardNote, NoteState.Valid);
      await checkNote(paymentNote, NoteState.Valid);
      await checkNote(changeNote, NoteState.Valid);

      await checkOrderState(orderId, OrderState.Settled);
    }

    it("should make an order", async () => {
      await makeOrder();
    });

    it("should take an order", async () => {
      await makeOrder();
      await takeOrder();
    });

    it('should settle an order', async () => {
      await makeOrder();
      await takeOrder();
      await settleOrder();
    });

    it('should redeem payment note and reward note', async () => {
      await makeOrder();
      await takeOrder();
      await settleOrder();

      const redeemedRewardNote1 = new Note(taker, rewardNote.value, rewardNote.token, takerVk, web3.utils.randomHex(32));
      const redeemedRewardNote2 = new Note(taker, ether('0'), rewardNote.token, takerVk, web3.utils.randomHex(32));

      await spendNote(rewardNote, redeemedRewardNote1, redeemedRewardNote2, takerNote);

      const redeemedPaymentNote1 = new Note(maker, paymentNote.value, paymentNote.token, makerVk, web3.utils.randomHex(32));
      const redeemedPaymentNote2 = new Note(maker, ether('0'), paymentNote.token, makerVk, web3.utils.randomHex(32));

      await spendNote(paymentNote, redeemedPaymentNote1, redeemedPaymentNote2, makerNote);
    });
  });
});


async function calcTxFee(txWithReceipt) {
  const tx = await web3.eth.getTransaction(txWithReceipt.tx);
  return web3.utils.toBN(txWithReceipt.receipt.gasUsed).mul(web3.utils.toBN(tx.gasPrice));
}