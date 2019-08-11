<template>
  <div v-loading="loading" style="height: 100%; text-align: center; margin-top: 150px;">
    <div style="margin-bottom: 40px;">
      <p>viewing key: {{ viewingKey }}</p>
      <p>source token type: {{ note.token }}</p>
      <el-input type="number" min="0" style="width: 20%;" size="medium" placeholder="Enter price" v-model="price"></el-input>
      <p>price: {{ price }}</p>
    </div>
    <div style="margin-bottom: 40px;">
      <el-button v-bind:disabled="price == ''" @click="getProof">generate proof</el-button>
      <p>proof: {{ proof }}</p>
      <p>orderId: {{ orderId }}</p>
    </div>
    <div>
      <el-button v-bind:disabled="proof === '' || price == ''" @click="makeOrder">make order</el-button>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import { constants } from '../../../scripts/lib/Note';
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
      loading: false,
      price: '',
      proof: '',
      orderId: null,
    };
  },
  created () {
    // getOrderCount().then((count) => {
    //   this.orderId = count;
    // });
  },
  computed: mapState({
    coinbase: state => state.web3.coinbase,
    wallet: state => state.wallet,
    secretKey: state => state.secretKey,
    viewingKey: state => state.viewingKey,
    note: state => state.note,
    dex: state => state.dexContractInstance,
  }),
  methods: {
    getProof () {
      this.loading = true;
      const noteParam = this.noteParam(this.note);

      const params = {
        circuit: 'makeOrder',
        params: [noteParam],
      };
      generateProof(params)
        .then(res => (this.proof = res.data.proof))
        .catch(e => console.log(e))
        .finally(() => (this.loading = false));
    },
    noteParam (note) {
      const n = note;
      delete n.hash;
      delete n.state;
      return n;
    },
    async makeOrder () {
      this.loading = true;

      const tx = await this.dex.makeOrder(
        this.viewingKey,
        this.note.token === constants.ETH_TOKEN_TYPE
          ? constants.DAI_TOKEN_TYPE
          : constants.ETH_TOKEN_TYPE,
        Web3Utils.toBN(this.price),
        ...this.proof,
        {
          from: this.coinbase,
        }
      );

      const hash = tx.logs[0].args.note;
      const state = tx.logs[0].args.state;
      await updateNoteState(this.secretKey, hash, state);

      // const order = await this.dex.orders(this.orderId);
      // order.orderId = this.orderId;
      // await addOrder(order);

      setTimeout(() => {
        this.loading = false;
        this.$router.push({ path: '/main' });
      }, 3000);
    },
  },
};
</script>
