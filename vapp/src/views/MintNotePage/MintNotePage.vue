<template>
  <div>
    <el-button
      @click="mintNBurn">
      mintNBurn
    </el-button>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import runGenProof from '../../../mintNote.js'

export default {
  // computed: mapState({
  //   coinbase: state => state.web3.coinbase,
  //   web3: state => state.web3.web3Instance,
  //   contract: state => state.contractInstance()
  // }),
  methods: {
    mintNBurn() {
        // console.log("Clicked MintNBurn!!");
        // TODO : get input data from web form
        runGenProof("1111111111111121111111111111111111111111111111111111111111111111",
                 "0",
                 "0",
                 "1111111111111111111111111111111111111111111111111111111111111111",
                 "0",
                 "0");
    }
  },
}
</script>
