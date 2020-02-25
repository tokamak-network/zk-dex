import axios from 'axios';

function createInstance () {
  return axios.create({
    baseURL: 'http://127.0.0.1:3000',
  });
}

const instance = createInstance();

// get
async function getViewingKeys (key) {
  const res = await instance.get(`/vk/${key}`);
  return res.data.vks;
}

async function getAccounts (key) {
  const res = await instance.get(`/accounts/${key}`);
  return res.data.addresses;
}

async function getNoteByNoteHash (account, hash) {
  const res = await instance.get(`/notes/${account}/${hash}`);
  return res.data.note;
}

async function getNotes (account) {
  const res = await instance.get(`/notes/${account}`);
  return res.data.notes;
}

async function getTransferNotes (account) {
  const res = await instance.get(`/notes/transfer/${account}`);
  return res.data.notes;
}

async function getOrders () {
  const res = await instance.get('/orders');
  if (res.data === null) {
    return null;
  } else {
    return res.data.orders;
  }
}

async function getOrder (id) {
  const res = await instance.get(`/orders/${id}`);
  if (res.data === null) {
    return null;
  } else {
    return res.data.order;
  }
}

async function getOrdersByUser (userKey) {
  const res = await instance.get(`/accounts/${userKey}/orders`);
  if (res.data === null) {
    return null;
  } else {
    return res.data.orders;
  }
}

// post
function addAccount (userKey, passphrase) {
  return instance.post(`/accounts/${userKey}`, {
    passphrase,
  });
}

async function addNote (account, note) {
  const res = await instance.post('/notes', {
    account,
    note,
  });
  return res.data.notes;
}

async function addTransferNote (account, note) {
  const res = await instance.post('/notes/transfer', {
    account,
    note,
  });
  return res.data.notes;
}

async function addOrderHistory (account, history) {
  const res = await instance.post(`/orders/history/${account}`, {
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

async function addViewingKey (userKey, vk) {
  const res = await instance.post(`/vk/${userKey}`, {
    vk,
  });
  return res.data.vks;
}

async function importAccount (key, account) {
  const res = await instance.post('/accounts/import', {
    key,
    account,
  });
  return res.data.accounts;
}

function unlockAccount (userKey, passphrase, address, duration = undefined) {
  return instance.post(`/accounts/${userKey}/unlock`, {
    passphrase,
    address,
    duration,
  });
}

function generateProof (url, params, owners) {
  return instance.post(
    `/circuits/${url}`,
    {
      params,
      owners,
    }
  );
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

async function deleteAccount (key, address) {
  const res = await instance.delete('/accounts', {
    data: {
      key,
      address,
    },
  });
  return res.data.accounts;
}

export default {
  getViewingKeys,
  getAccounts,
  getNoteByNoteHash,
  getNotes,
  getTransferNotes,
  getOrder,
  getOrdersByUser,
  getOrders,
  addAccount,
  importAccount,
  unlockAccount,
  addNote,
  addTransferNote,
  addOrderHistory,
  addOrder,
  addViewingKey,
  generateProof,
  updateNoteState,
  updateOrderHistory,
  updateOrderHistoryState,
  updateOrderState,
  updateOrderTaker,
  deleteAccount,
};
