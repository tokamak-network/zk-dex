const state = {
  account: null,
  accounts: [],
  dexContract: null,
  daiContract: null,
  dexContractInstance: null,
  daiContractInstance: null,
  key: null,
  viewingKey: null,
  order: null,
  orders: [],
  note: null,
  myNotes: [],
  web3: {
    isListening: false,
    web3Instance: null,
    networkId: null,
    account: '',
    balance: null,
    error: null,
  },
  contract: null,
  path: '/dashboard',
};

export default state;
