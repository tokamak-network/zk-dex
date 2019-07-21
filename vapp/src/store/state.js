const state = {
  dexContract: null,
  daiContract: null,
  dexContractInstance: null,
  daiContractInstance: null,
  secretKey: null,
  viewingKey: null,
  order: null,
  orders: [],
  note: null,
  myNotes: [],
  web3: {
    isInjected: false,
    web3Instance: null,
    networkId: null,
    coinbase: '',
    balance: null,
    error: null
  },
  contract: null
}

export default state