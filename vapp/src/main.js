import Vue from 'vue';
import App from './App.vue';
import router from './router/index.js';
import store from './store/index.js';
import Buefy from 'buefy'
import 'buefy/dist/buefy.css'

Vue.config.productionTip = false;

Vue.use(Buefy);

new Vue({
  el: '#app',
  router,
  store,
  render: h => h(App)
});
