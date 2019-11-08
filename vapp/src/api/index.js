import axios from 'axios';

function createInstance () {
  return axios.create({
    baseURL: 'http://localhost:3000',
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
  return JSON.parse(res.data.accounts);
}

async function getNotes (key) {
  const res = await instance.get(`/notes/${key}`);
  return JSON.parse(res.data.notes);
}

async function getOrders () {
  const res = await instance.get('/orders');
  if (res.data === null) {
    return null;
  } else {
    return JSON.parse(res.data.orders);
  }
}

// post
async function addAccount (key, account) {
  const res = await instance.post('/accounts', {
    key,
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

async function addOrder (order) {
  const res = await instance.post('/orders', {
    order,
  });
  return res.data.order;
}

function createAccount (passphrase) {
  return instance.post('/accounts/create', {
    passphrase,
  });
}

function unlockAccount (passphrase, keystore) {
  return instance.post('/accounts/unlock', {
    passphrase,
    keystore,
  });
}

function generateProof (params) {
  return instance.post('/circuits', params);
}

// put
async function updateNoteState (key, noteHash, noteState) {
  const res = await instance.put('/notes', {
    key,
    noteHash,
    noteState,
  });
  return res.data.note;
}

async function updateOrder (orderId, order) {
  const res = await instance.put('/orders', {
    orderId,
    order,
  });
  return res.data.order;
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

const api = {
  getViewingKey,
  getAccounts,
  getNotes,
  getOrders,
  addAccount,
  unlockAccount,
  addNote,
  addOrder,
  createAccount,
  generateProof,
  updateNoteState,
  updateOrder,
  deleteAccount,
};

export default api;
