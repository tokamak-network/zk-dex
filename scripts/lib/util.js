const fs = require('fs');
const BN = require('bn.js');
const Web3Utils = require('web3-utils');

/**
 * Sleep for a given number of seconds.
 * @param {number} t - Duration in seconds
 * @returns {Promise<void>}
 */
function sleep(t) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, t * 1000);
  });
}

const rx2 = /([0-9]+)[,]/gm;
/**
 * Parse a ZoKrates-format proof JSON file into contract call arguments.
 * @param {string} file - Path to the proof JSON file
 * @returns {Array} Proof array: [a, b, c, input]
 */
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

/**
 * Parse a proof object into contract call arguments.
 * @param {{ proof: Object, input: Array }} obj - Proof object with proof and input fields
 * @returns {Array} Proof array: [a, b, c, input]
 */
function parseProofObj(obj) {
  const { proof } = obj;
  const { input } = obj;

  const _proof = [];
  Object.keys(proof).forEach(key => _proof.push(proof[key]));
  _proof.push(input);
  return _proof;
}

/**
 * Ensure a hex string has the '0x' prefix.
 * @param {string} str - Hex string, with or without '0x' prefix
 * @returns {string} '0x'-prefixed hex string
 */
function marshal(str) {
  if (str.slice(0, 2) === '0x') return str;
  return '0x'.concat(str);
}

/**
 * Remove the '0x' prefix from a hex string.
 * @param {string} str - Hex string, with or without '0x' prefix
 * @returns {string} Hex string without '0x' prefix
 */
function unmarshal(str) {
  if (str.slice(0, 2) === '0x') return str.slice(2);
  return str;
}

/**
 * Concatenate two hex strings into a single hash.
 * @param {string} h0 - First hex string
 * @param {string} h1 - Second hex string
 * @returns {string} Concatenated '0x'-prefixed hex string
 */
function calcHash(h0, h1) {
  return marshal(unmarshal(h0) + unmarshal(h1));
}

/**
 * Split a 32-byte value into an array of two 16-byte hex strings.
 * @param {string|BN} b - 32-byte value (hex string or BN)
 * @returns {string[]} Array of two '0x'-prefixed 16-byte hex strings [high, low]
 */
function split32BytesTo16BytesArr(b) {
  const v = Web3Utils.toBN(b).toString(16, 64);
  return [
    marshal(v.slice(0, 32)),
    marshal(v.slice(32)),
  ];
}

/**
 * Reduce an array of hex parameters to a space-separated decimal string.
 * @param {string[]} params - Array of hex strings
 * @returns {string} Space-separated decimal string
 */
function reduceParams(params) {
  return params
    .map(p => web3.utils.toBN(p, 16).toString(10))
    .reduce((a, b) => `${a} ${b}`, '').trim();
}

/**
 * Compute the integer quotient of x / y.
 * @param {BN} x - Dividend
 * @param {BN} y - Divisor
 * @returns {string} Quotient as hex string
 */
function getQuotient(x, y) {
  const q = (x.sub(x.mod(y))).div(y);
  return Web3Utils.toHex(q)
}

/**
 * Compute the remainder of x % y.
 * @param {BN} x - Dividend
 * @param {BN} y - Divisor
 * @returns {string} Remainder as hex string
 */
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
