// eg. num | padLeft(32)
import Web3Utils from 'web3-utils';
export { padLeft, hexToNumberString } from 'web3-utils';

// BN to number string
export function toNumberString (value) {
  return value.toString();
}

export function toNumber (value) {
  if (!value) return '';
  return parseInt(value);
}

export function stringToHex (str) {
  if (!str) return '';
  return `0x${str}`;
}

export function address (a) {
  return Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(a)), 40);
}

export function orderState (value) {
  switch (value) {
  case '0x0':
    return 'CRETAED';
  case '0x1':
    return 'TAKEN';
  case '0x2':
    return 'SETTLED';
  default:
    return '';
  }
}

export function noteState (value) {
  switch (value) {
  case '0x0':
    return 'INVALID';
  case '0x1':
    return 'VALID';
  case '0x2':
    return 'TRADING';
  case '0x3':
    return 'SPENT';
  default:
    return '';
  }
}

export function transferNoteType (value) {
  switch (value) {
  case '0x0':
    return 'Send';
  case '0x1':
    return 'Receive';
  default:
    return '';
  }
}

export function orderType (value) {
  switch (value) {
  case '0x0':
    return 'Sell';
  case '0x1':
    return 'Buy';
  default:
    return '';
  }
}

export function tokenType (type) {
  switch (type) {
  case '0x0':
    return 'ETH';
  case '0x1':
    return 'DAI';
  default:
    return '';
  }
}

export function isSmartNote (value) {
  switch (value) {
  case '0x0':
    return false;
  case '0x1':
    return true;
  default:
    return '';
  }
}

export function abbreviate (a) {
  if (a) {
    const pre = a.substring(0, 6);
    const pos = a.substring(38, 42);
    return `${pre}...${pos}`;
  }
}

import { getNoteHash } from '../../../scripts/helper/noteHelper';
import { marshal, unmarshal } from '../../../scripts/lib/util';
import {
  addZkPrefix,
  removeZkPrefix,
} from 'zk-dex-keystore/lib/utils';
import { ZkDexAddress, ZkDexPublicKey } from 'zk-dex-keystore/lib/Account';
export function toNoteHash (note) {
  const noteHash = getNoteHash(
    unmarshal(note.pubKey0),
    unmarshal(note.pubKey1),
    unmarshal(note.value),
    unmarshal(note.token),
    unmarshal(note.viewingKey),
    unmarshal(note.salt),
  );

  return marshal(noteHash.toString());
}

export function toZkAddress (pubKey0, pubKey1) {
  return (new ZkDexPublicKey(pubKey0, pubKey1)).toAddress().toString();
}

export function toPubKey (zkAddress) {
  return ZkDexAddress.fromBase58(removeZkPrefix(zkAddress)).toPubKey();
}

export function hexSlicer (str = '') {
  if (str.length < 11) {
    return str;
  }

  return `${str.slice(0, 6)}...${str.slice(-4)}`;
}

export function fromWei (wei) {
  if (wei) return Web3Utils.fromWei(wei, 'ether');
  return '';
}
