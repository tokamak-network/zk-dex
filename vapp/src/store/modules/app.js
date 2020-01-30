const state = {
  web3: {},
  dexContract: {},
  daiContract: {},
};

const mutations = {
  SET_WEB3: (state, web3) => {
    state.web3 = web3;
  },
  SET_DEX_CONTRACT: (state, contract) => {
    state.dexContract = contract;
  },
  SET_DAI_CONTRACT: (state, contract) => {
    state.daiContract = contract;
  },
};

const actions = {
  setWeb3 ({ commit }, web3) {
    commit('SET_WEB3', web3);
  },
  setDexContract ({ commit }, contract) {
    commit('SET_DEX_CONTRACT', contract);
  },
  setDaiContract ({ commit }, contract) {
    commit('SET_DAI_CONTRACT', contract);
  },
};

export default {
  state,
  mutations,
  actions,
};
