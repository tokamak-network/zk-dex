import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

import LoginPage from '@/views/LoginPage.vue'
import MainPage from '@/views/MainPage.vue'
import DashboardPage from '@/views/DashboardPage.vue'
import DashboardSummaryPage from '@/views/DashboardSummaryPage.vue'
import ExchangePage from '@/views/ExchangePage.vue'
import NotePage from '@/views/NotePage.vue'
import NoteTransferPage from '@/views/NoteTransferPage.vue'
import NoteWalletPage from '@/views/NoteWalletPage.vue'
import NoteCombinePage from '@/views/NoteCombinePage.vue'
import NoteConvertPage from '@/views/NoteConvertPage.vue'
import HistoryNoteTransferPage from '@/views/HistoryNoteTransferPage.vue'
import HistoryOrderPage from '@/views/HistoryOrderPage.vue'
import ZAccountsPage from '@/views/ZAccountsPage.vue'
import TimeLockPage from '@/views/TimeLockPage.vue'

const routes: RouteRecordRaw[] = [
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
            path: 'convert',
            component: NoteConvertPage,
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
            path: 'zaccounts',
            component: ZAccountsPage,
          },
          {
            path: 'timelock',
            component: TimeLockPage,
          },
        ],
      },
      {
        path: 'exchange',
        component: ExchangePage,
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Navigation guard removed - users can create ZK accounts in the dashboard
// MetaMask connection is handled in LoginPage

export default router
