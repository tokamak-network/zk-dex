const state = {
  accounts: [],
  // viewingKey: '0xb9f4b1b0a4c4996',
  viewingKey: '0xb9f4b1b0a4c4996',
};

const mutations = {
  ADD_ACCOUNT: (state, account) => {
    state.accounts.push(account);
  },
  SET_ACCOUNTS: (state, accounts) => {
    state.accounts = accounts;
  },
  DELETE_ACCOUNTS: (state) => {
    state.accounts = [];
  },
};

const actions = {
  addAccount ({ commit }, account) {
    commit('ADD_ACCOUNT', account);
  },
  setAccounts ({ commit }, accounts) {
    commit('SET_ACCOUNTS', accounts);
  },
  deleteAccounts ({ commit }, account) {
    commit('DELETE_ACCOUNTS', account);
  },
};

export default {
  state,
  mutations,
  actions,
};
