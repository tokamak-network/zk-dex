import axios from 'axios';

function createInstance () {
  return axios.create({
    baseURL: 'http://127.0.0.1:3000',
  });
}

const instance = createInstance();

async function getViewingKey (key) {
  const res = await instance.get(`/vk/${key}`);
  return res.data.vk;
}

async function getNotes (key) {
  const res = await instance.get(`/notes/${key}`);
  return JSON.parse(res.data.notes);
}

async function getAccounts (key) {
  const res = await instance.get(`/accounts/${key}`);
  return JSON.parse(res.data.accounts);
}

async function getOrders () {
  const res = await instance.get('/orders');
  return JSON.parse(res.data.orders);
}

async function getOrderCount () {
  const res = await instance.get('/orders/count');
  return res.data.count;
}

async function setViewingKey (key, vk) {
  return instance.post('/vk', {
    key,
    vk,
  });
}

function addNote (account, note) {
  return instance.post('/notes', {
    account,
    note,
  });
}

function addAccount (key, account) {
  return instance.post('/accounts', {
    key,
    account,
  });
}

function updateNoteState (key, hash, state) {
  return instance.put('/notes', {
    key,
    hash,
    state,
  });
}

function addOrder (order) {
  return instance.post('/orders', {
    order,
  });
}

function generateProof (params) {
  return instance.post('/circuit', params);
}

function createAccount () {
  return instance.post('/account');
}

export {
  getViewingKey,
  setViewingKey,
  getNotes,
  getOrders,
  getOrderCount,
  addNote,
  updateNoteState,
  addOrder,
  generateProof,
  createAccount,
  addAccount,
  getAccounts,
};
