const LocalStorage = require('node-localstorage').LocalStorage;
localStorage = new LocalStorage('./localstorage');

/**
 * Security Note: Server-side storage should NEVER contain:
 * - keystore (encrypted private keys)
 * - secretKey (decrypted private keys)
 * - passphrase
 *
 * These sensitive items should only be stored in the browser's localStorage.
 * This server storage is only for public metadata (address, publicKey).
 */

/**
 * Strip sensitive data from account object
 * @param {Object} account - Account object that may contain sensitive data
 * @returns {Object} - Account object without sensitive data
 */
function stripSensitiveData(account) {
  if (!account || typeof account !== 'object') {
    return account;
  }
  const { keystore, secretKey, passphrase, ...safeAccount } = account;
  if (keystore || secretKey || passphrase) {
    console.warn('WARNING: Stripping sensitive data (keystore/secretKey/passphrase) from account before storage');
  }
  return safeAccount;
}

function getViewingKey (key) {
  try {
    return localStorage.getItem(`${key}viewingkey`);
  } catch (err) {
    return null;
  }
}

function getAccounts (key) {
  try {
    return localStorage.getItem(`${key}accounts`);
  } catch (err) {
    return null;
  }
}

function getNoteByNoteHash (account, hash) {
  let notes = getNotes(account);
  if (!notes) {
    return null;
  } else {
    notes = JSON.parse(notes);
    for (let i = 0; i < notes.length; i++) {
      if (notes[i].hash === hash) {
        return notes[i];
      }
    }
  }
  return null;
}

function getNotes (account) {
  try {
    return localStorage.getItem(`${account}notes`);
  } catch (err) {
    return null;
  }
}

function getTransferNotes (account) {
  try {
    return localStorage.getItem(`${account}transfernotes`);
  } catch (err) {
    return null;
  }
}

function getOrder (id) {
  let orders = getOrders();
  if (!orders) {
    return;
  } else {
    orders = JSON.parse(orders);
  }

  for (let i = 0; i < orders.length; i++) {
    if (orders[i].orderId.toString() === id) {
      return orders[i];
    }
  }
  return null;
}

function getOrderHistory (account) {
  try {
    return localStorage.getItem(`${account}orders`);
  } catch (err) {
    return null;
  }
}

function getOrders () {
  try {
    return localStorage.getItem('orders');
  } catch (err) {
    return null;
  }
}

function addAccount (key, account) {
  let accounts = getAccounts(key);
  if (!accounts) {
    accounts = [];
  } else {
    accounts = JSON.parse(accounts);
  }
  // Security: Strip any sensitive data before storing
  const safeAccount = stripSensitiveData(account);
  accounts.push(safeAccount);
  _setAccounts(key, JSON.stringify(accounts));
  return accounts;
}

function addNote (account, note) {
  let notes = getNotes(account);
  if (!notes) {
    notes = [];
  } else {
    notes = JSON.parse(notes);
  }
  // Security: Strip secretKey from note before storing
  // Note: secretKey should be derived from the account's keystore in the browser
  const safeNote = stripSensitiveData(note);
  notes.push(safeNote);
  _setNotes(account, JSON.stringify(notes));
  return notes;
}

function addTransferNote (account, note) {
  let notes = getTransferNotes(account);
  if (!notes) {
    notes = [];
  } else {
    notes = JSON.parse(notes);
  }
  notes.push(note);
  _setTransferNotes(account, JSON.stringify(notes));
  return notes;
}

function addOrderHistory (account, orderHistory) {
  let history = getOrderHistory(account);
  if (!history) {
    history = [];
  } else {
    history = JSON.parse(history);
  }
  history.push(orderHistory);
  _setOrderHistory(account, JSON.stringify(history));
  return history;
}

function addOrder (order) {
  let orders = getOrders('orders');
  if (!orders) {
    orders = [];
  } else {
    orders = JSON.parse(orders);
  }
  orders.push(order);
  _setOrders(JSON.stringify(orders));
  return orders;
}

function setViewingKey (key, viewingKey) {
  localStorage.setItem(`${key}viewingkey`, viewingKey);
}

function _setAccounts (key, notes) {
  localStorage.setItem(`${key}accounts`, notes);
}

function _setNotes (key, notes) {
  localStorage.setItem(`${key}notes`, notes);
}

function _setTransferNotes (key, notes) {
  localStorage.setItem(`${key}transfernotes`, notes);
}

function _setOrders (orders) {
  localStorage.setItem('orders', orders);
}

function _setOrderHistory (account, orders) {
  localStorage.setItem(`${account}orders`, orders);
}

function updateNoteState (noteOwner, noteHash, noteState) {
  let notes = getNotes(noteOwner);
  if (!notes) {
    return;
  } else {
    notes = JSON.parse(notes);
  }

  for (let i = 0; i < notes.length; i++) {
    if (notes[i].hash === noteHash) {
      notes[i].state = noteState;
      break;
    }
  }

  _setNotes(noteOwner, JSON.stringify(notes));
  return notes;
}

function updateOrderHistory (account, orderHistory) {
  let history = getOrderHistory(account);
  if (!history) {
    return;
  } else {
    history = JSON.parse(history);
  }

  for (let i = 0; i < history.length; i++) {
    if (history[i].orderId === orderHistory.orderId) {
      history.splice(i, 1, orderHistory);
      break;
    }
  }

  _setOrderHistory(account, JSON.stringify(history));
  return getOrderHistory(account);
}

function updateOrderHistoryState (account, orderId, state) {
  let history = getOrderHistory(account);
  if (!history) {
    return;
  } else {
    history = JSON.parse(history);
  }

  for (let i = 0; i < history.length; i++) {
    if (history[i].orderId === orderId) {
      history[i].state = state;
      break;
    }
  }

  _setOrderHistory(account, JSON.stringify(history));
  return getOrderHistory(account);
}

function updateOrderState (orderId, orderState) {
  let orders = getOrders();
  if (!orders) {
    return;
  } else {
    orders = JSON.parse(orders);
  }

  for (let i = 0; i < orders.length; i++) {
    if (orders[i].orderId === orderId) {
      orders[i].state = orderState;
      break;
    }
  }

  _setOrders(JSON.stringify(orders));
  return orders;
}

function updateOrderTaker (orderId, orderTaker) {
  let orders = getOrders();
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

  _setOrders(JSON.stringify(orders));
  return orders;
}

function deleteAccount (key, address) {
  let accounts = getAccounts(key);
  if (!accounts) {
    return;
  } else {
    accounts = JSON.parse(accounts);
  }
  for (let i = 0; i < accounts.length; i++) {
    if (accounts[i].address === address) {
      accounts.splice(i, 1);
      break;
    }
  }
  _setAccounts(key, JSON.stringify(accounts));
  return accounts;
}

module.exports = {
  getViewingKey,
  getAccounts,
  getNoteByNoteHash,
  getNotes,
  getTransferNotes,
  getOrderHistory,
  getOrder,
  getOrders,
  addAccount,
  addNote,
  addTransferNote,
  addOrderHistory,
  addOrder,
  setViewingKey,
  updateNoteState,
  updateOrderHistory,
  updateOrderHistoryState,
  updateOrderState,
  updateOrderTaker,
  deleteAccount,
  stripSensitiveData,
};
