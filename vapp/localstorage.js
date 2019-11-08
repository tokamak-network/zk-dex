const LocalStorage = require('node-localstorage').LocalStorage;
const path = `${__dirname}/localstorage`;
localStorage = new LocalStorage(path);

function getAccounts (key) {
  return localStorage.getItem(`${key}accounts`);
}

function getNotes (account) {
  return localStorage.getItem(`${account}notes`);
}

function getOrders () {
  return localStorage.getItem('orders');
}

function addAccount (key, account) {
  let accounts = getAccounts(key);
  if (accounts === null) {
    accounts = [];
  } else {
    accounts = JSON.parse(accounts);
  }
  accounts.push(account);
  localStorage.setItem(`${key}accounts`, JSON.stringify(accounts));
}

function addNote (account, note) {
  let notes = getNotes(account);
  if (notes === null) {
    notes = [];
  } else {
    notes = JSON.parse(notes);
  }
  notes.push(note);

  localStorage.setItem(`${account}notes`, JSON.stringify(notes));
  return note;
}

function addOrder (order) {
  let orders = getOrders('orders');
  if (orders === null) {
    orders = [];
  } else {
    orders = JSON.parse(orders);
  }
  orders.push(order);

  localStorage.setItem('orders', JSON.stringify(orders));
  return order;
}

function updateNoteState (key, noteHash, noteState) {
  let notes = getNotes(key);
  if (notes === null) {
    return;
  } else {
    notes = JSON.parse(notes);
  }

  let note;
  for (let i = 0; i < notes.length; i++) {
    if (notes[i].hash === noteHash) {
      note = notes[i];
      notes[i].state = noteState;
      break;
    }
  }

  localStorage.setItem(`${key}notes`, JSON.stringify(notes));
  return note;
}

function updateOrder (orderId, order) {
  let orders = getOrders();
  if (orders === null) {
    return;
  } else {
    orders = JSON.parse(orders);
  }

  for (let i = 0; i < orders.length; i++) {
    if (orders[i].orderId === orderId) {
      orders[i] = order;
      break;
    }
  }

  localStorage.setItem('orders', JSON.stringify(orders));
  return order;
}

function getViewingKey (key) {
  return localStorage.getItem(`${key}viewingkey`);
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

function getTransferNotes (account) {
  return localStorage.getItem(`${account}transfernotes`);
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
  return localStorage.getItem(`${account}orders`);
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
  updateOrder,
  updateOrderTaker,
  deleteAccount,
};
