// import getWeb3 from '../utils/getWeb3'
import getStorageContract from '../services/web3/getStorageContract'
import getWeb3 from '../services/web3/getWeb3'

export default {
  setViewingKey({ commit }, key) {
    commit('SET_VIEWING_KEY', key)
  },
  setSecretKey({ commit }, key) {
    commit('SET_SECRET_KEY', key)
  },

  async registerWeb3 ({commit}) {
    const web3 = await getWeb3()
    commit('REGISTER_WEB3', web3)
  },
  pollingWeb3 ({commit}, payload) {
    commit('POLL_WEB3', payload)
  },
  getContract ({commit}) {
    getStorageContract.then(result => {
      commit('REGISTER_CONTRACT', result)
    }).catch(() => {})
  }
}
