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
    contract: state => state.contract()
  }),
  methods: {
    mint() {
      this.contract.methods.setN(this.n).send({
        from: this.coinbase,
        gas: 100000
      })
      .on('transactionHash', (hash) => {
        console.log('hash', hash)
        this.n++;
      })
      .on('receipt', (receipt) => {
        console.log(receipt)
      })
      .on('confirmation', (confirmationNumber, receipt) => {
        console.log(confirmationNumber, receipt)
      })
      .on('error', console.error);
      // this.contract.setN(this.n, {
      //   gas: 300000,
      //   from: this.coinbase
      // }, (err, result) => {
      //   // hash
      //   console.log('result', result);
      
      // });
    }
  },
}
</script>
