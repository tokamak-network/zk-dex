<template>
  <div 
    v-loading="loading"
    style="height: 100%; text-align: center;"
  >
    <div>
      <el-button
        @click="makeProof">
        make proof
      </el-button>
    </div>
    <p>proof: {{ proof }}</p>
    <div>
      <el-button
        @click="mintNote">
        mint note
      </el-button>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { fetchProof } from '../../api/index';

export default {
  data() {
    return {
      n: 0,
      loading: false,
      proof: ''
    }
  },
  computed: mapState({
    coinbase: state => state.web3.coinbase,
    web3: state => state.web3.web3Instance,
    contract: state => state.contract(),
    order: state => state.order,
    note: state => state.note
  }),
  methods: {
    makeProof() {
      this.loading = true
      fetchProof()
        .then(
          proof => {
            this.loading = false
            this.proof = JSON.stringify(proof.data.proof, null, 2)
          }
        )
        .catch()
    },
    mintNote() {
      this.contract.methods.setN(this.n).send({
        from: this.coinbase,
        gasPrice: '1000',
        gas: 300000
      })
      .on('transactionHash', (hash) => {
        console.log('hash', hash)
        this.n++;
      })
      .on('receipt', (receipt) => {
      })
      .on('confirmation', (confirmationNumber, receipt) => {
      })
      .on('error', console.error)
    },
  },
  created () {
    console.log('order', this.order, 'note', this.note);
  },
}
</script>
