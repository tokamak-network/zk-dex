import Vue from 'vue';

import App from './App.vue';
import router from './router';
import store from './store';

import VueApexCharts from 'vue-apexcharts';

import * as filters from './filters';

// Global event bus
Vue.prototype.$bus = new Vue();

Vue.component('apexchart', VueApexCharts);

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
