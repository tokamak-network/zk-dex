import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAccountStore } from '@/stores/account'

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
import AccountImportPage from '@/views/AccountImportPage.vue'
import AccountExportPage from '@/views/AccountExportPage.vue'
import AccountDeletePage from '@/views/AccountDeletePage.vue'

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
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeResolve((to, _from, next) => {
  const accountStore = useAccountStore()
  if (!accountStore.key && to.path !== '/login') {
    next({ path: '/login' })
  } else {
    next()
  }
})

export default router
