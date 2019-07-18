let state = {
  orders: [
    {
      id: 1,
      price: 100,
      orderId: '242412311',
      date: '2016-10-15 13:43:27'
    },
    {
      id: 2,
      price: 200,
      orderId: 'b123123uy',
      date: '2016-10-15 13:43:27'
    },
    {
      id: 3,
      price: 300,
      orderId: 'se1231231ll',
      date: '2016-10-15 13:43:27'
    },
    {
      id: 4,
      price: 400,
      orderId: 'bu545454y',
      date: '2016-10-15 13:43:27'
    },
    {
      id: 5,
      price: 500,
      orderId: 'b123123uy',
      date: '2016-10-15 13:43:27'
    },
    {
      id: 6,
      price: 600,
      orderId: 'b414241uy',
      date: '2016-10-15 13:43:27'
    }
  ],
  order: {},
  noteToMakeOrder: {},
  noteToTakeOrder: {},
  noteToSettleOrder: {},

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