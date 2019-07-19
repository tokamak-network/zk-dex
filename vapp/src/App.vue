<!-- <template>
  <div id="app">
    <div
      v-if="!isLogin"
    >
      <section class="hero is-fullheight">
        <div class="hero-body">
          <div class="container">
            <span style="font-size: 80px;">
              ZK-DEX
            </span>
            <div class="columns">
              <div class="column"></div>
              <div class="column">
                <div style="height:20px; width:100%; clear:both;"></div>
                <meta-mask />
                <div style="height:40px; width:100%; clear:both;"></div>
                <div class="field">
                  <div class="control">
                    <input
                      style="text-align: center;"
                      class="input"
                      type="password"
                      placeholder="password"
                      v-model="id"
                    >
                  </div>
                  <div style="height:20px; width:100%; clear:both;"></div>
                  <a
                    class="button"
                    @click="login"
                  >
                    <span>LOGIN</span>
                  </a>
                </div>
              </div>
              <div class="column"></div>
            </div>
          </div>
        </div>
      </section>
    </div>
    <div v-else>
      <router-view
        style="margin-top: 60px;"
      ></router-view>
    </div>
  </div>
</template> -->
<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<!-- <script> 
// import MetaMask from './components/MetaMask.vue';

// export default {
//   name: 'app',
//   components: {
//     MetaMask,
//   },
//   data() {
//     return {
//       isLogin: false,
//       id: null
//     }
//   },
//   beforeCreate () {
//     this.$store.dispatch('REGISTER_WEB3');
//   },
//   methods: {
//     login() {
//       this.isLogin = true;
//     }
//   },
// }
// </script>

// <style>
// #app {
//   font-family: 'Avenir', Helvetica, Arial, sans-serif;
//   -webkit-font-smoothing: antialiased;
//   -moz-osx-font-smoothing: grayscale;
//   text-align: center;
//   color: #2c3e50;
// }
// </style>

-->