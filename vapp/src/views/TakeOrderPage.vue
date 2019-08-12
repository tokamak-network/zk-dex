<template>
  <div style="height: 100%; text-align: center; margin-top: 150px;">
    <div>
      <a class="button is-link" v-bind:class="loading" @click="getProof">generate proof</a>
    </div>
    <div>
      <p>proof: {{ proof }}</p>
      <!-- <p>maker note hash: {{ makerNote.hash() }}</p> -->
      <!-- <p>taker note value: {{ takerNote.value | hexToNumberString}}</p> -->
      <p>salt: {{ salt }}</p>
    </div>
    <div>
      <a class="button is-link" @click="takeOrder">take order</a>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import { Note, constants, decrypt } from '../../../scripts/lib/Note';
import Web3Utils from 'web3-utils';
import dockerUtils from '../../../scripts/lib/dockerUtils';
import {
  addNote,
  addOrder,
  updateNoteState,
  generateProof,
} from '../api/index';

export default {
  data () {
    return {
      price: '',
      loaded: false,
      proof: '',
      makerNote: {},
      stakeNote: {},
      salt: null,
    };
  },
  computed: {
    ...mapState({
      order: state => state.order,
      takerNote: state => state.note,
      dex: state => state.dexContractInstance,
      web3: state => state.web3.web3Instance,
      coinbase: state => state.web3.coinbase,
      secretKey: state => state.secretKey,
    }),
    loading: function () {
      return {
        'is-loading': this.loaded,
      };
    },
  },
  created () {
    this.salt = Web3Utils.randomHex(16);
  },
  methods: {
    async getMakerNoteInOrder (order) {
      const encryptedNote = await this.dex.encryptedNotes(this.order.makerNote);
      const makerNote = decrypt(encryptedNote, this.order.makerViewingKey);
      return makerNote;
    },
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
      this.loaded = true;
      this.makeStakeNote();

      const params = {
        circuit: 'takeOrder',
        params: [this.makerNote, this.takerNote, this.stakeNote],
      };
      generateProof(params)
        .then(res => (this.proof = res.data.proof))
        .catch(e => console.log(e))
        .finally(() => (this.loaded = false));
    },
    async takeOrder () {
      const tx = await this.dex.takeOrder(
        this.order.orderId,
        ...this.proof,
        this.stakeNote.encrypt(),
        {
          from: this.account,
        }
      );

      const hash = tx.logs[0].args.note;
      const state = tx.logs[0].args.state;
      await updateNoteState(this.secretKey, hash, state);

      this.stakeNote.hash = tx.logs[1].args.note;
      this.stakeNote.state = tx.logs[1].args.state;
      await addNote(this.secretKey, this.stakeNote);

      // const order = await this.dex.orders(this.orderId);
      // await addOrder(order);

      setTimeout(() => {
        this.$router.push({ path: '/main' });
      }, 3000);
    },
  },
};
</script>
