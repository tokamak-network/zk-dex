const EventEmitter = require('events');
const autoBind = require('auto-bind');
const debug = require('debug')('zk-dex-service');
const { throttle } = require('lodash');
const PQ = require('async/priorityQueue');
const moment = require('moment');

const { ZkDexPrivateKey } = require('zk-dex-keystore/lib/Account');
const { addZkPrefix } = require('zk-dex-keystore/lib/utils');

const Web3 = require('web3');
const { toHex, toBN, hexToNumberString, randomHex } = require('web3-utils');

const {
  zkdexService: {
    contractEvents, // ZkDex events to listen
    events, // zk-dex-service evnets
  },
} = require('./constants');
const DB = require('./localstorage');
const ZkDex = require('truffle-contract')(require('../../build/contracts/ZkDex.json'));

const {
  marshal,
  unmarshal,
} = require('../../scripts/lib/util');

const {
  constants,
  Note,
  DecryptError,
  NoteState,
  decrypt,
} = require('../../scripts/lib/Note');

const { TransferHistory, TransferHistoryState } = DB;

// amount scaling factor
const SCALING_FACTOR = toBN('1000000000000000000');

// unlock expiration time (in minute)
const DEFAULT_UNLOCK_DURATION = 5;
const MAX_UNLOCK_DURATION = 43200; // 30 days

// priorities of each events
const PRIORITY_FETCH_ORDER = 1;
const PRIORITY_NOTE_STATE_CHANGE = 2;
const PRIORITY_ORDER_TAKEN = 3;
const PRIORITY_ORDER_SETTLED = 4;

const OrderState = {
  Created: hexToNumberString('0x0'),
  Taken: hexToNumberString('0x1'),
  Settled: hexToNumberString('0x2'),

  toString (s) {
    if (this.Created === s) {
      return 'Created';
    }
    if (this.Taken === s) {
      return 'Taken';
    }
    if (this.Settled === s) {
      return 'Settled';
    }

    throw new Error(`Undefined state: ${s}`);
  },
};

// helper functions
const _accountKey = (userKey, address) => `${marshal(userKey)}-${addZkPrefix(address)}`;

class ZkDexService extends EventEmitter {
  constructor () {
    super();
    autoBind(this);

    this.setMaxListeners(10);

    const getHandlerName = e => `_handle${e}`;

    this._handlers = {};
    this.emitters = {};

    // bind event handlers
    for (const eventName of contractEvents) {
      this._handlers[eventName] = this[getHandlerName(eventName)];
    }
    this._fetchOrders = throttle(this._fetchOrders, 500);

    // OrderCreated event is handled in a different way...
    this.queue = PQ(async (data) => {
      if (data === this._fetchOrders) {
        return this._fetchOrders();
      }

      debug(`Event ${data.event} fired`);

      return this[getHandlerName(data.event)](data);
    });


    this._privKeys = new Map();
  }

  // TODO: clear expired private keys

  /**
   * set unlocked private key
   * @param {string} userKey zk-dex user.
   * @param {ZkDexPrivateKey} privKey Unlocked private key.
   * @param {Number} duration Unlock duration. if duration is `0`, unlock during 30 days (almost infinite)
   */
  setPrivateKey (userKey, privKey, duration = DEFAULT_UNLOCK_DURATION) {
    duration = duration || MAX_UNLOCK_DURATION;

    const address = privKey.toAddress().toString();
    const expiredAt = moment().add(duration, 'minute');

    debug(`set private key (user=${userKey}, address=${address}, expiredAt=${expiredAt.toLocaleString()}), duration=${duration}`);
    debug(`set private key (user=${userKey}, address=${address}, expiredAt=${expiredAt.toLocaleString()}), duration=${duration}`);

    const key = _accountKey(userKey, address);
    this._privKeys.set(key, { privKey, expiredAt });
  }

  /**
   * get unlocked private key
   * @param {string} userKey zk-dex user.
   * @param {string} address zk-dex address with `zk` prefix.
   * @returns {ZkDexPrivateKey || null} Unlocked private key.
   */
  getPrivateKey (userKey, address) {
    const key = _accountKey(userKey, address);

    // short circuit if private key was not set
    if (!this._privKeys.has(key)) return null;

    const { privKey, expiredAt } = this._privKeys.get(key);

    // short circuit if private key was expired
    const now = moment();
    if (expiredAt < now) {
      this._privKeys.delete(address);
      throw new Error(`private key expired: expiredAt=${expiredAt} now=${now} diff=${expiredAt - now}`);
    }

    return privKey;
  }

  /**
   * check if user has unlocked private key
   * @param {string} userKey zk-dex user.
   * @param {string} address zk-dex address with `zk` prefix.
   * @returns {boolean}
   */
  hasPrivateKey (userKey, address) {
    const key = _accountKey(userKey, address);
    return this._privKeys.has(key);
  }

  /**
   * clear unlocked private key
   * @param {string} userKey zk-dex user.
   * @param {string} address zk-dex address with `zk` prefix.
   * @returns {boolean} Map.delete result
   */
  removePrivateKey (userKey, address) {
    const key = _accountKey(userKey, address);

    // short circuit if private key was not set
    if (!this._privKeys.has(key)) return;
    return this._privKeys.delete(key);
  }

  async init (providerUrl, zkdexAddress = '') {
    this.web3 = new Web3(providerUrl);
    debug('Using web3 provider', providerUrl);


    ZkDex.setProvider(this.web3.currentProvider);
    if (!zkdexAddress) {
      this.zkdex = await ZkDex.deployed();
    } else {
      this.zkdex = await ZkDex.at(zkdexAddress);
    }

    debug('ZkDex is deployed at', this.zkdex.address);

    // register target contract event handlers

    this._listenContractEvents();
    this.queue.push(this._fetchOrders, PRIORITY_FETCH_ORDER);
  }

  close () {
    this.closed = true;

    for (const emitter of this.emitters) {
      emitter.removeAllListeners();
    }

    // this.removeAllListeners();
  }

  _listenContractEvents () {
    const NoteStateChange = this.zkdex.NoteStateChange();
    const OrderTaken = this.zkdex.OrderTaken();
    const OrderSettled = this.zkdex.OrderSettled();

    const self = this;

    // TOOD: handle when event is removed

    debug('listening NoteStateChange event');
    NoteStateChange.on('data', function (data) {
      self.emitters.NoteStateChange = this;
      self.queue.push(data, PRIORITY_NOTE_STATE_CHANGE);
    });

    debug('listening OrderTaken event');
    OrderTaken.on('data', async function (data) {
      self.emitters.OrderTaken = this;
      // await wait(5);
      await wait(1);
      self.queue.push(data, PRIORITY_ORDER_TAKEN);
    });

    debug('listening OrderSettled event');
    OrderSettled.on('data', async function (data) {
      self.emitters.OrderSettled = this;
      // await wait(5);
      await wait(1);
      self.queue.push(data, PRIORITY_ORDER_SETTLED);
    });
  }

  async _handleNoteStateChange (data) {
    const { note: noteHash, state } = data.args;

    const isSpent = state.cmp(NoteState.Spent) === 0;

    debug(`[Note#${noteHash}] ${NoteState.toString(state)} isSpent(${isSpent})`);

    const userKeys = DB.getUserKeys();
    let found = false;
    // debug('userKeys', userKeys);

    for (const userKey of userKeys) {
      if (found) return;

      const note = DB.getNoteByHash(userKey, noteHash);
      // debug(`getNoteByHash User${userKey} Note${noteHash}`);

      if (note) {
        found = true;

        // debug('NOTE STATE, ', state);
        // debug(`[Note#${noteHash}] ${NoteState.toString(state)} isSpent(${isSpent})`);
        // debug('isSpent', isSpent);

        if (isSpent) {
          // send history
          const history = TransferHistory.getHistory(noteHash);
          // debug(`history: ${history && history.toString()}`);

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

          if (DB.addNote(userKey, decryptedNote)) {
            debug(`[User ${userKey}] has Note#${noteHash} isSpent=${isSpent} isSmart=${decryptedNote.isSmart()}`);
            this.emit(events.NOTE, null, decryptedNote);
          }
        } catch (e) {
          if (e instanceof DecryptError) {
            return;
          }
          throw e;
        }
        found = true;
      };

      const vks = DB.getViewingKeys(userKey);
      // debug('decrypt with view keys', vks);
      vks.forEach(f);

      if (found) return;

      const accounts = DB.getAccounts(userKey);
      // debug('decrypt with view address', accounts.map(({ address }) => address));
      accounts.map(({ address }) => address).forEach(f);
    }

    if (!found) {
      this.emit(
        events.NOTE,
        new Error(`Note#${noteHash} cannot be decrypted`),
        null
      );
    }
  }

  async _handleOrderTaken (data) {
    // TODO: check removed
    const {
      orderId,
      takerNoteToMaker: stakeNoteHash,
      parentNote: takerNoteHash,
      takenAt,
    } = data.args;

    const order = DB.getOrder(orderId);
    if (!order) {
      debug('Failed to get order!');
      return;
    }

    order.takerNoteToMaker = stakeNoteHash;
    order.parentNote = takerNoteHash;

    order.takenAt = takenAt;
    order.taken = true;
    order.state = OrderState.Taken;

    const userKeys = DB.getUserKeys();

    // TODO: takerInfo and makerInfo should be separated with order data.
    for (const userKey of userKeys) {
      // for taker
      const takerNote = DB.getNoteByHash(userKey, takerNoteHash);
      if (takerNote) {
        order.takerInfo = {
          takerUserKey: userKey,
          takerNote: takerNote,
        };

        order.taken = true;
        DB.addOrUpdateOrderByUser(userKey, order);
        DB.updateOrder(order);
      }

      // for maker
      const stakeNote = DB.getNoteByHash(userKey, stakeNoteHash);
      if (stakeNote) {
        if (!order.makerInfo) {
          throw new Error('order.makerInfo is not instantiated');
        }

        order.makerInfo.stakeNote = stakeNote;

        const makerNote = Note.fromJSON(order.makerInfo.makerNote);
        order.makerInfo.takerViewingKey = stakeNote.viewingKey;

        const newMakerVk = randomHex(20);
        DB.addViewingKeys(userKey, newMakerVk);

        // calculate change note
        const makerAmount = toBN(makerNote.value);
        const stakeAmount = toBN(stakeNote.value);
        const price = toBN(order.price);

        const maxTakerAmount = makerAmount.mul(price).div(SCALING_FACTOR);
        const isOverPayment = maxTakerAmount.cmp(stakeAmount) < 0;

        let rewardAmount; // source token amount to taker
        let paymentAmount; // target token amount to maker
        let changeAmount; // source token amount to maker or target token amount to taker

        let changeNoteOwner;
        let changeTokenType;
        let changeNoteEncKey;

        if (!isOverPayment) {
          rewardAmount = stakeAmount.mul(SCALING_FACTOR).div(price);
          paymentAmount = stakeAmount;
          changeAmount = makerAmount.sub(rewardAmount);

          changeNoteOwner = order.makerNote;
          changeTokenType = makerNote.token;
          changeNoteEncKey = newMakerVk;
        } else {
          rewardAmount = makerAmount;
          paymentAmount = makerAmount.mul(price).div(SCALING_FACTOR);
          changeAmount = stakeAmount.sub(paymentAmount);

          changeNoteOwner = takerNoteHash;
          changeTokenType = stakeNote.token;
          changeNoteEncKey = order.makerInfo.takerViewingKey;
        }

        order.makerInfo.rewardNote = Note.createSmartNote(takerNoteHash, rewardAmount, order.sourceToken, '0x00', getSalt());
        order.makerInfo.paymentNote = Note.createSmartNote(makerNote.hash(), paymentAmount, order.targetToken, '0x00', getSalt());
        order.makerInfo.changeNote = Note.createSmartNote(changeNoteOwner, changeAmount, changeTokenType, '0x00', getSalt());

        order.makerInfo.rewardNoteEncKey = order.makerInfo.takerViewingKey;
        order.makerInfo.paymentNoteEncKey = newMakerVk;
        order.makerInfo.changeNoteEncKey = changeNoteEncKey;

        order.taken = true;

        DB.addOrUpdateOrderByUser(userKey, order);
        DB.updateOrder(order);
        this.emit(
          events.ORDER_TAKEN,
          null,
          order,
        );
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

    const order = DB.getOrder(orderId);

    if (!order) {
      this.emit(
        events.ORDER_SETTLED,
        new Error(`failed to read Order#${orderId}`),
        null,
      );

      return;
    }

    order.rewardNote = rewardNoteHash;
    order.paymentNote = paymentNoteHash;
    order.changeNote = changeNoteHash;

    order.settledAt = settledAt;
    order.settled = true;
    order.state = OrderState.Settled;

    DB.updateOrder(order);

    if (order.takerInfo) {
      const userKey = order.takerInfo.takerUserKey;

      order.takerInfo.rewardNote = DB.getNoteByHash(userKey, rewardNoteHash);
      order.takerInfo.changeNote = DB.getNoteByHash(userKey, changeNoteHash);

      DB.addOrUpdateOrderByUser(userKey, order);
      DB.updateOrder(order);
    }

    if (order.makerInfo) {
      const userKey = order.makerInfo.makerUserKey;

      order.makerInfo.paymentNote = DB.getNoteByHash(userKey, paymentNoteHash);
      order.makerInfo.changeNote = DB.getNoteByHash(userKey, changeNoteHash);

      DB.addOrUpdateOrderByUser(userKey, order);
      DB.updateOrder(order);
    }

    this.emit(
      events.ORDER_SETTLED,
      null,
      order,
    );
  }


  async _fetchOrders () {
    if (this.closed) return;

    const numOrdersContract = toBN(await this.zkdex.getOrderCount()).toNumber();
    const numOrdersDB = DB.getOrderCount().toNumber();

    for (let i = numOrdersDB; i < numOrdersContract; i++) {
      const order = await this.zkdex.orders(i);
      debug(`Order#${i} fetched`);

      order.orderId = i;

      order.sourceToken = hexToNumberString(toHex(order.sourceToken));
      order.targetToken = hexToNumberString(toHex(order.targetToken));

      order.state = hexToNumberString(toHex(order.state));

      DB.increaseOrderCount();
      DB.addOrder(order);
      this.emit(events.ORDER, null, order);
      debug(`[Order#${i}] fetched`);

      // find maker's order
      const userKeys = DB.getUserKeys();
      for (const userKey of userKeys) {
        const makerNote = DB.getNoteByHash(userKey, order.makerNote);

        if (makerNote) {
          order.makerInfo = {
            makerUserKey: userKey,
            makerNote: makerNote,
          };
          DB.addOrUpdateOrderByUser(userKey, order);
          DB.updateOrder(order);
          this.emit(events.ORDER_CREATED, null, order);
          debug(`[Order#${i}] maker info prepared`);
        }
      }
    }
    this.queue.push(this._fetchOrders, PRIORITY_FETCH_ORDER);
    return;
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
  OrderState,
  events,
};