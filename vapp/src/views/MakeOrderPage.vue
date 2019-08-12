<template>
  <div style="height: 100%; text-align: center; margin-top: 150px;">
    <div style="margin-bottom: 40px;">
      <p>viewing key: {{ viewingKey }}</p>
      <!-- <p>source token type: {{ note.token | hexToNumberString | tokenType }}</p> -->
      <p>TODO: targetToken</p>
      <input class="input" style="width: 20%;" type="number" placeholder="price" v-model="price">
      <p>price: {{ price }}</p>
    </div>
    <div style="margin-bottom: 40px;">
      <a class="button is-link" v-bind:class="loading" @click="getProof">generate proof</a>
      <p>proof: {{ proof }}</p>
    </div>
    <div>
      <a class="button is-link" @click="makeOrder">make order</a>
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
      loaded: false,
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
  computed: {
    ...mapState({
      coinbase: state => state.web3.coinbase,
      account: state => state.account,
      secretKey: state => state.secretKey,
      viewingKey: state => state.viewingKey,
      note: state => state.note,
      dex: state => state.dexContractInstance,
    }),
    loading: function () {
      return {
        'is-loading': this.loaded,
      };
    },
  },
  methods: {
    getProof () {
      this.loaded = true;
      const noteParam = this.noteParam(this.note);

      const params = {
        circuit: 'makeOrder',
        params: [noteParam],
      };
      generateProof(params)
        .then(res => (this.proof = res.data.proof))
        .catch(e => console.log(e))
        .finally(() => (this.loaded = false));
    },
    noteParam (note) {
      const n = note;
      delete n.hash;
      delete n.state;
      return n;
    },
    async makeOrder () {
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
        this.$router.push({ path: '/main' });
      }, 3000);
    },
  },
};
</script>
