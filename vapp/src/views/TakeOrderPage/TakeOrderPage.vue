{<template>
  <div
    v-loading="loading"
    style="height: 100%; text-align: center; margin-top: 150px;"
  >
    <div>
      <el-button
        @click="generateProof">
        generate proof
      </el-button>
    </div>
    <div>
      <p>proof: {{ proof }}</p>
      <p>maker note hash: 4a44dc15364204a80fe80e9039455cc1608281820fe2b24f1e5233ade6af1dd5</p>
      <p>taker note value: {{ 10 }} </p>
      <p>target token: dai</p>
    </div>
    <div>
      <el-button
        v-bind:disabled="proof === ''"
        @click="takeOrder">
        take order
      </el-button>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { Note, constants } from '../../../../scripts/lib/Note'
import Web3Utils from 'web3-utils'
import dockerUtils from '../../../../scripts/lib/dockerUtils'

export default {
  data() {
    return {
      price: '',
      loading: false,
      proof: ''
    }
  },
  computed: mapState({
    myNotes: state => state.myNotes,
    viewingKey: state => state.viewingKey,
    secretKey: state => state.secretKey,
    dex: state => state.dexContractInstance,

    web3: state => state.web3.web3Instance,
    coinbase: state => state.web3.coinbase
  }),
  methods: {
    makeStakeNote() {
      const makerNote = {} // note to take
      const takeNote = {} // note to be taken

      const salt = Web3Utils.randomHex(16)
      const stakeNote = new Note(makerNote.hash(), takerNote.value, constants.ETH_TOKEN_TYPE, this.viewingKey, salt, true)

      return stakeNote
    },
    generateProof() {
      this.loading = true
      
      const stakeNote = makeStakeNote()
      dockerUtils.getTakeOrderProof(makerNote, takerNote, stakeNote)
        .then(p => {
          this.proof = p
          this.loading = false
        })
    },
    takeOrder() {
      const order = {}
      this.dex.takeOrder(order.id, ...this.proof, stakeNote.encrypt()) // promise
    }
  },
}
</script>
}