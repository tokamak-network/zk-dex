const state = {
  secretKey: null,
  viewingKey: null,
  order: null,
  note: null,
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