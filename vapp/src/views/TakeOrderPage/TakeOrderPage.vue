<template>
  <div v-loading="loading" style="height: 100%; text-align: center; margin-top: 150px;">
    <div>
      <el-button @click="getProof">generate proof</el-button>
    </div>
    <div>
      <p>proof: {{ proof }}</p>
      <p>maker note hash: {{ makerNote.hash() }}</p>
      <p>taker note value: {{ takerNote.value }}</p>
      <p>salt: {{ salt }}</p>
    </div>
    <div>
      <el-button v-bind:disabled="proof === ''" @click="takeOrder">take order</el-button>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import { Note, constants, decrypt } from '../../../../scripts/lib/Note';
import Web3Utils from 'web3-utils';
import dockerUtils from '../../../../scripts/lib/dockerUtils';
import { generateProof } from '../../api/index';

export default {
  data () {
    return {
      price: '',
      loading: false,
      proof: '',
      makerNote: {},
      stakeNote: {},
      salt: null,
    };
  },
  computed: mapState({
    order: state => state.order,
    takerNote: state => state.note,
    dex: state => state.dexContractInstance,
    web3: state => state.web3.web3Instance,
    coinbase: state => state.web3.coinbase,
  }),
  created () {
    this.salt = Web3Utils.randomHex(16);
    this.dex.encryptedNotes(this.order.makerNote).then((encryptedNote) => {
      this.makerNote = decrypt(encryptedNote, this.order.makerViewingKey);
    });
  },
  methods: {
    makeStakeNote () {
      const makerViewingKey = this.order.makerViewingKey;
      this.stakeNote = new Note(
        this.makerNote.hash(),
        this.takerNote.value,
        constants.ETH_TOKEN_TYPE,
        makerViewingKey,
        this.salt,
        true
      );
    },
    getProof () {
      this.loading = true;
      this.makeStakeNote();

      const params = {
        circuit: 'takeOrder',
        params: [this.makerNote, this.takerNote, this.stakeNote],
      };
      generateProof(params)
        .then(res => (this.proof = res.data.proof))
        .catch(e => console.log(e))
        .finally(() => (this.loading = false));
    },
    takeOrder () {
      this.loading = true;
      this.dex
        .takeOrder(0, ...this.proof, this.stakeNote.encrypt(), {
          from: this.coinbase,
        })
        .then(() => {
          setTimeout(() => {
            this.loading = false;
            this.$router.push({ path: '/main' });
          }, 3000);
        });
    },
  },
};
</script>
