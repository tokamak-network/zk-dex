import Vue from 'vue';
import Vuex from 'vuex';
Vue.use(Vuex);

const initialState = {

  /**
   * ENVIRONMENT
   */
  web3: {},
  dexContract: {},
  daiContract: {},

  /**
   * USER
   */
  userKey: '',
  metamaskAccount: '',
  vks: [],
  accounts: [],
  notes: [],
  histories: [], // note transfer history

  /**
   * ORDER
   */
  orders: [],
  ordersByUser: [],
};

const getInitialState = () => initialState;

const state = getInitialState();
const mutations = {
  SET_INITIAL_STATE: (state) => {
    const initialState = getInitialState();
    Object.keys(initialState).forEach((key) => {
      state[key] = initialState[key];
    });
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
  SET_NOTES: (state, notes) => {
    state.notes = notes;
  },
  SET_NOTE_TRANSFER_HISTORIES: (state, histories) => {
    state.histories = histories;
  },

  SET_ORDERS: (state, orders) => {
    state.orders = orders;
  },
  SET_ORDERS_BY_USER: (state, orders) => {
    state.ordersByUser = orders;
  },
};

const actions = {
  setInitialState ({ commit }) {
    commit('SET_INITIAL_STATE');
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

  setUserKey ({ commit }, account) {
    commit('SET_USER_KEY', account);
    commit('SET_METAMASK_ACCOUNT', account); // TODO: metamask account -> account that only sign transaction.
  },
  setVks ({ commit }, vks) {
    commit('SET_VKS', vks);
  },
  setAccounts ({ commit }, accounts) {
    commit('SET_ACCOUNTS', accounts);
  },
  setNotes ({ commit }, notes) {
    commit('SET_NOTES', notes);
  },
  setNoteTransferHistories ({ commit }, histories) {
    commit('SET_NOTE_TRANSFER_HISTORIES', histories);
  },

  setOrders ({ commit }, orders) {
    commit('SET_ORDERS', orders);
  },
  setOrdersByUser ({ commit }, orders) {
    commit('SET_ORDERS_BY_USER', orders);
  },
};
export default new Vuex.Store({
  state,
  mutations,
  actions,
});
