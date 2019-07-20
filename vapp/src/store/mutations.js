import pollWeb3 from '../utils/pollWeb3'

export default {
  SET_VIEWING_KEY: (state, key) => {
    state.viewingKey = key
  },
  SET_SECRET_KEY: (state, key) => {
    state.secretKey = key
  },

  REGISTER_WEB3 (state, payload) {
    let result = payload
    let web3Copy = state.web3
    web3Copy.coinbase = result.coinbase
    web3Copy.networkId = result.networkId
    web3Copy.balance = result.balance
    web3Copy.isInjected = result.injectedWeb3
    web3Copy.web3Instance = result.web3
    state.web3 = web3Copy;
    pollWeb3();
  },
  POLL_WEB3 (state, payload) {
    state.web3.coinbase = payload.coinbase
    state.web3.balance = payload.balance
  },
  REGISTER_CONTRACT (state, payload) {
    state.contractInstance = () => payload
  }
}
