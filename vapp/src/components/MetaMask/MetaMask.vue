<template>
  <div>
    <p>Network: {{ network }}</p>
    <p>Account: {{ coinbase }}</p>
    <p>Balance: {{ balance }} wei</p>
  </div>
</template>

<script>
import { NETWORKS } from '../../services/web3/constants/networks'
import { mapState } from 'vuex'

export default {
  name: 'metamask',
  computed: mapState({
    isInjected: state => state.web3.isInjected,
    network: state => NETWORKS[state.web3.networkId],
    coinbase: state => state.web3.coinbase,
    balance: state => state.web3.balance,
  }),
  beforeCreate () {
    this.$store.dispatch('registerWeb3')
  }
}
</script>

<style scoped>

</style>