<template>
  <div
    v-loading="loading"
    style="text-align: center;"
  >
    <div>
      <p>account: {{ coinbase }}</p>
      <p>token type: dai</p>
      <p>value: {{ value }}</p>
      <p>viewing key: {{ viewingKey }}</p>
      <p>salt: {{ salt }}</p>
      <p>proof: {{ proof }}</p>
      <div>
        <el-button
          @click="generateProof">
          generate proof
        </el-button>
      </div>
    </div>
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
import Web3Utils from 'web3-utils'
import dockerUtils from '../../../../scripts/lib/dockerUtils'
import { Note, constants } from '../../../../scripts/lib/Note'
import { Wallet } from '../../../../scripts/lib/Wallet'
import { error } from 'util';

const ether = (n) => Web3Utils.toBN(n).mul(Web3Utils.toBN(1e18.toString(10)));

const fs = require('fs');
const BN = require('bn.js');
const crypto = require('crypto');
const Docker = require('dockerode');
const SCALING_FACTOR = new BN('1000000000000000000');

export default {
  data() {
    return {
      loading: false,
      proof: '',
      value: null,
      salt: null,
      note: null,
      viewingKey: null
    }
  },
  computed: mapState({
    myNotes: state => state.myNotes,
    wallet: state => state.wallet,
    dex: state => state.dexContractInstance,
    dai: state => state.daiContractInstance,
    web3: state => state.web3.web3Instance,
    coinbase: state => state.web3.coinbase
  }),
  created () {
    this.value = ether(5)
    this.salt = Web3Utils.randomHex(16)
    this.viewingKey = this.wallet.getVk(this.coinbase)
    this.note 
      = new Note(this.coinbase, this.value, constants.DAI_TOKEN_TYPE, this.viewingKey, this.salt, false)
  },
  methods: {
    generateProof() {
      this.loading = true
      console.log(this.note)
      dockerUtils.getMintNBurnProof(this.note)
        .then(proof => {
          this.proof = proof
          this.loading = false
        })
        .catch(e => console.error(e))
        .finally(() => this.loading = false)
    },
    async mintNote() {
      await this.dai.approve(this.dex.address, this.value, { from: this.coinbase })

      const p = await dockerUtils.getMintNBurnProof(this.note)
      const mintTx = await this.dex.mint(...p, this.note.encrypt())
    }
  }
}
</script>
