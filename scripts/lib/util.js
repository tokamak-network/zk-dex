const fs = require('fs');
const BN = require('bn.js');
const Web3Utils = require('web3-utils');

function sleep(t) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, t * 1000);
  });
}

const rx2 = /([0-9]+)[,]/gm;
function parseProof(file) {
  let proofJson = fs.readFileSync(file, 'utf8');
  proofJson.match(rx2).forEach((p) => {
    proofJson = proofJson.replace(p, `"${p.slice(0, p.length - 1)}",`);
  });
  proofJson = JSON.parse(proofJson);
  const { proof } = proofJson;
  const { input } = proofJson;
  input.forEach((i, key) => {
    if (typeof i === 'number') i = i.toString();
    input[key] = `0x${new BN(i, 10).toString('hex')}`;
  });

  const _proof = [];
  Object.keys(proof).forEach(key => _proof.push(proof[key]));
  _proof.push(input);
  return _proof;
}

function parseProofObj(obj) {
  const { proof } = obj;
  const { input } = obj;

  const _proof = [];
  Object.keys(proof).forEach(key => _proof.push(proof[key]));
  _proof.push(input);
  return _proof;
}

function marshal(str) {
  if (!str) throw new Error("Cannot add hex prefix empty string");

  return '0x' + unmarshal(str);
}

function unmarshal(_str) {
  let str;
  if (_str instanceof Buffer) {
    str = _str.toString('hex');
  } else {
    str = _str.trim();
  }

  if (!str) throw new Error("Cannot remove hex prefix empty string");

  const i = str.lastIndexOf("0x");
  if (i >= 0) str = str.slice(i+2);

  if (str.length % 2 === 1) {
    str = '0' + str;
  }

  return str;
}

function calcHash(h0, h1) {
  return marshal(unmarshal(h0) + unmarshal(h1));
}

function split32BytesTo16BytesArr(b) {
  const v = Web3Utils.toBN(b).toString(16, 64);
  return [
    marshal(v.slice(0, 32)),
    marshal(v.slice(32)),
  ];
}

function reduceParams(params) {
  return params
    .map(p => web3.utils.toBN(p, 16).toString(10))
    .reduce((a, b) => `${a} ${b}`, '').trim();
}

function getQuotient(x, y) {
  const q = (x.sub(x.mod(y))).div(y);
  return Web3Utils.toHex(q)
}

function getRemainder(x, y) {
  const r = x.mod(y)
  return Web3Utils.toHex(r)
}

module.exports = {
  sleep,
  parseProof,
  parseProofObj,
  calcHash,
  marshal,
  unmarshal,
  split32BytesTo16BytesArr,
  reduceParams,
  getQuotient,
  getRemainder,
};
