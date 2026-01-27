const Web3Utils = require('web3-utils');

const {
  constants,
  Note,
  NoteState,
  decrypt,
} = require('./Note');

let ZkDex;
if (typeof artifacts === 'undefined') {
  ZkDex = require('truffle-contract')(require("../../build/contracts/ZkDex.json"));
  ZkDex.setProvider(web3.currentProvider);
} else {
  ZkDex = artifacts.require('ZkDex');
}

/**
 * Client-side wallet that manages viewing keys, decrypted notes, and ZkDex contract event subscriptions.
 * Listens for on-chain NoteStateChange events and automatically decrypts notes using stored viewing keys.
 */
class Wallet {
  /**
   * Initialize the wallet with empty storage for viewing keys, notes, and transactions.
   */
  constructor() {
    this._vks = {};
    this._notes = {};
    this._transactions = {};
  }

  /**
   * Register a viewing key for an Ethereum address. Throws if a key is already registered.
   * @param {string} addr - The Ethereum address to associate with the viewing key
   * @param {string} vk - The viewing key (will be zero-padded to 64 hex characters)
   */
  setVk(addr, vk) {
    if (this._vks[addr]) {
      throw new Error(`${addr} has already vk ${this._vks[addr]}`);
    }
    this._vks[addr] = Web3Utils.padLeft(vk, 64);
  }

  /**
   * Retrieve the viewing key associated with an Ethereum address. Throws if no key is registered.
   * @param {string} addr - The Ethereum address whose viewing key to retrieve
   * @returns {string} The zero-padded viewing key hex string
   */
  getVk(addr) {
    if (!this._vks[addr]) {
      throw new Error(`${addr} has no vk`);
    }
    return this._vks[addr];
  }

  /**
   * Add a note to the collection for a given address if it is not already present (deduplicated by hash).
   * @param {string} addr - The Ethereum address that owns the note
   * @param {Note} note - The Note instance to add
   */
  addNote(addr, note) {
    if (!this._notes[addr]) {
      this._notes[addr] = [];
    }

    if (this.hasNote(addr, note.hash())) {
      return;
    }

    this._notes[addr].push(note);
  }

  /**
   * Retrieve all notes belonging to an address. Returns an empty array if none exist.
   * @param {string} addr - The Ethereum address whose notes to retrieve
   * @returns {Note[]} An array of Note instances for the given address
   */
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

  /** @todo Implement note transfer logic */
  async transferNote(from, to, value, vk = '', oldNote, originalNote = null) {

  }

  /** @todo Implement make order logic */
  async makeOrder() {

  }

  /** @todo Implement take order logic */
  async takeOrder() {

  }

  /** @todo Implement settle order logic */
  async settleOrder() {

  }

  /**
   * Initialize the wallet by connecting to a deployed ZkDex contract and start listening for events.
   * @param {string} zkdexAddress - The deployed ZkDex contract address
   * @returns {Promise<void>}
   */
  async init(zkdexAddress) {
    this.zkdex = await ZkDex.at(zkdexAddress);
    this._listen();
  }

  /**
   * Subscribe to NoteStateChange events from the ZkDex contract and attempt to decrypt
   * each encrypted note using all registered viewing keys. Successfully decrypted notes
   * are automatically added to the corresponding address's note collection.
   * @returns {void}
   */
  _listen() {
    this.zkdex.NoteStateChange(async (err, res) => {
      if (err !== null) {
        console.error('Failed to listen NoteStateChange event', err);
        return;
      }

      const { note, state } = res.args;
      const encryptedNote = await this.zkdex.encryptedNotes(note);

      // short circuit for unknown encrypted note
      if (!encryptedNote) {
        return;
      }

      Object.keys(this._vks).forEach((account) => {
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
};
