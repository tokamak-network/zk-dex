import Web3 from 'web3'
import store from '../store/index.js';

const pollWeb3 = function () {
  let web3 = window.web3
  web3 = new Web3(web3.currentProvider)

  setInterval(() => {
    if (web3 && store.state.web3.web3Instance) {
      if (web3.eth.coinbase !== store.state.web3.coinbase) {
        let newCoinbase = web3.eth.coinbase
        web3.eth.getBalance(web3.eth.coinbase, function (err, newBalance) {
          if (err) {
            err;
          } else {
            store.dispatch('POLL_WEB3', {
              coinbase: newCoinbase,
              balance: newBalance.toNumber()
            })
          }
        })
      } else {
        web3.eth.getBalance(store.state.web3.coinbase, (err, polledBalance) => {
          if (err) {
            err;
          } else if (polledBalance.toNumber() !== store.state.web3.balance) {
            store.dispatch('POLL_WEB3', {
              coinbase: store.state.web3.coinbase,
              balance: polledBalance.toNumber()
            })
          }
        })
      }
    }
  }, 500)
}

export default pollWeb3