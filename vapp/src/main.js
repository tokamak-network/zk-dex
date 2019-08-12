import Vue from 'vue';

import App from './App.vue';
import router from './router';
import store from './store';

import Buefy from 'buefy';

import * as filters from './filters';

Vue.use(Buefy);

// register global utility filters
Object.keys(filters).forEach((key) => {
  Vue.filter(key, filters[key]);
});

new Vue({
  el: '#app',
  router,
  store,
  render: h => h(App),
});
