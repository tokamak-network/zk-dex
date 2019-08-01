const LocalStorage = require('node-localstorage').LocalStorage;
localStorage = new LocalStorage('./localstorage');

function _setNotes (key, notes) {
  localStorage.setItem(key, notes);
}

function getNotes (key) {
  return localStorage.getItem(key);
}

function addNote (key, note) {
  let notes = getNotes(key);
  if (!notes) {
    notes = [];
  } else {
    notes = JSON.parse(notes);
  }
  notes.push(note);
  _setNotes(key, JSON.stringify(notes));
}

function updateNoteState (key, hash, state) {
  let notes = getNotes(key);
  if (!notes) {
    return;
  } else {
    notes = JSON.parse(notes);
  }

  for (const note in notes) {
    if (notes[note].hash === hash) {
      notes[note].state = state;
    }
  }

  _setNotes(key, JSON.stringify(notes));
}

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
  getNotes,
  addNote,
  updateNoteState,
  getOrderCount,
  setOrderCount,
  setOrders,
  getOrders,
  addOrder,
};
