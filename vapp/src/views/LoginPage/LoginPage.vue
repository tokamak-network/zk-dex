<template>
  <div style="text-align: center;">
    <h1>ZK-DEX</h1>
    <div>
      <meta-mask />
    </div>
    <div>
      <el-input placeholder="Please your viewing key"
        style="width: 50%;"
        v-model="viewingKey"
        show-password>
      </el-input>
    </div>
     <p>viewingKey: {{ viewingKey }}</p>
     <p>secretKey: {{ `${coinbase}${viewingKey}` }}</p>
    <div>
      <el-button
        v-bind:disabled="viewingKey === '' || !isInjected"
        @click="moveToMainPage">
      SIGN IN
      </el-button>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import MetaMask from '../../components/MetaMask';

export default {
  components: {
    MetaMask,
  },
  data() {
    return {
      viewingKey: ''
    }
  },
  computed: mapState({
    isInjected: state => state.web3.isInjected,
    coinbase: state => state.web3.coinbase
  }),
  methods: {
    ...mapActions([
      'setViewingKey',
      'setSecretKey'
    ]),
    moveToMainPage() {
      this.setViewingKey(this.viewingKey)
      this.setSecretKey(`${this.coinbase}${this.viewingKey}`)
      this.$router.push({ path: '/main' })
    }
  },
}
</script>

<style scoped>
</style>
