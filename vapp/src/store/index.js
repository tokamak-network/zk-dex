import Vue from 'vue';
import Vuex from 'vuex';
import state from './state'

import getWeb3 from '../util/getWeb3'
import getContract from '../util/getContract'
import pollWeb3 from '../util/pollWeb3'

Vue.use(Vuex);

export default new Vuex.Store({
  state,
  mutations: {
    setSelectedOrder (state, order) {
      state.selectedOrder = order;     
    },
    setSelectedNote (state, note) {
      state.selectedNote = note;     
    },
    addOrder (state, order) {
      state.orders.push(order);
    },
    registerWeb3Instance (state, payload) {
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
    pollWeb3Instance (state, payload) {
      state.web3.coinbase = payload.coinbase
      state.web3.balance = payload.balance
    },
    registerContractInstance (state, payload) {
      state.contractInstance = () => payload
    }
  },
  actions: {
    SET_SELECTED_ORDER(context, order) {
      context.commit('setSelectedOrder', order);
    },
    SET_SELECTED_NOTE(context, note) {
      context.commit('setSelectedNote', note);
    },
    ADD_ORDER(context, order) {
      context.commit('addOrder', order);
    },
    REGISTER_WEB3 ({commit}) {
      getWeb3.then(result => {
        commit('registerWeb3Instance', result)
      }).catch(() => {})
    },
    POLL_WEB3 ({commit}, payload) {
      commit('pollWeb3Instance', payload)
    },
    GET_CONTRACT_INSTANCE ({commit}) {
      getContract.then(result => {
        commit('registerContractInstance', result)
      }).catch(() => {})
    }
  }
});
