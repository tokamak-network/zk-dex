<template>
  <div v-loading="loading" style="height: 100%; text-align: center; margin-top: 150px;">
    <div style="margin-bottom: 40px;">
      <p>token type: {{ note.token }}</p>
      <p>token value: {{ parseInt(note.value) }}</p>
      <el-form ref="form" label-width="120px">
        <el-form-item label="receiver">
          <el-input v-model="name"></el-input>
        </el-form-item>
      </el-form>
      <el-input type="number" min="0" style="width: 20%;" size="medium" placeholder="Enter price" v-model="price"></el-input>
      <p>price: {{ price }}</p>
    </div>
    <div style="margin-bottom: 40px;">
      <el-button v-bind:disabled="price == ''" @click="getProof">generate proof</el-button>
      <p>proof: {{ proof }}</p>
    </div>
    <div>
      <el-button v-bind:disabled="proof === '' || price == ''" @click="transfer">transer</el-button>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import { constants, Note } from '../../../scripts/lib/Note';
import Web3Utils from 'web3-utils';
import {
  updateNoteState,
  addOrder,
  getOrderCount,
  generateProof,
} from '../api/index';

export default {
  data () {
    return {
      receiver: null,
      oldNote: null,
      newNote1: null,
      newNote2: null,
      loading: false,
      price: '',
      proof: '',
      orderId: null,
    };
  },
  computed: mapState({
    note: state => state.note,
    coinbase: state => state.web3.coinbase,
    account: state => state.account,
    secretKey: state => state.secretKey,
    viewingKey: state => state.viewingKey,
    dex: state => state.dexContractInstance,
  }),
  methods: {
    getProof () {
      this.loading = true;
      this.makeNewNotes();

      console.log(this.oldNote, this.newNote1, this.newNote2);

      const params = {
        circuit: 'transferNote',
        params: [this.oldNote, this.newNote1, this.newNote2],
      };
      generateProof(params)
        .then(res => (this.proof = res.data.proof))
        .catch(e => console.log(e))
        .finally(() => (this.loading = false));
    },
    makeNewNotes () {
      const change = parseInt(this.note.value) - parseInt(this.price);
      this.newNote1 = new Note(
        this.receiver,
        Web3Utils.toBN(this.price),
        this.note.token,
        this.viewingKey,
        Web3Utils.randomHex(16)
      );
      this.newNote2 = new Note(
        this.account,
        Web3Utils.toBN(change),
        this.note.token,
        this.viewingKey,
        Web3Utils.randomHex(16)
      );
      this.oldNote = this.noteParam(this.note);
    },
    noteParam (note) {
      const n = note;
      delete n.hash;
      delete n.state;
      return n;
    },
    async transfer () {
      this.loading = true;

      const tx = await this.dex.spend(
        ...this.proof,
        this.newNote1.encrypt(),
        this.newNote2.encrypt(),
        {
          from: this.account,
        }
      );

      setTimeout(() => {
        this.loading = false;
        this.$router.push({ path: '/main' });
      }, 3000);
    },
  },
};
</script>
