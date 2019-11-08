import Vue from 'vue';
import Vuex from 'vuex';

import actions from './actions';
import mutations from './mutations';
import getters from './getters';

import appModule from './modules/app';
import accountModule from './modules/accounts';
import noteModule from './modules/notes';
import orderModule from './modules/orders';

Vue.use(Vuex);

const store = new Vuex.Store({
  actions,
  mutations,
  getters,
  modules: {
    app: appModule,
    account: accountModule, // TODO: change account to account`s`
    note: noteModule,
    order: orderModule,
  },
});

export default store;
