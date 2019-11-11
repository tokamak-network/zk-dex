import { Note, constants } from '../../../scripts/lib/Note';
import Web3Utils from 'web3-utils';

const salt = Web3Utils.randomHex(8);
const viewingKey = Web3Utils.randomHex(8);

const createNote = function (account, amount, type, isSmart) {
  return new Note(account, amount, type, viewingKey, salt, isSmart);
};

export { createNote };
