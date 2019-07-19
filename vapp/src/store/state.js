const state = {
  secretKey: null,
  viewingKey: null,
  web3: {
    isInjected: false,
    web3Instance: null,
    networkId: null,
    coinbase: '',
    balance: null,
    error: null
  },
  contractInstance: null
}

export default state