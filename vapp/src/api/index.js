import axios from 'axios';

function createInstance () {
  return axios.create({
    baseURL: 'http://127.0.0.1:3000',
  });
}

const instance = createInstance();

// get
async function getViewingKey (userKey) {
  const res = await instance.get(`/vk/${userKey}`);
  return res.data.vk;
}

async function getAccounts (userKey) {
  const res = await instance.get(`/accounts/${userKey}`);
  return res.data.accounts;
}

// async function getNoteByNoteHash (account, hash) {
//   const res = await instance.get(`/notes/${account}/${hash}`);
//   return res.data.note;
// }

async function getNotes (userKey) {
  const res = await instance.get(`/notes/${userKey}`);
  return res.data.notes;
}

async function getNoteTransferHistories (userKey) {
  const res = await instance.get(`/notes/${userKey}/history`);
  return res.data.histories;
}

async function getOrder (id) {
  const res = await instance.get(`/orders/${id}`);
  if (res.data === null) {
    return null;
  } else {
    return res.data.order;
  }
}

async function getOrders () {
  const res = await instance.get('/orders');
  if (res.data === null) {
    return null;
  } else {
    return res.data.orders;
  }
}

async function getOrdersByUser (userKey) {
  const res = await instance.get(`/orders/${userKey}`);
  if (res.data === null) {
    return null;
  } else {
    return res.data.orders;
  }
}

// post
async function createAndAddAccount (userKey, passphrase) {
  const res = await instance.post(`/accounts/${userKey}`, {
    passphrase,
  });
  return res.data.address;
}

function importAccount (userKey, account) {
  const res = instance.post(`/accounts/import/${userKey}`, {
    account,
  });
  return res.data.accounts;
}

async function addNote (account, note) {
  const res = await instance.post('/notes', {
    account,
    note,
  });
  return res.data.notes;
}

async function addTransferNote (userKey, note) {
  const res = await instance.post('/notes/transfer', {
    userKey,
    note,
  });
  return res.data.notes;
}

async function addOrderHistory (userKey, history) {
  const res = await instance.post(`/orders/history/${userKey}`, {
    history,
  });
  return res.data.history;
}

async function addOrder (order) {
  const res = await instance.post('/orders', {
    order,
  });
  return res.data.orders;
}

async function setViewingKey (key, vk) {
  return instance.post('/vk', {
    key,
    vk,
  });
}

function unlockAccount (passphrase, keystore) {
  return instance.post('/accounts/unlock', {
    passphrase,
    keystore,
  });
}

async function generateProof (circuit, params) {
  return await instance.post(`/circuits/${circuit}`, {
    params,
  });
}

// put
async function updateNoteState (noteOwner, noteHash, noteState) {
  const res = await instance.put('/notes', {
    noteOwner,
    noteHash,
    noteState,
  });
  return res.data.notes;
}

async function updateOrderHistory (account, order) {
  const res = await instance.put(`/orders/${account}`, {
    order,
  });
  return res.data.history;
}

async function updateOrderHistoryState (account, orderId, orderState) {
  const res = await instance.put(`/orders/state/${account}`, {
    orderId,
    orderState,
  });
  return res.data.history;
}

async function updateOrderState (orderId, orderState) {
  const res = await instance.put('/orders', {
    orderId,
    orderState,
  });
  return res.data.orders;
}

async function updateOrderTaker (orderId, orderTaker) {
  const res = await instance.put('/orders/taker', {
    orderId,
    orderTaker,
  });
  return res.data.orders;
}

function deleteAccount (key, address) {
  return instance.delete(`/accounts/${key}`, {
    data: {
      address,
    },
  });
}

const api = {
  getViewingKey,
  getAccounts,
  // getNoteByNoteHash,
  getNotes,
  getNoteTransferHistories,
  getOrder,
  getOrdersByUser,
  getOrders,
  createAndAddAccount,
  importAccount,
  unlockAccount,
  addNote,
  // addNoteTransferHistory,
  addTransferNote,
  addOrderHistory,
  addOrder,
  setViewingKey,
  generateProof,
  updateNoteState,
  updateOrderHistory,
  updateOrderHistoryState,
  updateOrderState,
  updateOrderTaker,
  deleteAccount,
};

export default api;
