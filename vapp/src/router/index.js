import Vue from 'vue';
import Router from 'vue-router';
import store from '../store/index';

Vue.use(Router);

import LoginPage from '../views/LoginPage.vue';
import MainPage from '../views/MainPage.vue';
import DashboardPage from '../views/DashboardPage.vue';
import DashboardSummaryPage from '../views/DashboardSummaryPage.vue';
import ExchangePage from '../views/ExchangePage.vue';
import NotePage from '../views/NotePage.vue';
import NoteTransferPage from '../views/NoteTransferPage.vue';
import NoteWalletPage from '../views/NoteWalletPage.vue';
import NoteCombinePage from '../views/NoteCombinePage.vue';
import HistoryNoteTransferPage from '../views/HistoryNoteTransferPage.vue';
import HistoryOrderPage from '../views/HistoryOrderPage.vue';
import AccountImportPage from '../views/AccountImportPage.vue';
import AccountExportPage from '../views/AccountExportPage.vue';
import AccountDeletePage from '../views/AccountDeletePage.vue';

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
        path: '',
        component: DashboardPage,
        children: [
          {
            path: '',
            component: DashboardSummaryPage,
          },
          {
            path: 'notes',
            component: NotePage,
          },
          {
            path: 'transfer',
            component: NoteTransferPage,
          },
          {
            path: 'wallet',
            component: NoteWalletPage,
          },
          {
            path: 'combine',
            component: NoteCombinePage,
          },
          {
            path: 'notes/transfer',
            component: HistoryNoteTransferPage,
          },
          {
            path: 'orders',
            component: HistoryOrderPage,
          },
          {
            path: 'accounts/import',
            component: AccountImportPage,
          },
          {
            path: 'accounts/export',
            component: AccountExportPage,
          },
          {
            path: 'accounts/delete',
            component: AccountDeletePage,
          },
        ],
      },
      {
        path: 'exchange',
        component: ExchangePage,
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
