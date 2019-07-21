<template>
  <div>
    <div>
      <p>ZkDex address: {{ address }}</p>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import Wallet from '../../services/web3/Wallet'

export default {
  data() {
    return {
      address: null
    }
  },
  beforeCreate () {
    this.$store.dispatch('setContract')
  },
  created () {
    this.dexContract.deployed().then(dexContractInstance => {
      this.setDexContractInstance(dexContractInstance)
      this.address = dexContractInstance.address
      
      const wallet = new Wallet()
      wallet.init(this.dexContract, dexContractInstance.address)
      this.setWallet(wallet)

      dexContractInstance.dai().then(daiAddress => {
        this.daiContract.at(daiAddress).then(daiContractInstance => {
          this.setDaiContractInstance(daiContractInstance)
        })
      })
    })
  },
  computed: mapState({
    dexContract: state => state.dexContract,
    daiContract: state => state.daiContract
  }),
  methods: {
    ...mapActions([
      'setDexContractInstance',
      'setDaiContractInstance',
      'setWallet'
    ]),
  },
}
</script>

<style scoped>

</style>