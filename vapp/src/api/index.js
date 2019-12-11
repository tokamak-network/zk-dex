import axios from 'axios';

function createInstance () {
  return axios.create({
    baseURL: 'http://127.0.0.1:3000',
  });
}

const instance = createInstance();

// get
async function getViewingKey (key) {
  const res = await instance.get(`/vk/${key}`);
  return res.data.vk;
}

async function getAccounts (key) {
  const res = await instance.get(`/accounts/${key}`);
  return res.data.accounts;
}

async function getNotes (account) {
  const res = await instance.get(`/notes/${account}`);
  return res.data.notes;
}

async function getNoteTransferHistories (account) {
  const res = await instance.get(`/notes/transfer/histories/${account}`);
  return res.data.noteTransferHistories;
}

async function getOrdersByUser (account) {
  const res = await instance.get(`/orders/${account}`);
  if (res.data === null) {
    return [];
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

async function getOrders () {
  const res = await instance.get('/orders');
  if (res.data === null) {
    return [];
  } else {
    return res.data.orders;
  }
}

// post
async function addAccount (key, account) {
  const res = await instance.post(`/accounts/${key}`, {
    account,
  });
  return res.data.account;
}

async function addNote (account, note) {
  const res = await instance.post('/notes', {
    account,
    note,
  });
  return res.data.note;
}

function addNoteTransferHistory (notes) {
  return instance.post('notes/transfer/histories', {
    notes,
  });
}

function addTransferNote (account, note) {
  return instance.post('/notes/transfer', {
    account,
    note,
  });
}

function addOrderByAccount (account, order) {
  return instance.post(`/orders/${account}`, {
    order,
  });
}

async function addOrder (order) {
  const res = await instance.post('/orders', {
    order,
  });
  return res.data.order;
}

async function setViewingKey (key, vk) {
  return instance.post('/vk', {
    key,
    vk,
  });
}

function createAccount (passphrase) {
  return instance.post(`/accounts/create`, {
    passphrase,
  });
}

function unlockAccount (passphrase, keystore) {
  return instance.post('/accounts/unlock', {
    passphrase,
    keystore,
  });
}

async function generateProof (circuit, params) {
  return await instance.post('/circuits', {
    circuit,
    params,
  });
}

// put
async function updateNote (account, note) {
  const res = await instance.put('/notes', {
    account,
    note,
  });
  return res.data.note;
}

function updateOrderByAccount (account, order) {
  return instance.put(`/orders/${account}`, {
    order,
  });
}

async function updateOrder (order) {
  const res = await instance.put('/orders', {
    order,
  });
  return res.data.order;
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
  getNotes,
  getNoteTransferHistories,
  getOrder,
  getOrdersByUser,
  getOrders,
  addAccount,
  unlockAccount,
  addNote,
  addNoteTransferHistory,
  addTransferNote,
  addOrderByAccount,
  addOrder,
  setViewingKey,
  createAccount,
  generateProof,
  updateNote,
  updateOrderByAccount,
  updateOrder,
  deleteAccount,
};

export default api;
