import getWeb3 from '../utils/getWeb3'
import getContract from '../utils/getContract'

export default {
  setViewingKey({ commit }, key) {
    commit('SET_VIEWING_KEY', key)
  },
  setSecretKey({ commit }, key) {
    commit('SET_SECRET_KEY', key)
  },

  registerWeb3 ({commit}) {
    getWeb3.then(result => {
      commit('REGISTER_WEB3', result)
    }).catch(() => {})
  },
  pollWeb3 ({commit}, payload) {
    commit('POLL_WEB3', payload)
  },
  getContract ({commit}) {
    getContract.then(result => {
      commit('REGISTER_CONTRACT', result)
    }).catch(() => {})
  }
}
