const state = {
  web3: null,
  viewingKey: '0x1234',
  metamaskAccount: null,
  key: null,
  dexContract: null,
  daiContract: null,
};

const mutations = {
  SET_METAMASK_ACCOUNT: (state, account) => {
    state.metamaskAccount = account;
    state.key = account; // Note: use matamask account as key.
  },
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
  setMetamaskAccount ({ commit }, account) {
    commit('SET_METAMASK_ACCOUNT', account);
  },
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
