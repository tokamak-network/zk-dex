const crypto = require('crypto');
const mode = 'aes-256-cbc';

class Note {
  constructor(owner, value, token, viewingKey, salt) {
    this.owner = web3.utils.padLeft(owner , 32);
    this.value = web3.utils.padLeft(value , 32);
    this.token = web3.utils.padLeft(token , 32);
    this.viewingKey = web3.utils.padLeft(viewingKey , 32);
    this.salt = web3.utils.padLeft(salt , 32);
  }

  toString() {
    return JSON.stringify(this);
  }

  encrypt(sk) {
    const cipher = crypto.createCipher(mode, sk);
    return cipher.update(this.toString(), 'utf8', 'hex') + cipher.final('hex');
  }
}

function decrypt(sk) {
  const decipher = crypto.createDecipher(mode, sk);
  const note = JSON.stringify(decipher.update(result, 'hex', 'utf8') + decipher.final('utf8'));
  return new Note(note.owner, note.value, note.token, note.viewingKey, note.salt);
}

module.exports = {
  Note,
  decrypt,
};