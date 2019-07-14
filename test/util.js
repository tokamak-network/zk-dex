const fs = require('fs');
const BN = require('bn.js');

function sleep(t) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, t * 1000);
  });
}

const rx2 = /([0-9]+)[,]/gm
function parseProof(file) {
  let proofJson = fs.readFileSync(file, 'utf8');
  proofJson.match(rx2).forEach(p => {
    proofJson = proofJson.replace(p, `"${p.slice(0, p.length-1)}",`)
  })
  proofJson = JSON.parse(proofJson);
  const proof = proofJson.proof;
  const input = proofJson.input;
  input.forEach((i, key) => {
    if (typeof i == 'number') i = i.toString();
    input[key] = '0x' + new BN(i, 10).toString('hex')
  })

  const _proof = [];
  Object.keys(proof).forEach(key => _proof.push(proof[key]));
  _proof.push(input);
  return _proof;
}

function marshalString (str) {
  if (str.slice(0, 2) === '0x') return str;
  return '0x'.concat(str);
}

function unmarshalString (str) {
  if (str.slice(0, 2) === '0x') return str.slice(2);
  return str;
}

function calcHash(h0, h1) {
  return marshalString(unmarshalString(h0) + unmarshalString(h1));
}

module.exports = {
  sleep,
  parseProof,
  calcHash,
  marshalString,
  unmarshalString,
}