const { toHex, toBN } = require('web3-utils');

const { LocalStorage } = require('node-localstorage');

const {
  addZkPrefix,
  removeZkPrefix,
} = require('zk-dex-keystore/lib/utils');


const { marshal } = require('../../scripts/lib/util');
const { Note, constants: { EMPTY_NOTE_HASH } } = require('../../scripts/lib/Note');

localStorage = new LocalStorage('./localstorage');
if (typeof localStorage === 'undefined' || localStorage === null) {
  global.localStorage = new LocalStorage('./scratch');
}


// zk-dex service
function getLastBlockNumber () {
  const n = localStorage.getItem('lastBlockNumber') || 0;
  return toBN(n);
}
module.exports.getLastBlockNumber = getLastBlockNumber;

function setLastBlockNumber (n) {
  const pre = getLastBlockNumber();
  const cur = toBN(n);
  if (cur.cmp(pre) > 0) {
    localStorage.setItem('lastBlockNumber', toHex(n));
  }
  return cur;
}
module.exports.setLastBlockNumber = setLastBlockNumber;

function getUserKeys () {
  const res = localStorage.getItem('userKeys');
  if (!res) {
    return [];
  }
  return JSON.parse(res);
}
module.exports.getUserKeys = getUserKeys;

function addUserKey (_userKey) {
  const userKey = marshal(_userKey);
  const userKeys = getUserKeys();
  if (userKeys.indexOf(userKey) < 0) {
    userKeys.push(userKey);
    localStorage.setItem('userKeys', JSON.stringify(userKeys));
  }
}
module.exports.addUserKey = addUserKey;

// Vk
function getViewingKeys (_userKey) {
  const userKey = marshal(_userKey);
  const res = localStorage.getItem(`${userKey}-viewingkeys`);
  if (!res) {
    return [];
  }
  return JSON.parse(res);
}
module.exports.getViewingKeys = getViewingKeys;

function addViewingKeys (_userKey, viewingKey) {
  const userKey = marshal(_userKey);
  const viewingKeys = getViewingKeys(userKey);
  if (viewingKeys.indexOf(viewingKey) < 0) {
    viewingKeys.push(viewingKey);
    localStorage.setItem(`${userKey}-viewingkeys`, JSON.stringify(viewingKeys));
  }
  return viewingKeys;
}
module.exports.addViewingKeys = addViewingKeys;

// Accounts
function getAccounts (_userKey) {
  const userKey = marshal(_userKey);
  const res = localStorage.getItem(`${userKey}-accounts`);
  if (!res) {
    return [];
  }

  return JSON.parse(res);
}
module.exports.getAccounts = getAccounts;

function getAccountByAddress (userKey, _address) {
  const address = removeZkPrefix(_address);

  const accounts = getAccounts(userKey);
  const account = accounts.find(({ address: a }) => a === address);
  if (!account) {
    throw new Error(`Account ${address} not exists`);
  }
  return account;
}
module.exports.getAccountByAddress = getAccountByAddress;

function addAccount (_userKey, account) {
  const userKey = marshal(_userKey);
  const accounts = getAccounts(userKey);
  accounts.push(account);
  _setAccounts(userKey, accounts);
}
module.exports.addAccount = addAccount;

function deleteAccount (_userKey, _address) {
  const userKey = marshal(_userKey);
  const address = removeZkPrefix(_address);

  const accounts = getAccounts(userKey);

  if (!accounts) {
    throw new Error('There is no account');
  }

  const i = accounts.findIndex(({ address: a }) => a === address);
  if (i < 0) {
    throw new Error(`Account ${address} not exists`);
  }

  accounts.splice(i, 1);

  _setAccounts(userKey, accounts);
}
module.exports.deleteAccount = deleteAccount;

function _setAccounts (userKey, accounts) {
  localStorage.setItem(`${userKey}-accounts`, JSON.stringify(accounts));
}

// Notes - by user
function getNotes (_userKey) {
  const userKey = marshal(_userKey);

  const res = localStorage.getItem(`${userKey}-notes`);
  if (!res) {
    return [];
  }
  return JSON.parse(res);
}
module.exports.getNotes = getNotes;

function indexOfNote (_userKey, note) {
  const userKey = marshal(_userKey);
  const notes = getNotes(userKey);
  const noteHash = Note.hashFromJSON(note);

  return notes.findIndex(n => Note.hashFromJSON(n) === noteHash);
}
module.exports.indexOfNote = indexOfNote;

function addNote (_userKey, _note) {
  const note = Note.fromJSON(_note);
  const userKey = marshal(_userKey);
  const notes = getNotes(userKey);

  const noteHash = note.hash();

  if (notes.findIndex(n => Note.hashFromJSON(n) === noteHash) >= 0) {
    return false;
  }

  notes.push(note);
  _setNotes(userKey, notes);
  setNoteByHash(userKey, note);
  return true;
}
module.exports.addNote = addNote;

function keyNoteByHash (userKey, noteHash) {
  if (!userKey) throw new Error('empty user key');
  if (!noteHash) throw new Error('empty note hash');

  return `user-${marshal(userKey)}-note-${marshal(noteHash)}`;
}
function getNoteByHash (userKey, noteHash) {
  const res = localStorage.getItem(keyNoteByHash(userKey, noteHash));
  if (!res) return null;
  return JSON.parse(res);
}
module.exports.getNoteByHash = getNoteByHash;

function setNoteByHash (userKey, note) {
  // console.error(`setNoteByHash User${userKey} Note${note.hash()}`);
  const noteHash = note.hash();
  localStorage.setItem(keyNoteByHash(userKey, noteHash), JSON.stringify(note));
}
module.exports.setNoteByHash = setNoteByHash;

function updateNote (_userKey, note) {
  const userKey = marshal(_userKey);
  const notes = getNotes(userKey);
  const i = notes.findIndex(n => n.hash() === note.hash());

  if (i >= 0) {
    notes.splice(i, 1, note);
    _setNotes(userKey, notes);
  }
}
module.exports.updateNote = updateNote;

function _setNotes (_userKey, notes) {
  const userKey = marshal(_userKey);
  localStorage.setItem(`${userKey}-notes`, JSON.stringify(notes));
}


const TransferHistoryState = {
  Init: 'init',
  Deleted: 'deleted',
  Transferred: 'transferred',
};

class TransferHistory {

  /**
   *
   * @param {String} oldNote0Hash hash of old note 0
   * @param {String} oldNote1Hash hash of old note 1
   * @param {String} newNote0Hash hash of new note 0
   * @param {String} newNote1Hash hash of new note 1
   * @param {TransferHistoryState} state
   */
  constructor (
    oldNote0Hash,
    oldNote1Hash,
    newNote0Hash,
    newNote1Hash,
    state = TransferHistoryState.Init
  ) {
    if (!oldNote0Hash) throw new Error(`oldNote0Hash must be hash: ${oldNote0Hash}`);
    if (!oldNote1Hash) throw new Error(`oldNote1Hash must be hash: ${oldNote1Hash}`);
    if (!newNote0Hash) throw new Error(`newNote0Hash must be hash: ${newNote0Hash}`);
    if (!newNote1Hash) throw new Error(`newNote1Hash must be hash: ${newNote1Hash}`);

    this.oldNote0Hash = oldNote0Hash;
    this.oldNote1Hash = oldNote1Hash;
    this.newNote0Hash = newNote0Hash;
    this.newNote1Hash = newNote1Hash;

    this.state = state;
  }

  toString () {
    JSON.stringify(this);
  }

  static _keyHistory (oldNote0Hash, oldNote1Hash) {
    return `transfer-history-${marshal(oldNote0Hash + oldNote1Hash)}`;
  }

  static getHistory (oldNote0Hash, oldNote1Hash) {
    const res = localStorage.getItem(TransferHistory._keyHistory(oldNote0Hash, oldNote1Hash));

    if (!res) return null;

    const obj = JSON.parse(res);

    return new TransferHistory(
      obj.oldNote0Hash,
      obj.oldNote1Hash,
      obj.newNote0Hash,
      obj.newNote1Hash,
      obj.state
    );
  }

  // NOTE: this would override previous another temporary history
  setHistory () {
    // store history by old notes hash
    localStorage.setItem(this.getKey(), this.toString());

    // store history by user and old notes hash
    const userKeys = getUserKeys();
    const hs = [
      this.oldNote0Hash,
      this.oldNote1Hash,
    ].filter(h => h !== EMPTY_NOTE_HASH);

    userKeys.forEach((userKey) => {
      hs.forEach((h) => {
        if (getNoteByHash(userKey, h)) {
          this.addHistoryByUser(userKey);
        }
      });
    });
  }

  getKey () {
    return TransferHistory._keyHistory(
      this.oldNote0Hash,
      this.oldNote1Hash,
    );
  }

  setState (state, timestamp = null) {
    let found = false;
    for (const s of Object.values(TransferHistoryState)) {
      if (s === state) {
        found = true;
        break;
      }
    }
    if (!found) throw new Error(`Undefined Transfer History State: ${state}`);

    if (timestamp) {
      this.timestamp = timestamp;
    }

    this.state = state;
    this.setHistory();
  }

  // by user
  static _keyHistoryByUser (userKey) {
    return `transfer-history-user-${marshal(userKey)}`;
  }

  static getHistoriesByUser (userKey) {
    const res = localStorage.getItem(TransferHistory._keyHistoryByUser(userKey));

    if (!res) return [];
    return JSON.parse(res);
  }

  addHistoryByUser (userKey) {
    const histories = TransferHistory.getHistoriesByUser(userKey);
    histories.push(this);

    localStorage.setItem(TransferHistory._keyHistoryByUser(userKey), JSON.stringify(histories));
  }
}
module.exports.TransferHistoryState = TransferHistoryState;
module.exports.TransferHistory = TransferHistory;


// Orders
const keyOrderCount = 'order-count';

function getOrderCount () {
  const res = localStorage.getItem(keyOrderCount);
  if (!res) {
    return toBN('0');
  }
  return toBN(res);
}
module.exports.getOrderCount = getOrderCount;

function increaseOrderCount () {
  localStorage.setItem(keyOrderCount, toHex(getOrderCount().add(toBN(1))));
}
module.exports.increaseOrderCount = increaseOrderCount;

const keyOrders = 'orders';

function getOrders () {
  const res = localStorage.getItem(keyOrders);
  if (!res) {
    return [];
  }
  return JSON.parse(res);
}
module.exports.getOrders = getOrders;

function _setOrders (orders) {
  localStorage.setItem(keyOrders, JSON.stringify(orders));
}

function addOrder (order) {
  const orders = getOrders();

  if (orders.findIndex(o => o.orderId === order.orderId) < 0) {
    orders.push(order);
    _setOrders(orders);
  }
}
module.exports.addOrder = addOrder;

function updateOrder (order) {
  const orders = getOrders();

  const i = orders.findIndex(o => o.orderId === order.orderId);
  if (i >= 0) {
    orders.splice(i, 1, order);
    _setOrders(orders);
  }
}
module.exports.updateOrder = updateOrder;

function getOrder (id) {
  const orders = getOrders();
  return orders.find(o => Number(o.orderId) === Number(id));
}
module.exports.getOrder = getOrder;


function keyOrdersByUser (_userKey) {
  return `${marshal(_userKey)}-orders`;
}

function getOrdersByUser (userKey) {
  const res = localStorage.getItem(keyOrdersByUser(userKey));
  if (!res) return [];
  return JSON.parse(res);
}
module.exports.getOrdersByUser = getOrdersByUser;

function addOrUpdateOrderByUser (userKey, order) {
  const orders = getOrdersByUser(userKey);
  const i = orders.findIndex(o => Number(o.orderId) === Number(order.orderId));

  if (i < 0) {
    orders.push(order);
  } else {
    orders.splice(i, 1, order);
  }

  return localStorage.setItem(keyOrdersByUser(userKey), JSON.stringify(orders));
}
module.exports.addOrUpdateOrderByUser = addOrUpdateOrderByUser;


function _setOrdersByAccount (_userKey, orders) {
  const userKey = marshal(_userKey);
  localStorage.setItem(`${userKey}-orders`, JSON.stringify(orders));
}


function addOrderByAccount (_userKey, order) {
  const userKey = marshal(_userKey);
  const orders = getOrdersByUser(userKey);

  if (orders.findIndex(o => o.orderId === order.orderId) !== -1) {
    orders.push(order);
    _setOrdersByAccount(userKey, orders);
  }
}
module.exports.addOrderByAccount = addOrderByAccount;


function updateOrderByAccount (_userKey, order) {
  const userKey = marshal(_userKey);

  let orders = getOrdersByUser(userKey);
  if (!orders) {
    return;
  } else {
    orders = JSON.parse(orders);
  }

  for (let i = 0; i < orders.length; i++) {
    if (orders[i].orderId === orderId) {
      orders[i].orderTaker = orderTaker;
      break;
    }
  }

  _setOrdersByAccount(userKey, orders);
}
module.exports.updateOrderByAccount = updateOrderByAccount;

