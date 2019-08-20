const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const {
  getMintNBurnProof,
  getTransferProof,
  getMakeOrderProof,
  getTakeOrderProof,
  getSettleOrderProof,
} = require('../scripts/lib/dockerUtils');

const {
  getViewingKey,
  getNotes,
  getTransferNotes,
  getAccounts,
  getOrder,
  getOrders,
  getOrdersByAccount,
  addAccount,
  addNote,
  addTransferNote,
  addOrder,
  addOrderByAccount,
  setViewingKey,
  updateNote,
  updateOrder,
  updateOrderByAccount,
} = require('./localstorage');

const generators = {
  mintNBurnNote: getMintNBurnProof,
  transferNote: getTransferProof,
  makeOrder: getMakeOrderProof,
  takeOrder: getTakeOrderProof,
  settleOrder: getSettleOrderProof,
};

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// get
app.get(
  '/vk/:key',
  function (req, res) {
    const key = req.params.key;
    const vk = getViewingKey(key);
    return res.status(200).json({
      vk,
    });
  }
);

app.get(
  '/accounts/:key',
  function (req, res) {
    const key = req.params.key;
    const accounts = getAccounts(key);
    return res.status(200).json({
      accounts,
    });
  }
);

app.get(
  '/notes/:account',
  function (req, res) {
    const account = req.params.account;
    const notes = getNotes(account);
    return res.status(200).json({
      notes,
    });
  }
);

app.get(
  '/notes/transfer/:account',
  function (req, res) {
    const account = req.params.account;
    const notes = getTransferNotes(account);
    return res.status(200).json({
      notes,
    });
  }
);

app.get(
  '/order/:id',
  function (req, res) {
    const id = req.params.id;
    const order = getOrder(id);
    return res.status(200).json({
      order,
    });
  }
);

app.get(
  '/orders/:account',
  function (req, res) {
    const account = req.params.account;
    const orders = getOrdersByAccount(account);
    return res.status(200).json({
      orders,
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

// post
app.post(
  '/account',
  function (req, res) {
    const address = createAccount();
    return res.status(200).json({
      address,
    });
  }
);

app.post(
  '/notes',
  function (req, res) {
    const account = req.body.account;
    const note = req.body.note;
    addNote(account, note);
    return res.status(200).json({});
  }
);

app.post(
  '/notes/transfer',
  function (req, res) {
    const account = req.body.account;
    const note = req.body.note;
    addTransferNote(account, note);
    return res.status(200).json({});
  }
);

app.post(
  '/orders/:account',
  function (req, res) {
    const account = req.params.account;
    const order = req.body.order;
    addOrderByAccount(account, order);
    return res.status(200).json({});
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
  '/vk',
  function (req, res) {
    const key = req.body.key;
    const vk = req.body.vk;
    setViewingKey(key, vk);
    return res.status(200).json({});
  }
);

app.post(
  '/accounts',
  function (req, res) {
    const key = req.body.key;
    const account = req.body.account;
    addAccount(key, account);
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

app.put(
  '/notes',
  function (req, res) {
    const account = req.body.account;
    const note = req.body.note;
    updateNote(account, note);
    return res.status(200).json({});
  }
);

app.put(
  '/orders/:account',
  function (req, res) {
    const account = req.params.account;
    const order = req.body.order;
    updateOrderByAccount(account, order);
    return res.status(200).json({});
  }
);

app.put(
  '/orders',
  function (req, res) {
    const order = req.body.order;
    updateOrder(order);
    return res.status(200).json({});
  }
);

const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider('http://127.0.0.1:8545'));

let ZkDex;
if (typeof artifacts === 'undefined') {
  ZkDex = require('truffle-contract')(require('../build/contracts/ZkDex.json'));
  ZkDex.setProvider(web3.currentProvider);
} else {
  ZkDex = artifacts.require('ZkDex');
}

(async () => {
  const dexAddress = process.argv.slice(2)[0];

  const zkdex = await ZkDex.at(dexAddress);
  zkdex.NoteStateChange(async (err, res) => {
    if (err !== null) {
      console.error('Failed to listen NoteStateChange event', err);
      return;
    }

    // const { note, state } = res.args;
  });
})();

const keythereum = require('keythereum');

function createAccount () {
  const password = '1234';

  const params = { keyBytes: 32, ivBytes: 16 };
  const dk = keythereum.create(params);

  const options = {
    kdf: 'pbkdf2',
    cipher: 'aes-128-ctr',
    kdfparams: { c: 262144, dklen: 32, prf: 'hmac-sha256' },
  };
  const keyObject = keythereum.dump(
    password,
    dk.privateKey,
    dk.salt,
    dk.iv,
    options
  );

  return '0x' + keyObject.address;
}

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
