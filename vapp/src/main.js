import getWeb3 from './services/web3/getWeb3';
import 'element-ui/lib/theme-chalk/index.css';
import ElementUI from 'element-ui';

getWeb3().then(() => {
  const Vue = require('vue').default;
  const App = require('./App.vue').default;
  const router = require('./router').default;
  const store = require('./store').default;

  Vue.use(ElementUI);

  new Vue({
    el: '#app',
    router,
    store,
    render: h => h(App),
  });
});
