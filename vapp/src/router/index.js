import Vue from 'vue';
import Router from 'vue-router';

import OrderBook from '../components/OrderBook.vue';
import OrderMaker from '../components/OrderMaker.vue';
import OrderTaker from '../components/OrderTaker.vue';
import OrderSettler from '../components/OrderSettler.vue';

Vue.use(Router);

export default new Router({
  routes:[
    {
      path: '/',
      component: OrderBook
    },
    {
      path: '/make',
      component: OrderMaker
    },
    {
      path: '/take',
      component: OrderTaker
    },
    {
      path: '/settle',
      component: OrderSettler
    }
  ]
})
