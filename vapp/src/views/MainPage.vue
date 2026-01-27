<template>
  <div>
    <div id="wrapper">
      <nav class="navbar" role="navigation" aria-label="main navigation">
        <div class="container columns" style="align-items: center; margin-bottom: 0;">
          <div class="column is-one-fifth" style="text-align: center;">
            <a class="logo" @click="goToLogin">
              <img src="/zk-dex.png" alt="ZK-DEX">
            </a>
          </div>
          <div class="column" style="display: flex; align-items: center;">
            <router-link class="navbar-item" to="/">Dashboard</router-link>
            <router-link class="navbar-item" to="/exchange">Exchange</router-link>
            <span style="flex: 1;"></span>
            <button class="button" @click="logout">Logout</button>
          </div>
        </div>
      </nav>
    </div>
    <router-view />
    <footer class="footer">
      <div class="content has-text-centered">
        <MetaMask />
        <ZkDexContract />
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAccountStore } from '@/stores/account'
import { useNoteStore } from '@/stores/note'
import { useOrderStore } from '@/stores/order'
import { useWeb3Store } from '@/stores/web3'
import { useContractStore } from '@/stores/contract'
import MetaMask from '@/components/MetaMask.vue'
import ZkDexContract from '@/components/ZkDexContract.vue'

const router = useRouter()
const accountStore = useAccountStore()
const noteStore = useNoteStore()
const orderStore = useOrderStore()
const web3Store = useWeb3Store()
const contractStore = useContractStore()

function goToLogin() {
  router.push('/login')
}

function logout() {
  accountStore.reset()
  noteStore.reset()
  orderStore.reset()
  web3Store.disconnect()
  contractStore.reset()
  router.push({ path: '/login' })
}
</script>

<style scoped>
.navbar {
  z-index: 10;
}
.logo {
  cursor: pointer;
}
.logo img {
  max-height: 2.5rem;
  max-width: 150px;
}
@media (max-width: 1088px) {
  .logo img {
    max-height: 3rem;
    max-width: 120px;
  }
}
@media (min-width: 1088px) {
  .navbar {
    padding: 1rem 0;
  }
}
</style>
