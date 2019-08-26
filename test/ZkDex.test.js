const { BN, balance } = require('openzeppelin-test-helpers');
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

const SALT_SIZE = 16; // 16 bytes

contract('ZkDex', function([_, ...accounts]) {
  const development = false;

  let dai, market, wallet;

  // Initial setup
  beforeEach(async () => {
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

    await Promise.all(accounts.map(from => dai.mint({from})));
  });

  async function checkOrderState(orderId, orderState) {
    const order = await market.orders(orderId);

    expect(order[order.length - 1], orderState, "order state mismatch");
  }

  async function checkNote(note, noteState, decKey = "", msg = "") {
    expect(await market.notes(note.hash()), noteState, "note state mismatch" + msg);

    if (noteState == NoteState.Invalid) {
      return;
    }

    if (!decKey) {
      return;
    }

    const encryptedNote = await market.encryptedNotes(note.hash());
    expect(String(encryptedNote) != "", "encrypted note is empty");

    const decryptedNote = decrypt(encryptedNote, decKey);

    expect(note.toString(), decryptedNote.toString(), "decrypted note doesn't match with original note" + msg);
  }

  async function createDAINote(owner, value, encKey, decKey) {
    const note = new Note(owner, value, constants.DAI_TOKEN_TYPE, "0x00", getSalt());

    const ownerBalance = await dai.balanceOf(owner);
    const marketBalance = await dai.balanceOf(market.address);

    await dai.approve(market.address, value, { from: owner });

    const mintTx = await market.mint(
      ...(
        development
          ? createProof.dummyProofCreateNote(note)
          : await dockerUtils.getMintNBurnProof(note)
      ),
      note.encrypt(encKey),
      {
        from: owner
      }
    );

    expect(mintTx.logs[0].args.note, note.hash(), 'note hash mismatch');

    const ownerBalanceDiff = (await dai.balanceOf(owner)).sub(ownerBalance);
    const marketBalanceDiff = (await dai.balanceOf(market.address)).sub(marketBalance);

    expect(ownerBalanceDiff.neg(), value, "owner dai balance mismatch");
    expect(marketBalanceDiff, value, "market dai balance mismatch");

    await checkNote(note, NoteState.Valid, decKey);
    return note;
  }

  async function createETHNote(owner, value, encKey, decKey) {
    const note = new Note(owner, value, constants.ETH_TOKEN_TYPE, '0x00', getSalt());

    const ownerBalance = web3.utils.toBN(await web3.eth.getBalance(owner));
    const marketBalance = web3.utils.toBN(await web3.eth.getBalance(market.address));

    const mintTx = await market.mint(
      ...(
        development
          ? createProof.dummyProofCreateNote(note)
          : await dockerUtils.getMintNBurnProof(note)
      ),
      note.encrypt(encKey),
      {
        from: owner,
        value: value,
      }
    );

    expect(mintTx.logs[0].args.note, note.hash(), 'note hash mismatch');

    const ownerBalanceDiff = web3.utils.toBN(await web3.eth.getBalance(owner)).sub(ownerBalance);
    const marketBalanceDiff = web3.utils.toBN(await web3.eth.getBalance(market.address)).sub(marketBalance);

    expect(ownerBalanceDiff.neg(), value, "owner eth balance mismatch");
    expect(marketBalanceDiff, value, "market eth balance mismatch");

    await checkNote(note, NoteState.Valid, decKey);
    return note;
  }

  async function spendNote(originalNote, oldNote, newNote1, newNote2, encKey1, decKey1, encKey2, decKey2) {
    await checkNote(oldNote, NoteState.Valid);
    await checkNote(newNote1, NoteState.Invalid, decKey1);
    await checkNote(newNote2, NoteState.Invalid, decKey2);

    await market.spend(
      ...(
        development
          ? createProof.dummyProofSpendNote(oldNote, newNote1, newNote2, originalNote)
          : await dockerUtils.getTransferProof(oldNote, newNote1, newNote2, originalNote)
      ),
      newNote1.encrypt(encKey1),
      newNote2.encrypt(encKey2),
    );

    await checkNote(oldNote, NoteState.Spent);
    await checkNote(newNote1, NoteState.Valid, decKey1);
    await checkNote(newNote2, NoteState.Valid, decKey2);
  }

  async function liquidateNote(note, decKey, owner) {
    const getBalance =
      note.token === constants.DAI_TOKEN_TYPE ? dai.balanceOf :
      note.token === constants.ETH_TOKEN_TYPE ? async (addr) => web3.utils.toBN(await web3.eth.getBalance(addr)) :
      () => {throw new Error("undefined token type:" + note.token)};

    const ownerBalance = await getBalance(owner);
    const marketBalance = await getBalance(market.address);

    await market.liquidate(
      owner,
      ...(
        development
          ? createProof.dummyProofCreateNote(note)
          : await dockerUtils.getMintNBurnProof(note)
      )
    );

    const ownerBalanceDiff = (await getBalance(owner)).sub(ownerBalance);
    const marketBalanceDiff = (await getBalance(market.address)).sub(marketBalance);

    expect(ownerBalanceDiff, note.value, "owner eth balance mismatch");
    expect(marketBalanceDiff.neg(), note.value, "market eth balance mismatch");

    await checkNote(note, NoteState.Spent, decKey);
  }

  describe("Wallet", async () => {
    describe("create a note", () => {
      it("should create a new note from DAI", async () => {
        const vk = wallet.getVk(accounts[0]);
        await createDAINote(accounts[0], ether(5), vk, vk);
      });

      it("should create a new note from ETH", async () => {
        const vk = wallet.getVk(accounts[0]);
        await createETHNote(accounts[0], ether(5), vk, vk);
      });
    });

    describe("spend and liquidate a note", () => {
      const oldNoteAmount = ether('5');
      const newNote1Amount = ether('4');
      const newNote2Amount = ether('1');

      const oldNoteOwner = accounts[0];
      const newNote1Owner = accounts[1];
      const newNote2Owner = accounts[2];

      let vk0, vk1, vk2;

      let daiNote, ethNote;


      beforeEach(async () => {
        vk0 = wallet.getVk(oldNoteOwner);
        vk1 = wallet.getVk(newNote1Owner);
        vk2 = wallet.getVk(newNote2Owner);

        daiNote = await createDAINote(oldNoteOwner, oldNoteAmount, vk0, vk0);
        ethNote = await createETHNote(oldNoteOwner, oldNoteAmount, vk0, vk0);
      });

      it("should spend DAI note", async () => {
        const newNote1 = new Note(newNote1Owner, newNote1Amount, constants.DAI_TOKEN_TYPE, "0x00", getSalt());
        const newNote2 = new Note(newNote2Owner, newNote2Amount, constants.DAI_TOKEN_TYPE, "0x00", getSalt());

        await spendNote(null, daiNote, newNote1, newNote2, vk1, vk1, vk2, vk2);
      });

      it("should spend ETH note", async () => {
        const newNote1 = new Note(newNote1Owner, newNote1Amount, constants.ETH_TOKEN_TYPE, "0x00", getSalt());
        const newNote2 = new Note(newNote2Owner, newNote2Amount, constants.ETH_TOKEN_TYPE, "0x00", getSalt());

        await spendNote(null, ethNote, newNote1, newNote2, vk1, vk1, vk2, vk2);
      });

      it('should liquidate a note without spending', async () => {
        await liquidateNote(daiNote, vk0, oldNoteOwner);
        await liquidateNote(ethNote, vk0, oldNoteOwner);
      });

      it('should liquidate a DAI note after spending', async () => {
        const owner = accounts[2];

        const newNote1 = new Note(newNote1Owner, newNote1Amount, constants.DAI_TOKEN_TYPE, "0x00", getSalt());
        const newNote2 = new Note(newNote2Owner, newNote2Amount, constants.DAI_TOKEN_TYPE, "0x00", getSalt());

        await spendNote(null, daiNote, newNote1, newNote2, vk1, vk1, vk2, vk2);

        await liquidateNote(newNote1, vk1, newNote1Owner);
        await liquidateNote(newNote2, vk2, newNote2Owner);
      });

      it('should liquidate a ETH note after spending', async () => {
        const newNote1 = new Note(newNote1Owner, newNote1Amount, constants.ETH_TOKEN_TYPE, vk1, getSalt());
        const newNote2 = new Note(newNote2Owner, newNote2Amount, constants.ETH_TOKEN_TYPE, vk2, getSalt());

        await spendNote(null, ethNote, newNote1, newNote2, vk1, vk1, vk2, vk2);

        await liquidateNote(newNote1, vk1, newNote1Owner);
        await liquidateNote(newNote2, vk2, newNote2Owner);
      });
    });
  });

  describe("Market", () => {
    const sourceToken = constants.DAI_TOKEN_TYPE;
    const targetToken = constants.ETH_TOKEN_TYPE;

    const makerDAIAmount = ether('10');
    const takerETHAmount = ether('100');
    const price = web3.utils.toBN('10');

    const maker = accounts[0];
    const taker = accounts[1];

    let makerVk, takerVk;

    const orderId = 0; // event doesn't fired due to solidity stack limit

    let makerNote, takerNote;
    let stakeNote;
    let rewardNote, paymentNote, changeNote;

    beforeEach(async () => {
      makerVk = wallet.getVk(maker);
      takerVk = wallet.getVk(taker);

      makerNote = await createDAINote(maker, makerDAIAmount, makerVk, makerVk);
      takerNote = await createETHNote(taker, takerETHAmount, takerVk, takerVk);
    });

    async function makeOrder() {
      await market.makeOrder(
        makerVk,
        targetToken,
        price,
        ...(
          development
            ? createProof.dummyProofMakeOrder(makerNote)
            : await dockerUtils.getMakeOrderProof(makerNote)
        )
      );

      await checkNote(makerNote, NoteState.Traiding);
      await checkOrderState(orderId, OrderState.Created);
    }

    async function takeOrder() {
      stakeNote = new Note(makerNote.hash(), takerNote.value, targetToken, takerVk, getSalt(), true);
      await market.takeOrder(
        orderId,
        ...(
          development
            ? createProof.dummyProofTakeOrder(makerNote, takerNote, stakeNote)
            : await dockerUtils.getTakeOrderProof(makerNote, takerNote, stakeNote)
        ),
        stakeNote.encrypt(makerVk),
      );

      await checkNote(takerNote, NoteState.Traiding);
      await checkNote(stakeNote, NoteState.Traiding);
      await checkOrderState(orderId, OrderState.Taken);
    }

    // TODO: add more tests in cse of change to maker and taker.
    async function settleOrder() {
      rewardNote = new Note(takerNote.hash(), makerNote.value, sourceToken, '0x00', getSalt(), true);
      paymentNote = new Note(makerNote.hash(), takerNote.value, targetToken, '0x00', getSalt(), true);
      // 0-value change note goes to maker
      changeNote = new Note(makerNote.hash(), ether('0'), sourceToken, "0x00", getSalt(), true);

      const changeVk = makerVk;

      await market.settleOrder(
        orderId,
        ...(
          development
            ? createProof.dummyProofSettleOrder(
              makerNote,
              takerNote,
              stakeNote,
              rewardNote,
              paymentNote,
              changeNote,
              price)
            : await dockerUtils.getSettleOrderProof(
              makerNote,
              stakeNote,
              rewardNote,
              paymentNote,
              changeNote,
              price)
        ),
        rlp.encode([
          rewardNote.encrypt(takerVk),
          paymentNote.encrypt(makerVk),
          changeNote.encrypt(changeVk)
        ]),
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

      const redeemedRewardNote1 = new Note(taker, rewardNote.value, rewardNote.token, takerVk, getSalt());
      const redeemedRewardNote2 = new Note(taker, ether('0'), rewardNote.token, takerVk, getSalt());

      await spendNote(takerNote, rewardNote, redeemedRewardNote1, redeemedRewardNote2, takerVk, takerVk, takerVk, takerVk);

      const redeemedPaymentNote1 = new Note(maker, paymentNote.value, paymentNote.token, makerVk, getSalt());
      const redeemedPaymentNote2 = new Note(maker, ether('0'), paymentNote.token, makerVk, getSalt());

      await spendNote(makerNote, paymentNote, redeemedPaymentNote1, redeemedPaymentNote2, makerVk, makerVk, makerVk, makerVk);
    });
  });
});

async function calcTxFee(txWithReceipt) {
  const tx = await web3.eth.getTransaction(txWithReceipt.tx);
  return web3.utils.toBN(txWithReceipt.receipt.gasUsed).mul(web3.utils.toBN(tx.gasPrice));
}

function getSalt() {
  return web3.utils.randomHex(SALT_SIZE);
}