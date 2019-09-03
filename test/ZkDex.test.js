const range = require('lodash/range');
const { BN, balance } = require('openzeppelin-test-helpers');
const { expect } = require('chai');
const rlp = require('rlp');

const MakeNoteVerifier = artifacts.require("mintNBurnNote_Verifier.sol");
const SpendNoteVerifier = artifacts.require("transferNote_Verifier.sol");
const ConvertNoteVerifier = artifacts.require("convertNote_Verifier.sol");
const MakeOrderVerifier = artifacts.require("makeOrder_Verifier.sol");
const TakeOrderVerifier = artifacts.require("takeOrder_Verifier.sol");
const SettleOrderVerifier = artifacts.require("settleOrder_Verifier.sol");

const ZkDex = artifacts.require("ZkDex");
const MockDai = artifacts.require("MockDai");

const util = require('../scripts/lib/util');
const {
  getSk,
  getOwner,
} = require('../scripts/helper/accountHelper');

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

const OrderState = {
  Created: web3.utils.toBN('0'),
  Taken: web3.utils.toBN('1'),
  Settled: web3.utils.toBN('3'),
};

// 2 zk-dex accounts
const sks = [getSk(), getSk()];
const sksHex = sks.map(sk => '0x' + sk.n.toString(16, 64));
const noteOwners = sks.map(getOwner);

const vks = range(2).map(() => web3.utils.randomHex(16));
console.log("vks", vks);
console.log("sks", sks);
console.log("sksHex", sksHex);

// note salt
const getSalt = () => web3.utils.randomHex(16);

contract('ZkDex', function([...accounts]) {
  const development = false;

  let dai, zkdex, wallet;

  // Initial setup
  beforeEach(async () => {
    dai = await MockDai.new();
    zkdex = await ZkDex.new(
      development,
      dai.address,
      (await MakeNoteVerifier.new()).address,
      (await SpendNoteVerifier.new()).address,
      (await ConvertNoteVerifier.new()).address,
      (await MakeOrderVerifier.new()).address,
      (await TakeOrderVerifier.new()).address,
      (await SettleOrderVerifier.new()).address,
    );

    await Promise.all(accounts.map(e => dai.mint()));

    wallet = new Wallet();
    await wallet.init(zkdex.address);
  });

  async function checkOrderState(orderId, orderState) {
    const order = await zkdex.orders(orderId);

    expect(order[order.length - 1], orderState, "order state mismatch");
  }

  async function checkNote(note, noteState, decKey, msg = "") {
    console.log(msg, 'hash:', note.hash(), 'decKey:', decKey);

    expect(await zkdex.notes(note.hash()), noteState, "note state mismatch" + msg);

    if (noteState == NoteState.Invalid || !decKey) {
      return;
    }

    const encryptedNote = await zkdex.encryptedNotes(note.hash());
    expect(encryptedNote).to.not.be.null;

    const decryptedNote = decrypt(encryptedNote, decKey);

    expect(note.toString(), decryptedNote.toString(), "decrypted note doesn't match with original note" + msg);
  }

  async function createDAINote(owner, value, salt, encKey, decKey, sk, from = accounts[0]) {
    const note = new Note(owner[0], owner[1], value, constants.DAI_TOKEN_TYPE, "0x00", salt);

    const ownerBalance = await dai.balanceOf(from);
    const marketBalance = await dai.balanceOf(zkdex.address);

    await dai.approve(zkdex.address, value, { from });

    const mintTx = await zkdex.mint(
      ...(
        development
          ? createProof.dummyProofCreateNote(note, sk)
          : await dockerUtils.getMintNBurnProof(note, sk)
      ),
      note.encrypt(encKey),
      { from }
    );

    expect(mintTx.logs[0].args.note, note.hash(), 'note hash mismatch');

    const ownerBalanceDiff = (await dai.balanceOf(from)).sub(ownerBalance);
    const marketBalanceDiff = (await dai.balanceOf(zkdex.address)).sub(marketBalance);

    expect(ownerBalanceDiff.neg(), value, "owner dai balance mismatch");
    expect(marketBalanceDiff, value, "market dai balance mismatch");

    await checkNote(note, NoteState.Valid, decKey, "Create DAI Note");
    return note;
  }

  async function createETHNote(owner, value, salt, encKey, decKey, sk, from = accounts[0]) {
    const note = new Note(owner[0], owner[1], value, constants.ETH_TOKEN_TYPE, "0x00", salt);

    const ownerBalance = web3.utils.toBN(await web3.eth.getBalance(from));
    const marketBalance = web3.utils.toBN(await web3.eth.getBalance(zkdex.address));

    const mintTx = await zkdex.mint(
      ...(
        development
          ? createProof.dummyProofCreateNote(note, sk)
          : await dockerUtils.getMintNBurnProof(note, sk)
      ),
      note.encrypt(encKey),
      {
        from,
        value: value,
      }
    );

    expect(mintTx.logs[0].args.note, note.hash(), 'note hash mismatch');

    const ownerBalanceDiff = web3.utils.toBN(await web3.eth.getBalance(from)).sub(ownerBalance);
    const marketBalanceDiff = web3.utils.toBN(await web3.eth.getBalance(zkdex.address)).sub(marketBalance);

    expect(ownerBalanceDiff.neg(), value, "owner eth balance mismatch");
    expect(marketBalanceDiff, value, "market eth balance mismatch");

    await checkNote(note, NoteState.Valid, decKey, "Create ETH Note");
    return note;
  }

  async function spendNote(oldNote1, oldNote2, newNote1, newNote2, encKey1, decKey1, encKey2, decKey2, sk1, sk2) {
    if (oldNote1) await checkNote(oldNote1, NoteState.Valid);
    if (oldNote2) await checkNote(oldNote2, NoteState.Valid);
    if (newNote1) await checkNote(newNote1, NoteState.Invalid, decKey1);
    if (newNote2) await checkNote(newNote2, NoteState.Invalid, decKey2);

    await zkdex.spend(
      ...(
        development
          ? createProof.dummyProofSpendNote(oldNote1, oldNote2, newNote1, newNote2, sk1, sk2)
          : await dockerUtils.getTransferProof(oldNote1, oldNote2, newNote1, newNote2, sk1, sk2)
      ),
      newNote1 ? newNote1.encrypt(encKey1) : "0x00",
      newNote2 ? newNote2.encrypt(encKey2) : "0x00",
    );

    await checkNote(oldNote1, NoteState.Spent);
    if (oldNote2) await checkNote(oldNote2, NoteState.Spent);
    if (newNote1) await checkNote(newNote1, NoteState.Valid, decKey1);
    if (newNote2) await checkNote(newNote2, NoteState.Valid, decKey2);
  }

  async function liquidateNote(note, decKey, sk, from = accounts[0]) {
    const getBalance =
      note.token === constants.DAI_TOKEN_TYPE ? dai.balanceOf :
      note.token === constants.ETH_TOKEN_TYPE ? async (addr) => web3.utils.toBN(await web3.eth.getBalance(addr)) :
      () => {throw new Error("undefined token type:" + note.token)};

    const ownerBalance = await getBalance(from);
    const marketBalance = await getBalance(zkdex.address);

    await zkdex.liquidate(
      from,
      ...(
        development
          ? createProof.dummyProofCreateNote(note, sk)
          : await dockerUtils.getMintNBurnProof(note, sk)
      ),
      { from }
    );

    const ownerBalanceDiff = (await getBalance(from)).sub(ownerBalance);
    const marketBalanceDiff = (await getBalance(zkdex.address)).sub(marketBalance);

    expect(ownerBalanceDiff, note.value, "owner eth balance mismatch");
    expect(marketBalanceDiff.neg(), note.value, "market eth balance mismatch");

    await checkNote(note, NoteState.Spent, decKey);
  }

  async function convertNote(smartNote, originalNote, convertedNote, encKey, decKey, sk) {
    await zkdex.convertNote(
      ...(
        development
          ? createProof.dummyProofConvertNote(smartNote, originalNote, convertedNote, sk)
          : await dockerUtils.getConvertProof(smartNote, originalNote, convertedNote, sk)
      ),
      convertedNote.encrypt(encKey),
    );

    await checkNote(smartNote, NoteState.Spent, null, 'smartNote, NoteState.Spent');
    await checkNote(convertedNote, NoteState.Valid, decKey, 'convertedNote, NoteState.Valid');
  }

  describe("Wallet", async () => {
    describe("create a note", () => {
      it("should create a new note from DAI", async () => {
        await createDAINote(noteOwners[0], ether(5), getSalt(), vks[0], vks[0], sksHex[0], accounts[0]);
      });

      it("should create a new note from ETH", async () => {
        await createETHNote(noteOwners[0], ether(5), getSalt(), vks[0], vks[0], sksHex[0], accounts[0]);
      });
    });

    describe("spend and liquidate a note", () => {
      const oldNoteAmount = ether('5');

      const newNote1Amount = ether('4');
      const newNote2Amount = ether('1');

      const newNote3Amount = ether('3');
      const newNote4Amount = ether('2');

      const oldNoteOwner = noteOwners[0];
      const oldNoteOwnerSk = sksHex[0];

      const newNote1Owner = noteOwners[0];
      const newNote1OwnerSk = sksHex[0];

      const newNote2Owner = noteOwners[1];
      const newNote2OwnerSk = sksHex[1];

      const newNote3Owner = noteOwners[1];
      const newNote3OwnerSk = sksHex[1];

      const newNote4Owner = noteOwners[1];
      const newNote4OwnerSk = sksHex[1];

      const vk1 = vks[0];
      const vk2 = vks[0];
      const vk3 = vks[1];


      let daiNote, ethNote;


      beforeEach(async () => {
        daiNote = await createDAINote(oldNoteOwner, oldNoteAmount, getSalt(), vk1, vk1, oldNoteOwnerSk, accounts[0]);
        ethNote = await createETHNote(oldNoteOwner, oldNoteAmount, getSalt(), vk1, vk1, oldNoteOwnerSk, accounts[0]);
      });

      it("should spend DAI note", async () => {
        const token = constants.DAI_TOKEN_TYPE;
        const newNote1 = new Note(newNote1Owner[0], newNote1Owner[1], newNote1Amount, token, "0x00", getSalt());
        const newNote2 = new Note(newNote2Owner[0], newNote2Owner[1], newNote2Amount, token, "0x00", getSalt());

        await spendNote(daiNote, null, newNote1, newNote2, vk2, vk2, vk3, vk3, oldNoteOwnerSk);
      });

      it("should spend ETH note", async () => {
        const token = constants.ETH_TOKEN_TYPE;
        const newNote1 = new Note(newNote1Owner[0], newNote1Owner[1], newNote1Amount, token, "0x00", getSalt());
        const newNote2 = new Note(newNote2Owner[0], newNote2Owner[1], newNote2Amount, token, "0x00", getSalt());

        await spendNote(ethNote, null, newNote1, newNote2, vk2, vk2, vk3, vk3, oldNoteOwnerSk);
      });

      it("should spend 2 DAI note", async () => {
        const token = constants.DAI_TOKEN_TYPE;
        const newNote1 = new Note(newNote1Owner[0], newNote1Owner[1], newNote1Amount, token, "0x00", getSalt());
        const newNote2 = new Note(newNote2Owner[0], newNote2Owner[1], newNote2Amount, token, "0x00", getSalt());

        await spendNote(daiNote, null, newNote1, newNote2, vk2, vk2, vk3, vk3, oldNoteOwnerSk);

        const newNote3 = new Note(newNote3Owner[0], newNote3Owner[1], newNote3Amount, token, "0x00", getSalt());
        const newNote4 = new Note(newNote4Owner[0], newNote4Owner[1], newNote4Amount, token, "0x00", getSalt());

        await spendNote(newNote1, newNote2, newNote3, newNote4, vk2, vk2, vk3, vk3, newNote1OwnerSk, newNote2OwnerSk);
      });

      it("should spend 2 ETH note", async () => {
        const token = constants.ETH_TOKEN_TYPE;
        const newNote1 = new Note(newNote1Owner[0], newNote1Owner[1], newNote1Amount, token, "0x00", getSalt());
        const newNote2 = new Note(newNote2Owner[0], newNote2Owner[1], newNote2Amount, token, "0x00", getSalt());

        await spendNote(ethNote, null, newNote1, newNote2, vk2, vk2, vk3, vk3, oldNoteOwnerSk);

        const newNote3 = new Note(newNote3Owner[0], newNote3Owner[1], newNote3Amount, token, "0x00", getSalt());
        const newNote4 = new Note(newNote4Owner[0], newNote4Owner[1], newNote4Amount, token, "0x00", getSalt());

        await spendNote(newNote1, newNote2, newNote3, newNote4, vk2, vk2, vk3, vk3, newNote1OwnerSk, newNote2OwnerSk);
      });

      it('should liquidate a note without spending', async () => {
        await liquidateNote(daiNote, vk1, oldNoteOwnerSk);
        await liquidateNote(ethNote, vk1, oldNoteOwnerSk);
      });

      it('should liquidate a DAI note after spending', async () => {
        const newNote1 = new Note(newNote1Owner[0], newNote1Owner[1], newNote1Amount, constants.DAI_TOKEN_TYPE, "0x00", getSalt());
        const newNote2 = new Note(newNote2Owner[0], newNote2Owner[1], newNote2Amount, constants.DAI_TOKEN_TYPE, "0x00", getSalt());

        await spendNote(daiNote, null, newNote1, newNote2, vk2, vk2, vk3, vk3, oldNoteOwnerSk);

        await liquidateNote(newNote1, vk2, newNote1OwnerSk);
        await liquidateNote(newNote2, vk3, newNote2OwnerSk);
      });

      it.only('should liquidate a ETH note after spending', async () => {
        const newNote1 = new Note(newNote1Owner[0], newNote1Owner[1], newNote1Amount, constants.ETH_TOKEN_TYPE, "0x00", getSalt());
        const newNote2 = new Note(newNote2Owner[0], newNote2Owner[1], newNote2Amount, constants.ETH_TOKEN_TYPE, "0x00", getSalt());

        await spendNote(ethNote, null, newNote1, newNote2, vk2, vk2, vk3, vk3, oldNoteOwnerSk);

        await liquidateNote(newNote1, vk2, newNote1OwnerSk);
        await liquidateNote(newNote2, vk3, newNote2OwnerSk);
      });
    });
  });

  describe("Market", () => {
    const sourceToken = constants.DAI_TOKEN_TYPE;
    const targetToken = constants.ETH_TOKEN_TYPE;

    const makerDAIAmount = ether('10');
    const takerETHAmount = ether('100');

    const maker = noteOwners[0];
    const makerSk = sksHex[0];
    const makerVk = vks[0];

    const taker = noteOwners[1];
    const takerSk = sksHex[1];
    const takerVk = vks[1];

    const orderId = 0; // event doesn't fired due to solidity stack limit

    let makerNote, takerNote;
    let stakeNote;
    let rewardNote, paymentNote, changeNote;

    beforeEach(async () => {
      makerNote = await createDAINote(maker, makerDAIAmount, getSalt(), makerVk, makerVk, makerSk, accounts[0]);
      takerNote = await createETHNote(taker, takerETHAmount, getSalt(), takerVk, takerVk, takerSk, accounts[0]);
    });

    async function makeOrder(price) {
      await zkdex.makeOrder(
        makerVk,
        targetToken,
        price,
        ...(
          development
            ? createProof.dummyProofMakeOrder(makerNote, makerSk)
            : await dockerUtils.getMakeOrderProof(makerNote, makerSk)
        )
      );

      await checkNote(makerNote, NoteState.Traiding);
      await checkOrderState(orderId, OrderState.Created);
    }

    async function takeOrder() {
      stakeNote = new Note(makerNote.hash(), null, takerNote.value, targetToken, takerVk, getSalt());
      await zkdex.takeOrder(
        orderId,
        ...(
          development
            ? createProof.dummyProofTakeOrder(takerNote, stakeNote, takerSk)
            : await dockerUtils.getTakeOrderProof(takerNote, stakeNote, takerSk)
        ),
        stakeNote.encrypt(makerVk),
      );

      await checkNote(takerNote, NoteState.Traiding, takerVk, "taker note");
      await checkNote(stakeNote, NoteState.Traiding, makerVk, "stake note");
      await checkOrderState(orderId, OrderState.Taken);
    }

    // TODO: add more tests in cse of change to maker and taker.
    async function settleOrder(price) {
      const maxTakerAmount = makerDAIAmount.mul(price).div(ether('1'));
      const isOverPayment = maxTakerAmount.cmp(takerETHAmount) < 0;

      let rewardAmount;   // DAI amount to taker
      let paymentAmount;  // ETH amount to maker
      let changeAmount;   // DAI amount to maker or ETH amount to taker

      let changeNoteOwner;
      let changeTokenType;
      let changeEncKey;

      if (!isOverPayment) {
        rewardAmount = takerETHAmount.mul(ether('1')).div(price);
        paymentAmount = takerETHAmount;
        changeAmount = makerDAIAmount.sub(rewardAmount);

        changeNoteOwner = makerNote.hash();
        changeTokenType = sourceToken;
        changeEncKey = makerVk;
      } else {
        rewardAmount = makerDAIAmount;
        paymentAmount = makerDAIAmount.mul(price).div(ether('1'));
        changeAmount = takerETHAmount.sub(paymentAmount);

        changeNoteOwner = takerNote.hash();
        changeTokenType = targetToken;
        changeEncKey = takerVk;
      }

      rewardNote = new Note(takerNote.hash(), null, rewardAmount, sourceToken, '0x00', getSalt());
      paymentNote = new Note(makerNote.hash(), null, paymentAmount, targetToken, '0x00', getSalt());
      changeNote = new Note(changeNoteOwner, null, changeAmount, changeTokenType, '0x00', getSalt());

      await zkdex.settleOrder(
        orderId,
        ...(
          development
            ? createProof.dummyProofSettleOrder(
              makerNote,
              stakeNote,
              rewardNote,
              paymentNote,
              changeNote,
              price,
              makerSk)
            : await dockerUtils.getSettleOrderProof(
              makerNote,
              stakeNote,
              rewardNote,
              paymentNote,
              changeNote,
              price,
              makerSk)
        ),
        rlp.encode([
          rewardNote.encrypt(takerVk),
          paymentNote.encrypt(makerVk),
          changeNote.encrypt(changeEncKey)
        ]),
      );

      await checkNote(makerNote, NoteState.Spent, makerVk, 'makerNote, NoteState.Spent');
      await checkNote(takerNote, NoteState.Spent, takerVk, 'takerNote, NoteState.Spent');
      await checkNote(stakeNote, NoteState.Spent, makerVk, 'stakeNote, NoteState.Spent');

      await checkNote(rewardNote, NoteState.Valid, takerVk, 'rewardNote, NoteState.Valid');
      await checkNote(paymentNote, NoteState.Valid, makerVk, 'paymentNote, NoteState.Valid');
      await checkNote(changeNote, NoteState.Valid, changeEncKey, 'changeNote, NoteState.Valid');

      await checkOrderState(orderId, OrderState.Settled);
    }

    const testMarket = (price) => {
      it("should make an order", async () => {
        await makeOrder(price);
      });

      it("should take an order", async () => {
        await makeOrder(price);
        await takeOrder();
      });

      it('should settle an order', async () => {
        await makeOrder(price);
        await takeOrder();
        await settleOrder(price);
      });

      it('should redeem payment note and reward note', async () => {
        await makeOrder(price);
        await takeOrder();
        await settleOrder(price);

        const convertedPaymentNote = new Note(maker[0], maker[1], paymentNote.value, paymentNote.token, makerVk, getSalt());

        await convertNote(paymentNote, makerNote, convertedPaymentNote, makerVk, makerVk, makerSk);

        const convertedRewardNote = new Note(taker[0], taker[1], rewardNote.value, rewardNote.token, takerVk, getSalt());

        await convertNote(rewardNote, takerNote, convertedRewardNote, takerVk, takerVk, takerSk);
      });
    }

    describe("over payment (change to taker)", () => {
      const price = ether('5');
      testMarket(price);
    });

    describe("equal payment (no change", () => {
      const price = ether('10');
      testMarket(price);
    });

    describe("under payment (change to maker)", () => {
      const price = ether('20');
      testMarket(price);
    });
  });
});

async function calcTxFee(txWithReceipt) {
  const tx = await web3.eth.getTransaction(txWithReceipt.tx);
  return web3.utils.toBN(txWithReceipt.receipt.gasUsed).mul(web3.utils.toBN(tx.gasPrice));
}