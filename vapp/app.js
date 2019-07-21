const express = require('express');
const cors = require('cors')
const Web3 = require('web3');

global.web3 = new Web3("http://localhost:8545");

const {
  getMintNBurnProof,
  getTransferProof,
  getMakeOrderProof,
  getTakeOrderProof,
  getSettleOrderProof,
} = require('../scripts/lib/dockerUtils');

const app = express();
app.use(cors());

const generators = {
  mintNBurnNote: getMintNBurnProof,
  transferNote: getTransferProof,
  makeOrder: getMakeOrderProof,
  takeOrder: getTakeOrderProof,
  settleOrder: getSettleOrderProof,
}

app.get('/:circuit', asyncWrap(async function (req, res) {
  const {
    circuit
  } = req.params;

  const params = JSON.parse(req.query.params);

  const generator = generators[circuit];
  if (!generator) {
    throw new Error("Unknown circuit " + circuit);
  }

  const proof = await generator(...params);
  return res.status(200).json({
    proof: proof
  });
}));

app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(400).json({
    message: err.message,
  });
});


app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});

function asyncWrap(f) {
  return function (res, req, next) {
    f(res, req, next).catch(next);
  }
}