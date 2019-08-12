import Vue from 'vue';
import Router from 'vue-router';
import store from '../store/index';

Vue.use(Router);

import LoginPage from '../views/LoginPage.vue';
import MainPage from '../views/MainPage.vue';
import WalletPage from '../views/WalletPage.vue';
import MarketPage from '../views/MarketPage.vue';
import MintNotePage from '../views/MintNotePage.vue';

const routes = [
  {
    path: '/login',
    component: LoginPage,
  },
  {
    path: '/',
    component: MainPage,
    children: [
      {
        path: 'wallet',
        component: WalletPage,
      },
      {
        path: 'market',
        component: MarketPage,
      },
      {
        path: 'mint',
        component: MintNotePage,
      },
    ],
  },
];

const createRouter = () =>
  new Router({
    scrollBehavior: () => ({
      y: 0,
    }),
    routes,
  });

const router = createRouter();

// router.beforeResolve((to, _, next) => {
//   const isListening = store.state.web3.isListening;
//   if (typeof isListening === 'undefined' || !isListening) {
//     if (to.path !== '/access') {
//       next('/access');
//     }
//   }
//   // store.dispatch('setLastPath', to.path);
//   next();
// });

export default router;
