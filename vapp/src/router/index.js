import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

import LoginPage from '../views/LoginPage'
import MainPage from '../views/MainPage'
import MintNotePage from '../views/MintNotePage'
import MakeOrderPage from '../views/MakeOrderPage'
import TakeOrderPage from '../views/TakeOrderPage'
import SettleOrderPage from '../views/SettleOrderPage'

const routes = [
  {
    path: '/',
    component: LoginPage
  },
  {
    path: '/main',
    component: MainPage
  },
  {
    path: '/mint',
    component: MintNotePage
  },
  {
    path: '/make',
    component: MakeOrderPage
  },
  {
    path: '/take',
    component: TakeOrderPage
  },
  {
    path: '/settle',
    component: SettleOrderPage
  }
]

const createRouter = () => new Router({
  scrollBehavior: () => ({ y: 0 }),
  routes
})

const router = createRouter()

export default router
