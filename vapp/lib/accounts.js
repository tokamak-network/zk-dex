const crypto = require('crypto');
const KeyStore = require('zk-dex-keystore');
const ZkDexPrivateKey = KeyStore.ZkDexPrivateKey;

function createAccount (passphrase) {
  const dk = KeyStore.create();

  const priv = ZkDexPrivateKey.randomPrivateKey();

  const keyObj = KeyStore.dump(
    passphrase,
    dk.privateKey,
    dk.salt,
    dk.iv,
  );

  return keyObj;
}

// TODO: unlocked private key should be located only in server side, and should not be returned.
function unlockAccount (passphrase, keyObj) {
  let privateKey;

  try {
    privateKey = KeyStore.recover(passphrase, keyObj);
  } catch (err) {
    throw new Error('Failed to unlock account: ' + err.message);
  }

  return privateKey;
}

/**
 * @param {Object=} options Encryption parameters.
 * @param {string=} options.kdf Key derivation function (default: pbkdf2).
 * @param {string=} options.cipher Symmetric cipher (default: constants.cipher).
 * @param {Object=} options.kdfparams KDF parameters (default: constants.<kdf>).
 * @param {string|Buffer} password User-supplied password.
 * @returns {ZkDexPrivateKey}
 */
function fromKeyStoreObject (options, password = '') {
  const privBuf = KeyStore.recover(password, options);
  return new ZkDexPrivateKey(privBuf);
}

/**
 * @param {ZkDexPrivateKey} privKey private key
 * @param {String} password password to encrypt key object
 * @returns {Object}
 */
function toKeyStoreObject (privKey, password = '') {
  if (!(privKey instanceof ZkDexPrivateKey)) {
    throw new Error('Private Key is not instance of ZkDexPrivateKey');
  }

  const saltLen = KeyStore.constants.keyBytes + KeyStore.constants.ivBytes;
  const ivLen = KeyStore.constants.ivBytes;

  const randomBytes = crypto.randomBytes(saltLen + ivLen);

  return KeyStore.dump(password, privKey.toHex().slice(2), randomBytes.slice(saltLen), randomBytes.slice(saltLen, saltLen + ivLen));
}

module.exports = {
  createAccount,
  unlockAccount,
  fromKeyStoreObject,
  toKeyStoreObject,
};
