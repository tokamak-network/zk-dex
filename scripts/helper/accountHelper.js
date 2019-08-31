const BN = require('bn.js');
const { PublicKey, PrivateKey } = require('babyjubjub');
const crypto = require('crypto');
const Web3Utils = require('web3-utils');

function getSk() {
  let sk = PrivateKey.getRandObj().field;
  return sk;
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

module.exports = {
  getSk,
  getPrivKey,
  getPubKey,
  getOwner,
}