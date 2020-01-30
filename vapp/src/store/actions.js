export default {
  setWeb3 ({ commit }, web3) {
    commit('SET_WEB3', web3);
  },
  setDexContract ({ commit }, contract) {
    commit('SET_DEX_CONTRACT', contract);
  },
  setDaiContract ({ commit }, contract) {
    commit('SET_DAI_CONTRACT', contract);
  },

  setOrders ({ commit }, orders) {
    commit('SET_ORDERS', orders);
  },

  SET_USER_KEY: (state, key) => {
    state.userKey = key;
  },
  SET_METAMASK_ACCOUNT: (state, account) => {
    state.metamaskAccount = account;
  },
  SET_VKS: (state, vks) => {
    state.vks = vks;
  },
  SET_ACCOUNTS: (state, accounts) => {
    state.accounts = accounts;
  },
  SET_NOTE_TRANSFER_HISTORIES: (state, histories) => {
    state.histories = histories;
  },
};
