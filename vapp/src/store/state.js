const state = {
  account: null,
  dexContract: null,
  daiContract: null,
  dexContractInstance: null,
  daiContractInstance: null,
  key: null,
  viewingKey: null,
  order: null,
  note: null,
  myNotes: null,
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

  accounts: null,
  notes: null,
  transferNotes: null,
  orders: null,
  orderHistory: null,
};

export default state;
