import Vue from 'vue';
import Router from 'vue-router';

import OrderBook from '../components/OrderBook.vue';
import CreateOrder from '../components/CreateOrder.vue';
import MakeOrder from '../components/MakeOrder.vue';
import SettleOrder from '../components/SettleOrder.vue';

Vue.use(Router);

export default new Router({
  routes:[
    {
      path: '/',
      component: OrderBook
    },
    {
      path: '/make',
      component: MakeOrder
    },
    {
      path: '/create',
      component: CreateOrder
    },
    {
      path: '/settle',
      component: SettleOrder
    }
  ]
})
