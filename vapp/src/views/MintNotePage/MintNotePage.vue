<template>
  <div>
    <el-button
      @click="mint">
      mint
    </el-button>
    {{ n }}
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  data() {
    return {
      n: 0
    }
  },
  computed: mapState({
    coinbase: state => state.web3.coinbase,
    web3: state => state.web3.web3Instance,
    contract: state => state.contractInstance()
  }),
  methods: {
    mint() {
      this.contract.setN(this.n, {
        gas: 300000,
        from: this.coinbase
      }, (err, result) => {
        // hash
        console.log('result', result);
        this.n++;
      });
    }
  },
}
</script>
