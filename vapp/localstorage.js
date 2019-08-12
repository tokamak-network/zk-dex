const LocalStorage = require('node-localstorage').LocalStorage;
localStorage = new LocalStorage('./localstorage');

function setViewingKey (key, viewingKey) {
  localStorage.setItem(`${key}viewingkey`, viewingKey);
}

function getViewingKey (key) {
  return localStorage.getItem(`${key}viewingkey`);
}

function _setNotes (key, notes) {
  localStorage.setItem(`${key}notes`, notes);
}

function getNotes (key) {
  return localStorage.getItem(`${key}notes`);
}

function addNote (key, note) {
  let notes = getNotes(key);
  if (!notes) {
    notes = [];
  } else {
    notes = JSON.parse(notes);
  }

  let modified = false;
  for (let i = 0; i < notes.length; i++) {
    if (notes[i].hash === note.hash) {
      notes[i].state = note.state;
      modified = true;
      break;
    }
  }

  if (!modified) {
    notes.push(note);
  }
  _setNotes(key, JSON.stringify(notes));
}

function _setAccounts (key, notes) {
  localStorage.setItem(`${key}accounts`, notes);
}

function getAccounts (key) {
  return localStorage.getItem(`${key}accounts`);
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

// function updateNoteState (key, hash, state) {
//   let notes = getNotes(key);
//   if (!notes) {
//     return;
//   } else {
//     notes = JSON.parse(notes);
//   }

//   for (const note in notes) {
//     if (notes[note].hash === hash) {
//       notes[note].state = state;
//     }
//   }

//   _setNotes(key, JSON.stringify(notes));
// }

function getOrderCount () {
  const count = localStorage.getItem('orderCount');
  return parseInt(count);
}

function setOrderCount (count) {
  localStorage.setItem('orderCount', count);
}

function setOrders (orders) {
  localStorage.setItem('orders', orders);
}

function getOrders () {
  return localStorage.getItem('orders');
}

function addOrder (order) {
  const count = getOrderCount() + 1;
  const orders = JSON.parse(getOrders());

  order.id = count;
  orders.push(order);

  setOrders(JSON.stringify(orders));
  setOrderCount(count);
}

function _initOrderStorage () {
  // NOTE: if server restarts, all the datas reset.
  const orders = [];
  setOrders(JSON.stringify(orders));
  setOrderCount(0);
}

_initOrderStorage();

module.exports = {
  setViewingKey,
  getViewingKey,

  getNotes,
  addNote,
  // updateNoteState,
  getOrderCount,
  setOrderCount,
  setOrders,
  getOrders,
  addOrder,
  addAccount,
  getAccounts,
};
