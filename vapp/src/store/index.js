import Vue from 'vue';
import Vuex from 'vuex';
Vue.use(Vuex);

import api from '../api/index';
import { BN } from 'web3-utils';
import { toNoteHash } from '../filters/index';

import { ZkDexAddress } from 'zk-dex-keystore/lib/Account';
import { removeZkPrefix } from 'zk-dex-keystore/lib/utils';

import { Note } from '../../../scripts/lib/Note';

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
  SET_HISTORIES: (state, histories) => {
    state.histories = histories;
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
  setHistories ({ commit }, histories) {
    commit('SET_HISTORIES', histories);
  },
  async set (context, requests = []) {
    const dexContract = context.state.dexContract;
    const userKey = context.state.userKey;

    const getAccounts = async () => {
      const accounts = await api.getAccounts(userKey);
      if (accounts) context.dispatch('setAccounts', accounts);
    };
    const getNotes = async () => {
      const getNoteState = async (note) => {
        const noteHash = toNoteHash(note);
        const state = await dexContract.notes(noteHash);
        return state;
      };

      const notes = await api.getNotes(userKey);
      if (notes) {
        const notesWithState = notes.map(async (note) => {
          const state = await getNoteState(note);

          Object.defineProperty(note, 'state', {
            value: state,
          });

          return note;
        });
        context.dispatch('setNotes', await Promise.all(notesWithState));
      }
    };
    const getOrders = async () => {
      const orders = await api.getOrders();
      if (orders) context.dispatch('setOrders', orders);
    };
    const getOrdersByUser = async () => {
      const ordersByUser = await api.getOrdersByUser(userKey);
      context.dispatch('setOrdersByUser', ordersByUser);
    };
    const getHistories = async () => {
      const histories = await api.getHistories(userKey);
      context.dispatch('setHistories', histories);
    };

    const funcs = {
      accounts: getAccounts,
      notes: getNotes,
      orders: getOrders,
      ordersByUser: getOrdersByUser,
      histories: getHistories,
    };

    requests.map(async request => await funcs[request]());
  },
};

const getters = {
  numNotes: state => state.notes.length,
  orderBook: (state) => {
    const orderBook = [];
    state.orders.map((order) => {
      const found = orderBook.find(o => o.price === order.price);
      if (order.state !== '0') return;
      if (found) {
        found.orders.push(order);
        found.numOrders++;
      } else {
        orderBook.push({
          orders: [order],
          numOrders: 1,
          price: order.price,
        });
      }
    });
    return orderBook;
  },
  smartNotes: (state) => {
    const smartNotes = state.notes.filter((n) => {
      const note = new Note(...Object.values(n));
      return note.isSmart();
    });
    return smartNotes;
  },
  ongoingOrders: state => state.ordersByUser.filter(o => o.state !== '2'),
  settledOrders: state => state.ordersByUser.filter(o => o.state === '2'),
  balanceOfNotes: (state) => {
    const balanceOfNotes = [
      {
        name: 'Ethereum',
        symbol: 'ETH',
        numNotes: 0,
        totalBalance: new BN('0'),
      },
      {
        name: 'Dai',
        symbol: 'DAI',
        numNotes: 0,
        totalBalance: new BN('0'),
      },
    ];
    state.notes.map((note) => {
      if (note.state.toNumber() === 1) {
        if (parseInt(note.token) === 0) {
          balanceOfNotes[0].numNotes += 1;
          // TODO: use BN.
          balanceOfNotes[0].totalBalance = balanceOfNotes[0].totalBalance.add(new BN(parseInt(note.value)));
        } else if (parseInt(note.token) === 1) {
          balanceOfNotes[1].numNotes += 1;
          balanceOfNotes[1].totalBalance = balanceOfNotes[1].totalBalance.add(new BN(parseInt(note.value)));
        }
      }
    });
    return balanceOfNotes;
  },
};

export default new Vuex.Store({
  state,
  mutations,
  actions,
  getters,
});
