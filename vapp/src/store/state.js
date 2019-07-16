let state = {
  orders: [
    {
      id: 1,
      price: 100,
      type: 'sell',
      date: '2016-10-15 13:43:27'
    },
    {
      id: 2,
      price: 200,
      type: 'buy',
      date: '2016-10-15 13:43:27'
    },
    {
      id: 3,
      price: 300,
      type: 'sell',
      date: '2016-10-15 13:43:27'
    },
    {
      id: 4,
      price: 400,
      type: 'buy',
      date: '2016-10-15 13:43:27'
    },
    {
      id: 5,
      price: 500,
      type: 'buy',
      date: '2016-10-15 13:43:27'
    },
    {
      id: 6,
      price: 600,
      type: 'buy',
      date: '2016-10-15 13:43:27'
    }
  ],
  selectedOrder: {},
  selectedNote: {},
  web3: {
    isInjected: false,
    web3Instance: null,
    networkId: null,
    coinbase: null,
    balance: null,
    error: null
  },
  contractInstance: null
}

export default state