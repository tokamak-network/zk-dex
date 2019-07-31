<template>
  <div v-loading="loading" style="height: 100%; text-align: center; margin-top: 150px;">
    <div>
      <el-button @click="getProof">generate proof</el-button>
    </div>
    <div>
      <p>proof: {{ proof }}</p>
      <p>price: {{ order.price }}</p>
    </div>
    <div>
      <el-button v-bind:disabled="proof === ''" @click="settleOrder">settle order</el-button>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import rlp from 'rlp';
import Web3Utils from 'web3-utils';
import dockerUtils from '../../../../scripts/lib/dockerUtils';
import { Note, constants, decrypt } from '../../../../scripts/lib/Note';
import { generateProof } from '../../api/index';

const ether = n => Web3Utils.toBN(n).mul(Web3Utils.toBN((1e18).toString(10)));

export default {
  data () {
    return {
      loading: false,
      price: '',
      proof: '',
      makerNote: null,
      stakeNote: null,
      rewardNote: null,
      paymentNote: null,
      changeNote: null,
    };
  },
  computed: mapState({
    dex: state => state.dexContractInstance,
    order: state => state.order,
    web3: state => state.web3.web3Instance,
    coinbase: state => state.web3.coinbase,
  }),
  methods: {
    async makeNotes () {
      const makerNote = await this.dex.encryptedNotes(this.order.makerNote);
      const stakeNote = await this.dex.encryptedNotes(
        this.order.takerNoteToMaker
      );
      this.makerNote = decrypt(makerNote, this.order.makerViewingKey);
      this.stakeNote = decrypt(stakeNote, this.order.makerViewingKey);
      this.rewardNote = new Note(
        this.order.parentNote,
        this.makerNote.value,
        constants.DAI_TOKEN_TYPE,
        this.order.makerViewingKey,
        Web3Utils.randomHex(16),
        true
      );
      this.paymentNote = new Note(
        this.makerNote.hash(),
        this.stakeNote.value,
        constants.ETH_TOKEN_TYPE,
        this.order.makerViewingKey,
        Web3Utils.randomHex(16),
        true
      );
      this.changeNote = new Note(
        this.makerNote.hash(),
        ether('0'),
        constants.DAI_TOKEN_TYPE,
        this.order.makerViewingKey,
        Web3Utils.randomHex(16),
        true
      );
    },
    getProof () {
      this.loading = true;
      const price = Web3Utils.toBN(parseInt(this.order.price).toString());
      console.log(price);
      this.makeNotes().then(() => {
        const params = {
          circuit: 'settleOrder',
          params: [
            this.makerNote,
            this.stakeNote,
            this.rewardNote,
            this.paymentNote,
            this.changeNote,
            price,
          ],
        };
        generateProof(params)
          .then(res => (this.proof = res.data.proof))
          .catch(e => console.log(e))
          .finally(() => (this.loading = false));
      });
    },
    settleOrder () {
      this.loading = true;
      this.dex
        .settleOrder(
          0,
          ...this.proof,
          rlp.encode([
            this.rewardNote.encrypt(),
            this.paymentNote.encrypt(),
            this.changeNote.encrypt(),
          ]),
          {
            from: this.coinbase,
          }
        )
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
