const state = {
  userKey: '',
  metamaskAccount: '',
  vks: [],
  accounts: [],
  histories: [], // note transfer history
};

const mutations = {
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

const actions = {
  setAccount ({ commit }, account) {
    commit('SET_USER_KEY', account);
    commit('SET_METAMASK_ACCOUNT', account); // TODO: metamask account -> account that only sign transaction.
  },
  setVks ({ commit }, vks) {
    commit('SET_VKS', vks);
  },
  setAccounts ({ commit }, accounts) {
    commit('SET_ACCOUNTS', accounts);
  },
  setNoteTransferHistories ({ commit }, histories) {
    commit('SET_NOTE_TRANSFER_HISTORIES', histories);
  },
};

export default {
  state,
  mutations,
  actions,
};
