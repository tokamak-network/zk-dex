import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);
// NOTE:
// state의 변수의 변경은 반드시 mutations의 구현한 함수에 의해서만 변경시킬 수 있다. 
// action에서 mutation의 함수를 호출하고 mutation이 state를 변경시킨다.

export default new Vuex.Store({
  state: {
    orders: [
      {
        id: 1,
        price: 100,
        type: 'sell',
        date: '2016-10-15 13:43:27'
      },
      {
        id: 2,
        price: 200,
        type: 'buy',
        date: '2016-10-15 13:43:27'
      },
      {
        id: 3,
        price: 300,
        type: 'sell',
        date: '2016-10-15 13:43:27'
      },
      {
        id: 4,
        price: 400,
        type: 'buy',
        date: '2016-10-15 13:43:27'
      },
      {
        id: 5,
        price: 500,
        type: 'buy',
        date: '2016-10-15 13:43:27'
      },
      {
        id: 6,
        price: 600,
        type: 'buy',
        date: '2016-10-15 13:43:27'
      }
    ],
    selectedOrder: {},
    selectedNote: {}
  },
  mutations: {
    setSelectedOrder (state, order) {
      state.selectedOrder = order;     
    },
    setSelectedNote (state, note) {
      state.selectedNote = note;     
    },
    addOrder (state, order) {
      state.orders.push(order);
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
    }
  }
});