const crypto = require('crypto');
const path = require('path');

// Use absolute path to ensure correct module resolution
const scriptsLibPath = path.join(__dirname, '..', '..', 'scripts', 'lib');
const noteProofHelper = require(path.join(scriptsLibPath, 'noteProofHelper'));
const circomlibBabyJub = require(path.join(scriptsLibPath, 'circomlibBabyJub'));

/**
 * Create a new BabyJubJub account
 * @param {string} passphrase - Passphrase to encrypt the secret key
 * @returns {Promise<{address: string, keystore: object}>}
 */
async function createAccount(passphrase) {
  try {
    console.log('Creating BabyJubJub account...');

    // Generate BabyJubJub keypair
    const keypair = await noteProofHelper.generateKeypair();
    console.log('Keypair generated');

    // Derive address from public key (first 40 hex chars of SHA256(pk.x || pk.y))
    const address = await circomlibBabyJub.pubKeyToAddress({
      x: BigInt(keypair.pk.x),
      y: BigInt(keypair.pk.y)
    });
    console.log('Address derived:', address);

    // Encrypt secret key with passphrase using AES-256-GCM
    const keystore = encryptSecretKey(keypair.sk, passphrase);
    console.log('Keystore created');

    return {
      address: address.slice(2), // Remove '0x' prefix
      publicKey: keypair.pk,
      keystore
    };
  } catch (err) {
    console.error('Error creating account:', err);
    throw err;
  }
}

/**
 * Unlock an account to get the secret key
 * @param {string} passphrase - Passphrase to decrypt
 * @param {object} keystore - Encrypted keystore
 * @returns {Promise<{secretKey: string, publicKey: object, address: string}>}
 */
async function unlockAccount(passphrase, keystore) {
  try {
    // Decrypt secret key
    const secretKey = decryptSecretKey(keystore, passphrase);

    // Derive public key from secret key
    const pk = await noteProofHelper.derivePublicKey(secretKey);

    // Derive address
    const address = await circomlibBabyJub.pubKeyToAddress({
      x: BigInt(pk.x),
      y: BigInt(pk.y)
    });

    return {
      secretKey,
      publicKey: pk,
      address
    };
  } catch (err) {
    throw new Error('Failed to unlock account: ' + err.message);
  }
}

/**
 * Encrypt secret key with passphrase using AES-256-GCM
 */
function encryptSecretKey(secretKey, passphrase) {
  // Derive key from passphrase using scrypt
  const salt = crypto.randomBytes(32);
  const key = crypto.scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 });

  // Encrypt with AES-256-GCM
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const skHex = secretKey.startsWith('0x') ? secretKey.slice(2) : secretKey;
  let encrypted = cipher.update(skHex, 'hex', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    crypto: {
      cipher: 'aes-256-gcm',
      ciphertext: encrypted,
      cipherparams: {
        iv: iv.toString('hex')
      },
      kdf: 'scrypt',
      kdfparams: {
        n: 16384,
        r: 8,
        p: 1,
        dklen: 32,
        salt: salt.toString('hex')
      },
      mac: authTag.toString('hex')
    },
    version: 1
  };
}

/**
 * Decrypt secret key from keystore
 */
function decryptSecretKey(keystore, passphrase) {
  const { crypto: c } = keystore;

  // Derive key from passphrase
  const salt = Buffer.from(c.kdfparams.salt, 'hex');
  const key = crypto.scryptSync(passphrase, salt, c.kdfparams.dklen, {
    N: c.kdfparams.n,
    r: c.kdfparams.r,
    p: c.kdfparams.p
  });

  // Decrypt
  const iv = Buffer.from(c.cipherparams.iv, 'hex');
  const authTag = Buffer.from(c.mac, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(c.ciphertext, 'hex', 'hex');
  decrypted += decipher.final('hex');

  return '0x' + decrypted;
}

module.exports = {
  createAccount,
  unlockAccount,
};
