const state = {
  orders: [],
};

const mutations = {
  SET_ORDERS: (state, orders) => {
    state.orders = orders;
  },
};

const actions = {
  setOrders ({ commit }, orders) {
    commit('SET_ORDERS', orders);
  },
};

export default {
  state,
  mutations,
  actions,
};
