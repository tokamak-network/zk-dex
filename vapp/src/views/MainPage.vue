<template>
  <div>
    <div id="wrapper">
      <nav class="navbar" role="navigation" aria-label="main navigation">
        <div class="container">
          <div class="navbar-brand">
            <a class="navbar-item logo" @click="$router.push('/login')">
              <img src="../../public/zk-dex.png">
            </a>
          </div>
          <div class="navbar-start" style="margin-left: 20px;">
            <router-link class="navbar-item" to="/">Dashboard</router-link>
            <router-link class="navbar-item" to="/exchange">Exchange</router-link>
          </div>
          <div class="navbar-end">
            <div class="navbar-item">
              <div class="buttons">
                <button class="button" @click="logout">
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </div>
    <router-view />
    <footer class="footer">
      <div class="content has-text-centered">
        <meta-mask />
        <zk-dex-contract />
      </div>
    </footer>
  </div>
</template>

<script>
import { mapState, mapMutations } from 'vuex';

import MetaMask from '../components/MetaMask.vue';
import ZkDexContract from '../components/ZkDexContract.vue';

export default {
  components: {
    MetaMask,
    ZkDexContract,
  },
  methods: {
    ...mapMutations(['MAKE_INITIAL_STATE']),
    logout () {
      this.MAKE_INITIAL_STATE();
      this.$router.push({ path: '/login' });
    },
  },
};
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
