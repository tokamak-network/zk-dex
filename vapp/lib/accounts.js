const keythereum = require('keythereum');

function createAccount (passphrase) {
  const params = { keyBytes: 32, ivBytes: 16 };
  const dk = keythereum.create(params);

  const options = {
    kdf: 'pbkdf2',
    cipher: 'aes-128-ctr',
    kdfparams: { c: 262144, dklen: 32, prf: 'hmac-sha256' },
  };

  const keyObject = keythereum.dump(
    passphrase,
    dk.privateKey,
    dk.salt,
    dk.iv,
    options
  );

  return keyObject;
}

function unlockAccount (passphrase, keystore) {
  let privateKey;
  try {
    privateKey = keythereum.recover(passphrase, keystore);
  } catch (err) {
    throw new Error('Failed to unlock account: ' + err.message);
  }
  return privateKey;
}

module.exports = {
  createAccount,
  unlockAccount,
}
;
