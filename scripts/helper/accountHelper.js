const bs58 = require('bs58');
const { PublicKey, PrivateKey } = require('babyjubjub');
const crypto = require('crypto');
const Web3Utils = require('web3-utils');

const { marshal, unmarshal } = require('../lib/util');

function getSk() {
  let sk = PrivateKey.getRandObj().field;
  return sk;
}

function getSkHex() {
  return PrivateKey.getRandObj().hexString;
}

function getPrivKey(sk) {
  return new PrivateKey(sk);
}

function getPubKey(privKey) {
  return PublicKey.fromPrivate(privKey);
}

function getOwner(sk) {
  const privKey = getPrivKey(sk);
  const pubKey = getPubKey(privKey);
  const pubKeyX = pubKey.p.x.n.toString(16, 64);
  const pubKeyY = pubKey.p.y.n.toString(16, 64);

  return [pubKeyX, pubKeyY]
}

/**
 * @param {String} hexString hex-encoded string
 * @returns {String} base58-encoded string
 */
function encodeBase58(hexString) {
  return bs58.encode(Buffer.from(unmarshal(hexString), 'hex'));
}

/**
 *
 * @param {String} base58String base58-encoded string
 * @returns {String} hex-encoded string
 */
function decodeBase58(base58String) {
  return bs58.decode(base58String).toString('hex');
}

module.exports = {
  getSk,
  getSkHex,
  getPrivKey,
  getPubKey,
  getOwner,
  encodeBase58,
  decodeBase58,
}