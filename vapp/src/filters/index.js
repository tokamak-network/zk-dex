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
  return Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(a)), 20);
}

export function orderState (value) {
  switch (value) {
  case '0':
    return 'CRETAED';
  case '1':
    return 'TAKEN';
  case '2':
    return 'SETTLED';
  default:
    return '';
  }
}

export function noteState (value) {
  switch (value) {
  case '0':
    return 'INVALID';
  case '1':
    return 'VALID';
  case '2':
    return 'TRADING';
  case '3':
    return 'SPENT';
  default:
    return '';
  }
}

export function tokenType (type) {
  switch (type) {
  case '0':
    return 'ETH';
  case '1':
    return 'DAI';
  default:
    return '';
  }
}

export function isSmartNote (value) {
  switch (value) {
  case '0':
    return false;
  case '1':
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
