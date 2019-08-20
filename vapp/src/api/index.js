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
  return JSON.parse(res.data.accounts);
}

async function getNotes (account) {
  const res = await instance.get(`/notes/${account}`);
  return JSON.parse(res.data.notes);
}

async function getTransferNotes (account) {
  const res = await instance.get(`/notes/transfer/${account}`);
  return JSON.parse(res.data.notes);
}

async function getOrdersByAccount (account) {
  const res = await instance.get(`/orders/${account}`);
  if (res.data === null) {
    return [];
  } else {
    return JSON.parse(res.data.orders);
  }
}

async function getOrder (id) {
  const res = await instance.get(`/order/${id}`);
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
    return JSON.parse(res.data.orders);
  }
}

// post
function addAccount (key, account) {
  return instance.post('/accounts', {
    key,
    account,
  });
}

function addNote (account, note) {
  return instance.post('/notes', {
    account,
    note,
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

function addOrder (order) {
  return instance.post('/orders', {
    order,
  });
}


async function setViewingKey (key, vk) {
  return instance.post('/vk', {
    key,
    vk,
  });
}

function createAccount () {
  return instance.post('/account');
}

function generateProof (params) {
  return instance.post('/circuit', params);
}

// put
function updateNote (account, note) {
  return instance.put('/notes', {
    account,
    note,
  });
}

function updateOrderByAccount (account, order) {
  return instance.put(`/orders/${account}`, {
    order,
  });
}

function updateOrder (order) {
  return instance.put('/orders', {
    order,
  });
}

export {
  getViewingKey,
  getAccounts,
  getNotes,
  getTransferNotes,
  getOrder,
  getOrdersByAccount,
  getOrders,
  addAccount,
  addNote,
  addTransferNote,
  addOrderByAccount,
  addOrder,
  setViewingKey,
  createAccount,
  generateProof,
  updateNote,
  updateOrderByAccount,
  updateOrder,
};
