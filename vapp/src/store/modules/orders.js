import Vue from 'vue';

const state = {
  orders: [],
};

const mutations = {
  ADD_ORDER: (state, order) => {
    state.orders.push(order);
  },
  SET_ORDERS: (state, orders) => {
    state.orders = orders;
  },
  DELETE_ORDERS: (state) => {
    state.orders = [];
  },
  UPDATE_ORDER: (state, order) => {
    const index = state.orders.map(o => o.orderId).indexOf(order.orderId);
    Vue.set(state.orders, index, order);
  },
};

const actions = {
  addOrder ({ commit }, order) {
    commit('ADD_ORDER', order);
  },
  setOrders ({ commit }, orders) {
    commit('SET_ORDERS', orders);
  },
  deleteOrders ({ commit }, orders) {
    commit('DELETE_ORDERS', orders);
  },
  updateOrder ({ commit }, order) {
    commit('UPDATE_ORDER', order);
  },
};

export default {
  state,
  mutations,
  actions,
};
