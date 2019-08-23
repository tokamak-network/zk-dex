const LocalStorage = require('node-localstorage').LocalStorage;
localStorage = new LocalStorage('./localstorage');

function getViewingKey (key) {
  return localStorage.getItem(`${key}viewingkey`);
}

function getAccounts (key) {
  return localStorage.getItem(`${key}accounts`);
}

function getNotes (account) {
  return localStorage.getItem(`${account}notes`);
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

function getOrdersByAccount (account) {
  return localStorage.getItem(`${account}orders`);
}

function getOrders () {
  return localStorage.getItem('orders');
}

function addAccount (key, account) {
  let accounts = getAccounts(key);
  if (!accounts) {
    accounts = [];
  } else {
    accounts = JSON.parse(accounts);
  }
  accounts.push(account);
  _setAccounts(key, JSON.stringify(accounts));
}

function addNote (account, note) {
  let notes = getNotes(account);
  if (!notes) {
    notes = [];
  } else {
    notes = JSON.parse(notes);
  }
  notes.push(note);
  _setNotes(account, JSON.stringify(notes));
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
}

function addOrderByAccount (account, order) {
  let orders = getOrdersByAccount(account);
  if (!orders) {
    orders = [];
  } else {
    orders = JSON.parse(orders);
  }
  orders.push(order);
  _setOrdersByAccount(account, JSON.stringify(orders));
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

function _setOrdersByAccount (account, orders) {
  localStorage.setItem(`${account}orders`, orders);
}

function updateNote (account, note) {
  let notes = getNotes(account);
  if (!notes) {
    return;
  } else {
    notes = JSON.parse(notes);
  }

  for (let i = 0; i < notes.length; i++) {
    if (notes[i].hash === note.hash) {
      notes.splice(i, 1, note);
      break;
    }
  }

  _setNotes(account, JSON.stringify(notes));
}

function updateOrderByAccount (account, order) {
  let orders = getOrdersByAccount(account);
  if (!orders) {
    return;
  } else {
    orders = JSON.parse(orders);
  }

  for (let i = 0; i < orders.length; i++) {
    if (orders[i].orderId === order.orderId) {
      orders.splice(i, 1, order);
      break;
    }
  }

  _setOrdersByAccount(account, JSON.stringify(orders));
}

function updateOrder (order) {
  let orders = getOrders();
  if (!orders) {
    return;
  } else {
    orders = JSON.parse(orders);
  }

  for (let i = 0; i < orders.length; i++) {
    if (orders[i].orderId === order.orderId) {
      orders.splice(i, 1, order);
      break;
    }
  }

  _setOrders(JSON.stringify(orders));
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
}

module.exports = {
  getViewingKey,
  getAccounts,
  getNotes,
  getTransferNotes,
  getOrdersByAccount,
  getOrder,
  getOrders,
  addAccount,
  addNote,
  addTransferNote,
  addOrderByAccount,
  addOrder,
  setViewingKey,
  updateNote,
  updateOrderByAccount,
  updateOrder,
  deleteAccount,
};
