import store from '../../store/index.js';

const pollingWeb3 = function (web3) {
  setInterval(async () => {
    if (web3 && store.state.web3.web3Instance) {
      const accounts = await web3.eth.getAccounts()
      const account = accounts[0]
      if (account !== store.state.web3.coinbase) {
        let newCoinbase = account
        const newBalance = await web3.eth.getBalance(newCoinbase)
        store.dispatch('pollingWeb3', {
          coinbase: newCoinbase,
          balance: newBalance
        })
      } else {
        const polledBalance = await web3.eth.getBalance(store.state.web3.coinbase)
        if (polledBalance !== store.state.web3.balance) {
          store.dispatch('pollingWeb3', {
            coinbase: store.state.web3.coinbase,
            balance: polledBalance
          })
        }
      }
    }
  }, 500)
}

export default pollingWeb3