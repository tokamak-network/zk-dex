<template>
  <div>
    <div id="wrapper">
      <nav class="navbar" role="navigation" aria-label="main navigation">
        <div class="container">
          <div class="navbar-brand">
            <a class="navbar-item logo" @click="goToLogin">
              <img src="/zk-dex.png" alt="ZK-DEX">
            </a>
          </div>
          <div class="navbar-start" style="margin-left: 20px;">
            <router-link class="navbar-item" to="/">Dashboard</router-link>
            <router-link class="navbar-item" to="/exchange">Exchange</router-link>
          </div>
          <div class="navbar-end">
            <div class="navbar-item">
              <div class="buttons">
                <button class="button" @click="logout">Logout</button>
              </div>
            </div>
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
  // Reset all stores
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
@media all and (max-width: 1088px) {
  .logo {
    padding: 0;
  }
  .logo img {
    max-height: 3rem;
  }
}
@media all and (min-width: 1088px) {
  .navbar {
    padding: 1rem 0;
  }
  .logo {
    padding: 0 0 0 12px;
  }
  .logo img {
    max-height: 2.5rem;
  }
}
</style>
