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

app.get('/:circuit', async function (req, res) {
  const {
    circuit
  } = req.params;

  let params;

  try {
    params = JSON.parse(req.query.params);
  } catch (e) {
    return res.status(400).json({
      message: 'Failed to parse JSON: '+ e.message,
    });
  }

  const generator = generators[circuit];
  if (!generator) {
    return res.status(400).json({
      message: "Unknown circuit " + circuit
    });
  }

  try {
    const proof = await generator(...params);
    return res.status(200).json({
      proof: proof
    })
  } catch (e) {
    return res.status(400).json({
      message: `Failed to generate proof: ${e.message}`
    })
  }

});

app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(400).json({
    message: err.message,
  });
});


app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});