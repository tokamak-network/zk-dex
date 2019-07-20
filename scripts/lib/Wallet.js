const {
  constants,
  Note,
  NoteState,
  decrypt
} = require('./Note');

const ZkDex = artifacts.require("ZkDex");

class Wallet {
  constructor() {
    this._vks = {};
    this._notes = {};
    this._transactions = {};

  }

  setVk(addr, vk) {
    if (this._vks[addr]) {
      throw new Error(`${addr} has already vk ${this._vks[addr]}`);
    }
    this._vks[addr] = web3.utils.padLeft(vk, 64);
  }

  getVk(addr) {
    if (!this._vks[addr]) {
      throw new Error(`${addr} has no vk`);
    }
    return this._vks[addr];
  }

  addNote(addr, note) {
    if (!this._notes[addr]) {
      this._notes[addr] = [];
    }

    if (this.hasNote(addr, note.hash())) {
      return;
    }

    this._notes[addr].push(note);
    console.log(`[${addr}] has Note#${note.hash()}`);
  }

  getNotes(addr) {
    if (!this._notes[addr]) {
      this._notes[addr] = [];
    }

    return this._notes[addr];
  }

  /**
   * @dev return whether addr has noteHash
   */
  hasNote(addr, noteHash) {
    if (!this._notes[addr]) {
      this._notes[addr] = [];
    }

    for (const note of this._notes[addr]) {
      if (note.hash() === noteHash) {
        return true;
      }
    }

    return false;
  }

  // TODO: implement below functions
  async transferNote(from, to, value, vk = '', oldNote, originalNote = null) {

  }

  async makeOrder() {

  }

  async takeOrder() {

  }

  async settleOrder() {

  }

  async init(zkdexAddress) {
    this.zkdex = await ZkDex.at(zkdexAddress);
    this._listen();
  }

  _listen() {
    this.zkdex.NoteStateChange(async (err, res) => {
      if (err !== null) {
        console.error("Failed to listen NoteStateChange event", err)
        return;
      }

      const { note, state } = res.args;
      console.log(`[Note#${note}] ${NoteState.toString(state)}`);

      const encryptedNote = await this.zkdex.encryptedNotes(note);

      // short circuit for unknown encrypted note
      if (!encryptedNote) {
        return;
      }

      Object.keys(this._vks).forEach(account => {
        const vk = this._vks[account];

        let decryptedNote;
        try {
          decryptedNote = decrypt(encryptedNote, vk);
        } catch (e) {
          // ignore error
          return;
        }

        this.addNote(account, decryptedNote);
      });

    });
  }
}

module.exports = {
  Wallet,
}