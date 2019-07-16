<template>
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
            <div style="height:40px; width:100%; clear:both;"></div>
            <div class="columns">
              <div class="column"></div>
              <div class="column">
                <div class="field">
                  <div class="control">
                    <input
                      class="input"
                      type="text"
                      placeholder="nickname"
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
    <router-view
      v-else
      style="margin-top: 60px;"
    ></router-view>
  </div>
</template>

<script>
export default {
  name: 'app',
  data() {
    return {
      isLogin: false,
      id: null
    }
  },
  created () {

  },
  methods: {
    login() {
      this.isLogin = true;
    }
  },
}
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
</style>
