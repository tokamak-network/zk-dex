import axios from 'axios';

function createInstance () {
  return axios.create({
    baseURL: 'http://127.0.0.1:3000',
  });
}

const instance = createInstance();

async function getNotes (key) {
  const res = await instance.get(`/notes/${key}`);
  return JSON.parse(res.data.notes);
}

async function getOrders () {
  const res = await instance.get('/orders');
  return JSON.parse(res.data.orders);
}

async function getOrderCount () {
  const res = await instance.get('/orders/count');
  return res.data.count;
}

function addNote (key, note) {
  return instance.post('/notes', {
    key,
    note,
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

export {
  getNotes,
  getOrders,
  getOrderCount,
  addNote,
  updateNoteState,
  addOrder,
  generateProof,
};
