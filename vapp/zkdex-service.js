const EventEmitter = require('events');
const Web3 = require('web3');
const { toHex, toBN, hexToNumberString, randomHex } = require('web3-utils');
const { throttle } = require('lodash');
const PQ = require('async/priorityQueue');

const db = require('./localstorage');
const ZkDex = require('truffle-contract')(require('../build/contracts/ZkDex.json'));
const {
  marshal,
  unmarshal,
} = require('../scripts/lib/util');
const {
  constants,
  Note,
  DecryptError,
  NoteState,
  decrypt,
} = require('../scripts/lib/Note');

const { TransferHistory, TransferHistoryState } = db;

const targetEvents = [
  'NoteStateChange',
  'OrderTaken',
  'OrderSettled',
];

const PRIORITY_FETCH_ORDER = 1;
const PRIORITY_NOTE_STATE_CHANGE = 3;
const PRIORITY_ORDER_TAKEN = 4;
const PRIORITY_ORDER_SETTLED = 4;

class ZkDexService extends EventEmitter {
  async init (providerUrl, zkdexAddress = '') {
    this._fetchOrders = throttle(this._fetchOrders.bind(this), 500);

    this.web3 = new Web3(providerUrl);
    ZkDex.setProvider(this.web3.currentProvider);
    if (!zkdexAddress) {
      this.zkdex = await ZkDex.deployed();
    } else {
      this.zkdex = await ZkDex.at(zkdexAddress);
    }

    console.log('ZkDex is deployed at', this.zkdex.address);

    // get event handlers
    const getHandlerName = e => `_handle${e}`;
    this._handlers = {

    };
    for (const eventName of targetEvents) {
      this._handlers[eventName] = this[getHandlerName(eventName)].bind(this);
    }

    this.queue = PQ(async (data) => {
      if (data === this._fetchOrders) return this._fetchOrders();

      console.log(`event ${data.event} fired`);

      this[getHandlerName(data.event)](data);
    });

    // initialize queue
    this._fetchOrders();

    this.emitters = {};
    this._listen();
  }

  close () {
    this.closed = true;

    for (const emitter of this.emitters) {
      emitter.removeAllListeners();
    }

    this.removeAllListeners();
  }

  _listen () {
    const NoteStateChange = this.zkdex.NoteStateChange();
    const OrderTaken = this.zkdex.OrderTaken();
    const OrderSettled = this.zkdex.OrderSettled();

    const self = this;

    // TOOD: handle when event is removed
    NoteStateChange.on('data', function (data) {
      self.emitters.NoteStateChange = this;
      self.queue.push(data, PRIORITY_NOTE_STATE_CHANGE);
    });

    OrderTaken.on('data', async function (data) {
      self.emitters.OrderTaken = this;
      await wait(5);
      self.queue.push(data, PRIORITY_ORDER_TAKEN);
    });

    OrderSettled.on('data', async function (data) {
      self.emitters.OrderSettled = this;
      await wait(5);
      self.queue.push(data, PRIORITY_ORDER_SETTLED);
    });
  }

  async _handleNoteStateChange (data) {
    const { note: noteHash, state } = data.args;
    const isSpent = state.cmp(NoteState.Spent) === 0;

    console.log(`[Note#${noteHash}] ${NoteState.toString(state)} isSpent(${isSpent})`);


    const userKeys = db.getUserKeys();
    let found = false;
    // console.log('userKeys', userKeys);

    for (const userKey of userKeys) {
      if (found) return;

      const note = db.getNoteByHash(userKey, noteHash);
      // console.warn(`getNoteByHash User${userKey} Note${noteHash}`);

      if (note) {
        found = true;

        // console.error('NOTE STATE, ', state);
        // console.error(`[Note#${noteHash}] ${NoteState.toString(state)} isSpent(${isSpent})`);
        // console.error('isSpent', isSpent);

        if (isSpent) {
          // send history
          const history = TransferHistory.getHistory(noteHash);
          // console.error(`history: ${history && history.toString()}`);

          if (history && history.state === TransferHistoryState.Init) {
            const timestamp = await this.web3.eth.getBlock(data.blockNumber);
            history.setState(TransferHistoryState.Transferred, timestamp);
            history.addHistoryByUser(userKey);
          }
        }
      }

      const encryptedNote = await this.zkdex.encryptedNotes(noteHash);

      // short circuit for unknown encrypted note
      if (!encryptedNote) return;

      let decryptedNote;
      const f = (v) => {
        if (found) return;
        try {
          decryptedNote = decrypt(encryptedNote, v);

          // ignore invalid decryption
          if (!decryptedNote) return;

          if (db.addNote(userKey, decryptedNote)) {
            console.log(`[User ${userKey}] has Note#${noteHash} isSmart=${decryptedNote.isSmart()}`);
            this.emit('note', null, decryptedNote);
          }
        } catch (e) {
          if (e instanceof DecryptError) {
            return;
          }
          throw e;
        }
        found = true;
      };

      const vks = db.getViewingKeys(userKey);
      // console.log('decrypt with view keys', vks);
      vks.forEach(f);

      if (found) return;

      const accounts = db.getAccounts(userKey);
      // console.log('decrypt with view address', accounts.map(({ address }) => address));
      accounts.map(({ address }) => address).forEach(f);
    }

    if (!found) this.emit('note', new Error(`Note#${noteHash} cannot be decrypted`), null);
  }

  async _handleOrderTaken (data) {
    const {
      orderId,
      takerNoteToMaker: stakeNoteHash,
      parentNote: takerNoteHash,
      takenAt,
    } = data.args;

    const order = db.getOrder(orderId);
    if (!order) {
      console.error('Failed to get order!');
      return;
    }

    order.takerNoteToMaker = stakeNoteHash;
    order.parentNote = takerNoteHash;
    order.takenAt = takenAt;

    const userKeys = db.getUserKeys();

    // TODO: takerInfo and makerInfo should be separated with order data.
    for (const userKey of userKeys) {
      // for taker
      const takerNote = db.getNoteByHash(userKey, takerNoteHash);
      if (takerNote) {
        // console.error('_handleOrderTaken - taker');
        order.takerInfo = {
          takerUserKey: userKey,
          takerNote: takerNote,
        };

        order.taken = true;
        db.addOrUpdateOrderByUser(userKey, order);
        db.updateOrder(order);
      }

      // for maker
      const stakeNote = db.getNoteByHash(userKey, stakeNoteHash);
      if (stakeNote) {
        if (!order.makerInfo) {
          throw new Error('order.makerInfo is not instantiated');
        }

        order.makerInfo.stakeNote = stakeNote;

        const makerNote = Note.fromJSON(order.makerInfo.makerNote);
        order.makerInfo.takerViewingKey = stakeNote.viewingKey;

        const newMakerVk = randomHex(20);
        db.addViewingKeys(userKey, newMakerVk);

        // calculate change note
        const makerAmount = toBN(makerNote.value);
        const stakeAmount = toBN(stakeNote.value);
        const price = toBN(order.price);

        const maxTakerAmount = makerAmount.mul(price);
        const isOverPayment = maxTakerAmount.cmp(stakeAmount) < 0;

        let rewardAmount; // source token amount to taker
        let paymentAmount; // target token amount to maker
        let changeAmount; // source token amount to maker or target token amount to taker

        let changeNoteOwner;
        let changeTokenType;
        let changeNoteEncKey;

        if (!isOverPayment) {
          rewardAmount = stakeAmount.div(price);
          paymentAmount = stakeAmount;
          changeAmount = makerAmount.sub(rewardAmount);

          changeNoteOwner = order.makerNote;
          changeTokenType = makerNote.token;
          changeNoteEncKey = newMakerVk;
        } else {
          rewardAmount = makerAmount;
          paymentAmount = makerAmount.mul(price);
          changeAmount = stakeAmount.sub(paymentAmount);

          changeNoteOwner = takerNoteHash;
          changeTokenType = stakeNote.token;
          changeNoteEncKey = order.makerInfo.takerViewingKey;
        }

        order.makerInfo.rewardNote = new Note(takerNoteHash, rewardAmount, order.sourceToken, '0x00', getSalt(), true);
        order.makerInfo.paymentNote = new Note(makerNote.hash(), paymentAmount, order.targetToken, '0x00', getSalt(), true);
        order.makerInfo.changeNote = new Note(changeNoteOwner, changeAmount, changeTokenType, changeNoteEncKey, getSalt(), true);

        order.makerInfo.rewardNoteEncKey = order.makerInfo.takerViewingKey;
        order.makerInfo.paymentNoteEncKey = newMakerVk;
        order.makerInfo.changeNoteEncKey = changeNoteEncKey;

        order.taken = true;

        db.addOrUpdateOrderByUser(userKey, order);
        db.updateOrder(order);
        this.emit('order:taken', order);
      }
    }
  }
  async _handleOrderSettled (data) {
    const {
      orderId,
      rewardNote: rewardNoteHash,
      paymentNote: paymentNoteHash,
      changeNote: changeNoteHash,
      settledAt,
    } = data.args;

    const order = db.getOrder(orderId);
    if (!order) {
      throw new Error(`failed to read Order#${orderId}`);
    }

    order.rewardNote = rewardNoteHash;
    order.paymentNote = paymentNoteHash;
    order.changeNote = changeNoteHash;
    order.settledAt = settledAt;
    order.settled = true;

    db.updateOrder(order);

    if (order.takerInfo) {
      const userKey = order.takerInfo.takerUserKey;

      order.takerInfo.rewardNote = db.getNoteByHash(userKey, rewardNoteHash);
      order.takerInfo.changeNote = db.getNoteByHash(userKey, changeNoteHash);

      db.addOrUpdateOrderByUser(userKey, order);
      db.updateOrder(order);
    }

    if (order.makerInfo) {
      const userKey = order.makerInfo.makerUserKey;

      order.makerInfo.paymentNote = db.getNoteByHash(userKey, paymentNoteHash);
      order.makerInfo.changeNote = db.getNoteByHash(userKey, changeNoteHash);

      db.addOrUpdateOrderByUser(userKey, order);
      db.updateOrder(order);
    }

    this.emit('order:settled', order);
  }


  async _fetchOrders () {
    if (this.closed) return;

    this.queue.push(this._fetchOrders, PRIORITY_FETCH_ORDER);

    const numOrderContract = toBN(await this.zkdex.getOrderCount()).toNumber();
    const numOrderDB = db.getOrderCount().toNumber();

    // console.error(`
    // fetchOrder
    // numOrderContract:   ${numOrderContract}
    // numOrderDB:         ${numOrderDB}
    // `);

    const userKeys = db.getUserKeys();

    for (let i = numOrderDB; i < numOrderContract; i++) {
      const order = await this.zkdex.orders(i);
      console.log(`Order#${i} fetched`);

      order.sourceToken = hexToNumberString(toHex(order.sourceToken));
      order.targetToken = hexToNumberString(toHex(order.targetToken));
      order.state = hexToNumberString(toHex(order.state));
      order.orderId = i;
      order.orderMaker = null;
      order.type = 'Sell';
      order.amount = null;

      db.increaseOrderCount();
      await db.addOrder(order);
      this.emit('order', order);

      for (const userKey of userKeys) {
        // console.error('userKey, order.makerNote', userKey, order.makerNote);
        const makerNote = db.getNoteByHash(userKey, order.makerNote);
        if (makerNote) {
          order.makerInfo = {
            makerUserKey: userKey,
            makerNote: makerNote,
          };
          db.addOrUpdateOrderByUser(userKey, order);
          db.updateOrder(order);
          this.emit('order:created', order);
          return;
        }
      }
    }
  }
}

function getSalt () {
  return randomHex(20);
}

function wait (t) {
  const sec = t * 1000;
  return new Promise((resolve) => {
    setTimeout(resolve, sec);
  });
}

module.exports = {
  ZkDexService,
};
