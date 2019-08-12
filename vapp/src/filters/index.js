// eg. num | padLeft(32)
export { padLeft, hexToNumberString } from 'web3-utils';

// BN to number string
export function toNumberString (value) {
  return value.toString();
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

export function tokenType (value) {
  switch (value) {
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
