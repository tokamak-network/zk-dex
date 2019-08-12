<template>
  <div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          Price
        </a>
      </p>
      <p class="control is-expanded">
        <input style="width: 100%; text-align: right;" class="input" type="text" placeholder="price" v-model="price">
      </p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          Note
        </a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">
          {{ noteHash | abbreviate }}
        </a>
      </p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          Note amount
        </a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">
          {{ noteValue }}
        </a>
      </p>
    </div>
    <div style="margin-top: 10px;">
      <div>
        <button class="button" style="margin-right: 10px;" v-bind:class="loading" @click="getProof">Generate Proof</button>
        <button class="button" @click="makeOrder">Make Order</button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import { constants } from '../../../scripts/lib/Note';
import Web3Utils from 'web3-utils';
import {
  addNote,
  addOrder,
  getOrderCount,
  generateProof,
} from '../api/index';

export default {
  data () {
    return {
      price: '',
      proof: '',
      loaded: false,
      activeTab: 0,
      selectedNote: null,
      noteHash: null,
      noteValue: null,
    };
  },
  mounted () {
    this.$store.watch(
      (state, getters) => getters.note,
      () => {
        this.proof = '';
        this.selectedNote = this.note;
        this.noteHash = this.selectedNote.hash;
        this.noteValue = this.selectedNote.value;
      }
    );
  },
  computed: {
    ...mapState({
      account: state => state.account,
      coinbase: state => state.web3.coinbase,
      dex: state => state.dexContractInstance,
      order: state => state.order,
      note: state => state.note,
      viewingKey: state => state.viewingKey,
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
      const noteParam = this.noteParam(this.selectedNote);

      const params = {
        circuit: 'makeOrder',
        params: [noteParam],
      };
      generateProof(params)
        .then((res) => {
          this.proof = res.data.proof;
          console.log(this.proof);
        })
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
        Web3Utils.padLeft(Web3Utils.toHex(this.viewingKey), 32),
        this.selectedNote.token === constants.ETH_TOKEN_TYPE
          ? constants.DAI_TOKEN_TYPE
          : constants.ETH_TOKEN_TYPE,
        Web3Utils.toBN(this.price),
        ...this.proof,
        {
          from: this.coinbase,
        }
      );

      this.note.hash = tx.logs[0].args.note;
      this.note.state = tx.logs[0].args.state;
      // modifiy note
      await addNote(this.account, this.note);

      // const order = await this.dex.orders(this.orderId);
      // order.orderId = this.orderId;
      // await addOrder(order);

      setTimeout(() => {
        this.$router.push({ path: '/market' });
      }, 3000);
    },
  },
};
</script>

<style>
</style>
