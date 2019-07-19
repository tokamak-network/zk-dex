<template>
  <div>
    <el-button
      @click="mint">
      mint
    </el-button>
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  computed: mapState({
    coinbase: state => state.web3.coinbase,
    web3: state => state.web3.web3Instance,
    contract: state => state.contractInstance()
  }),
  methods: {
    mint() {
      this.contract.bet(10, {
        gas: 300000,
        value: 100,
        from: this.coinbase
      }, (err, result) => {
        let Won = this.contract.Won()
        Won.watch((err, result) => {
          this.winEvent = result.args
          this.winEvent._amount = parseInt(result.args._amount, 10)
          this.pending = false
        })
      });
    }
  },
}
</script>
