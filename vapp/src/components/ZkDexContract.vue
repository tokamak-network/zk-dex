<template>
  <div>
    <div>
      <p style="margin-top: 12px;">DAI Amount: {{ daiAmount }} dai </p>
      <p style="margin-top: 12px;">ZkDex address: {{ address }}</p>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions, mapMutations } from 'vuex';
import Web3Utils from 'web3-utils';

export default {
  data () {
    return {
      address: null,
    };
  },
  beforeCreate () {
    this.$store.dispatch('setContract');
  },
  created () {
    this.dexContract
      .deployed()
      .then((dexContractInstance) => {
        this.address = dexContractInstance.address;
        this.setDexContractInstance(dexContractInstance);

        return dexContractInstance.dai();
      })
      .then(daiAddress => this.daiContract.at(daiAddress))
      .then((daiContractInstance) => {
        this.setDaiContractInstance(daiContractInstance);
        this.updateDaiAmount();
      });
  },
  computed: mapState({
    coinbase: state => state.web3.coinbase,
    viewingKey: state => state.viewingKey,
    dexContract: state => state.dexContract,
    daiContract: state => state.daiContract,
    daiContractInstance: state => state.daiContractInstance,
    daiAmount: state => state.daiAmount,
  }),
  methods: {
    ...mapActions([
      'setDexContractInstance',
      'setDaiContractInstance',
    ]),
    async updateDaiAmount () {
      const daiAmount = await this.daiContractInstance.balanceOf(this.coinbase);
      this.$store.dispatch('setDaiAmount', {
        daiAmount,
      });
    },
  },
};
</script>

<style scoped></style>
