const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Web3 = require('web3');

global.web3 = new Web3('http://localhost:8545');

const {
  getMintNBurnProof,
  getTransferProof,
  getMakeOrderProof,
  getTakeOrderProof,
  getSettleOrderProof,
} = require('../scripts/lib/dockerUtils');

const {
  addNote,
  updateNoteState,
  getNotes,
  addOrder,
  getOrders,
  getOrderCount,
} = require('./localstorage');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

const generators = {
  mintNBurnNote: getMintNBurnProof,
  transferNote: getTransferProof,
  makeOrder: getMakeOrderProof,
  takeOrder: getTakeOrderProof,
  settleOrder: getSettleOrderProof,
};

app.get(
  '/orders/count',
  function (_, res) {
    const count = getOrderCount();
    return res.status(200).json({
      count,
    });
  }
);

app.get(
  '/orders',
  function (req, res) {
    const orders = getOrders();
    return res.status(200).json({
      orders,
    });
  }
);

app.get(
  '/notes/:key',
  function (req, res) {
    const key = req.params.key;
    const notes = getNotes(key);
    return res.status(200).json({
      notes,
    });
  }
);

app.post(
  '/orders',
  function (req, res) {
    const order = req.body.order;
    addOrder(order);
    return res.status(200).json({});
  }
);

app.post(
  '/notes',
  function (req, res) {
    const key = req.body.key;
    const note = req.body.note;
    addNote(key, note);
    return res.status(200).json({});
  }
);

app.put(
  '/notes',
  function (req, res) {
    const key = req.body.key;
    const hash = req.body.hash;
    const state = req.body.state;
    updateNoteState(key, hash, state);
    return res.status(200).json({});
  }
);

app.post(
  '/circuit',
  asyncWrap(async function (req, res) {
    const circuit = req.body.circuit;
    const params = req.body.params;

    const generator = generators[circuit];
    if (!generator) {
      throw new Error('Unknown circuit ' + circuit);
    }

    const proof = await generator(...params);
    return res.status(200).json({
      proof,
    });
  })
);

app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(400).json({
    message: err.message,
  });
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});

function asyncWrap (f) {
  return function (res, req, next) {
    f(res, req, next).catch(next);
  };
}
