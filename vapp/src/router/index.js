import Vue from 'vue';
import Router from 'vue-router';
// import store from '../store/index';

Vue.use(Router);

import DashboardLayout from '../layouts/DashboardLayout';
import ExchangeLayout from '../layouts/ExchangeLayout';
import SummaryLayout from '../layouts/SummaryLayout';
import AccountImportLayout from '../layouts/AccountImportLayout';
import AccountExportLayout from '../layouts/AccountExportLayout';
import AccountDeleteLayout from '../layouts/AccountDeleteLayout';
import WalletLayout from '../layouts/WalletLayout';
import NoteTransferLayout from '../layouts/NoteTransferLayout';
import NoteConvertLayout from '../layouts/NoteConvertLayout';
import NoteLiquidateLayout from '../layouts/NoteLiquidateLayout';
import NoteCombineLayout from '../layouts/NoteCombineLayout';
import NoteTransferHistoryLayout from '../layouts/NoteTransferHistoryLayout';
import OrderHistoryLayout from '../layouts/OrderHistoryLayout';

const routes = [
  {
    path: '/',
    component: DashboardLayout,
    children: [
      {
        path: '',
        component: SummaryLayout,
      },
      {
        path: 'accounts/import',
        component: AccountImportLayout,
      },
      {
        path: 'accounts/export',
        component: AccountExportLayout,
      },
      {
        path: 'accounts/delete',
        component: AccountDeleteLayout,
      },
      {
        path: 'wallet',
        component: WalletLayout,
      },
      {
        path: '/notes/transfer',
        component: NoteTransferLayout,
      },
      {
        path: '/notes/convert',
        component: NoteConvertLayout,
      },
      {
        path: '/notes/liquidate',
        component: NoteLiquidateLayout,
      },
      {
        path: 'notes/combine',
        component: NoteCombineLayout,
      },
      {
        path: 'notes/history',
        component: NoteTransferHistoryLayout,
      },
      {
        path: 'orders/history',
        component: OrderHistoryLayout,
      },
    ],
  },
  {
    path: '/exchange',
    component: ExchangeLayout,
  },
];
// const routes = [
//   {
//     path: '/login',
//     component: LoginPage,
//   },
//   {
//     path: '/',
//     component: ExchangeLayout,
//     children: [
//       {
//         path: '',
//         component: DashboardPage,
//         children: [
//           {
//             path: '',
//             component: DashboardSummaryPage,
//           },
//           {
//             path: 'notes',
//             component: NotePage,
//           },
//           {
//             path: 'transfer',
//             component: NoteTransferPage,
//           },
//           {
//             path: 'wallet',
//             component: NoteWalletPage,
//           },
//           {
//             path: 'combine',
//             component: NoteCombinePage,
//           },
//           {
//             path: 'convert',
//             component: NoteConvertPage,
//           },
//           {
//             path: 'notes/transfer',
//             component: HistoryNoteTransferPage,
//           },
//           {
//             path: 'orders',
//             component: HistoryOrderPage,
//           },
//           {
//             path: 'accounts/import',
//             component: AccountImportPage,
//           },
//           {
//             path: 'accounts/export',
//             component: AccountExportPage,
//           },
//           {
//             path: 'accounts/delete',
//             component: AccountDeletePage,
//           },
//         ],
//       },
//       {
//         path: 'exchange',
//         component: ExchangePage,
//       },
//     ],
//   },
// ];

const createRouter = () =>
  new Router({
    mode: 'history',
    // scrollBehavior: () => ({
    //   y: 0,
    // }),
    routes,
  });

const router = createRouter();

// router.beforeResolve((to, _, next) => {
//   const key = store.state.key;
//   if (key === null && to.path !== '/login') {
//     next({ path: '/login' });
//   } else {
//     next();
//   }
// });

export default router;
