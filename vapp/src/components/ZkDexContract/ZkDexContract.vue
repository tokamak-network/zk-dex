<template>
  <div>
    <div>
      <p>ZkDex address: {{ address }}</p>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import { Wallet } from '../../../../scripts/lib/Wallet'

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
    this.dexContract.deployed()
      .then(dexContractInstance => {
        this.address = dexContractInstance.address; // view
        this.setDexContractInstance(dexContractInstance); // action

        return dexContractInstance.dai();
      })
      .then(daiAddress => {
        return this.daiContract.at(daiAddress);
      })
      .then(daiContractInstance => {
        this.setDaiContractInstance(daiContractInstance); // action
      });
  },
  computed: mapState({
    coinbase: state => state.web3.coinbase,
    viewingKey: state => state.viewingKey,
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