<template>
  <div style="text-align: center; margin-top: 120px">
    <h1>ZK-DEX</h1>
      <zk-dex-contract />
      <div
        style="height: 10px;">
      </div>
      <meta-mask />
    <div>
      <el-input placeholder="Enter your viewing key"
        style="width: 50%;"
        v-model="viewingKey"
        show-password>
      </el-input>
    </div>
     <p>viewingKey: {{ viewingKey }}</p>
     <p>secretKey: {{ `${coinbase}${viewingKey}` }}</p>
    <div>
      <el-button
        style="margin-top: 20px;"
        v-bind:disabled="viewingKey === '' || !isInjected"
        @click="moveToMainPage">
        START
      </el-button>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import MetaMask from '../../components/MetaMask';
import ZkDexContract from '../../components/ZkDexContract';
import util from '../../services/web3/util'
import Web3Utils from 'web3-utils'

export default {
  components: {
    MetaMask,
    ZkDexContract
  },
  data() {
    return {
      viewingKey: ''
    }
  },
  computed: mapState({
    isInjected: state => state.web3.isInjected,
    coinbase: state => state.web3.coinbase,
    wallet: state => state.wallet
  }),
  methods: {
    ...mapActions([
      'setViewingKey',
      'setSecretKey'
    ]),
    moveToMainPage() {
      this.setViewingKey(this.viewingKey)
      this.setSecretKey(`${this.coinbase}${this.viewingKey}`)

      // const vk = a + util.unmarshal(web3.utils.fromAscii('vitalik'));
      const vk = this.coinbase + util.unmarshal(Web3Utils.fromAscii('vitalik'))
      this.wallet.setVk(this.coinbase, vk)
      const salt = Web3Utils.randomHex(32);

      this.$router.push({ path: '/main' })
    },
    test() {
    }
  },
}
</script>

<style scoped>
</style>
