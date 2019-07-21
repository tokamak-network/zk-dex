const express = require('express');
const cors = require('cors')

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

app.get('/', async function (req, res) {
  const {
    circuit,
    params,
  } = req.query;

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

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});