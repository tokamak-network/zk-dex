const crypto = require('crypto');
const KeyStore = require('zk-dex-keystore');
const ZkDexPrivateKey = KeyStore.ZkDexPrivateKey;

/**
 *
 * @param {string} passphrase User-supplied passphrase.
 *  @return {Object} Encryption parameters.
 */
function createAccount (passphrase) {
  const dk = KeyStore.create();

  const keyObj = KeyStore.dump(
    passphrase,
    dk.privateKey,
    dk.salt,
    dk.iv,
  );

  return keyObj;
}

// TODO: unlocked private key should be located only in server side, and should not be returned.

/**
 *
 * @param {string|Buffer} passphrase User-supplied passphrase.
 * @param {Object=} keyObj Encryption parameters.
 * @returns {ZkDexPrivateKey}
 */
function unlockAccount (passphrase, keyObj) {
  let buf;

  try {
    buf = KeyStore.recover(passphrase, keyObj);
  } catch (err) {
    throw new Error('Failed to unlock account: ' + err.message);
  }

  return new ZkDexPrivateKey(buf.toString('hex'));
}

/**
 * @param {Object=} keyObj Encryption parameters.
 * @param {string=} keyObj.kdf Key derivation function (default: pbkdf2).
 * @param {string=} keyObj.cipher Symmetric cipher (default: constants.cipher).
 * @param {Object=} keyObj.kdfparams KDF parameters (default: constants.<kdf>).
 * @param {string|Buffer} passphrase User-supplied passphrase.
 * @returns {ZkDexPrivateKey}
 */
function fromKeyStoreObject (keyObj, passphrase = '') {
  const privBuf = KeyStore.recover(passphrase, keyObj);
  return new ZkDexPrivateKey(privBuf);
}

/**
 * @param {ZkDexPrivateKey} privKey private key
 * @param {String} passphrase passphrase to encrypt key object
 * @returns {Object}
 */
function toKeyStoreObject (privKey, passphrase = '') {
  if (!(privKey instanceof ZkDexPrivateKey)) {
    throw new Error('Private Key is not instance of ZkDexPrivateKey');
  }

  const saltLen = KeyStore.constants.keyBytes + KeyStore.constants.ivBytes;
  const ivLen = KeyStore.constants.ivBytes;

  const randomBytes = crypto.randomBytes(saltLen + ivLen);

  return KeyStore.dump(passphrase, privKey.toHex().slice(2), randomBytes.slice(saltLen), randomBytes.slice(saltLen, saltLen + ivLen));
}

module.exports = {
  createAccount,
  unlockAccount,
  fromKeyStoreObject,
  toKeyStoreObject,
};
