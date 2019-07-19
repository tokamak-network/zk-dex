import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

import LoginPage from '../views/LoginPage'
import MainPage from '../views/MainPage'
import MintNotePage from '../views/MintNotePage'

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
  }
]

const createRouter = () => new Router({
  scrollBehavior: () => ({ y: 0 }),
  routes
})

const router = createRouter()

export default router
