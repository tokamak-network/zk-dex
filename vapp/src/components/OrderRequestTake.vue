<template>
  <div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          Order id
        </a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">
          {{ selectedOrderId }}
        </a>
      </p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          Price
        </a>
      </p>
       <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">
          {{ selectedOrderPrice }}
        </a>
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
    <div style="float: right; margin-top: 10px;">
      <button class="button" style="margin-right: 10px;" v-bind:class="loading" @click="getProof">Generate Proof</button>
      <button class="button" @click="takeOrder">Take Order</button>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import { constants, decrypt, Note } from '../../../scripts/lib/Note';
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
      selectedOrderId: null,
      selectedOrderPrice: null,
      makerNote: null,
      stakeNote: null,
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
    this.$store.watch(
      (state, getters) => getters.order,
      () => {
        this.selectedOrderId = this.order.orderId;
        this.selectedOrderPrice = this.order.price;
      }
    );
    if (this.order) {
      this.selectedOrderId = this.order.orderId;
      this.selectedOrderPrice = this.order.price;
    }
  },
  computed: {
    ...mapState({
      order: state => state.order,
      note: state => state.note,
      account: state => state.account,
      coinbase: state => state.web3.coinbase,
      dex: state => state.dexContractInstance,
      viewingKey: state => state.viewingKey,
    }),
    loading: function () {
      return {
        'is-loading': this.loaded,
      };
    },
  },
  methods: {
    async setMakerNoteInOrder () {
      // TODO: 안됨.
      const encryptedNote = await this.dex.encryptedNotes(this.order.makerNote);
      this.makerNote = decrypt(encryptedNote, this.order.makerViewingKey);
    },
    async makeStakeNote () {
      await this.setMakerNoteInOrder();

      const makerViewingKey = this.order.makerViewingKey;
      const salt = Web3Utils.randomHex(16);

      // note -> takerNote
      // constants.ETH_TOKEN_TYPE

      // 오더안에 있음 maker note
      this.stakeNote = new Note(
        this.makerNote.hash(),
        this.note.value,
        constants.ETH_TOKEN_TYPE,
        makerViewingKey,
        salt,
        true
      );
    },
    // TDOO: modify logic
    noteParam (note) {
      const n = note;
      delete n.hash;
      delete n.state;
      return n;
    },
    getProof () {
      const takerNote = this.noteParam(this.note);
      this.loaded = true;
      this.makeStakeNote().then(() => {
        const params = {
          circuit: 'takeOrder',
          params: [this.makerNote, takerNote, this.stakeNote],
        };
        generateProof(params)
          .then(res => (this.proof = res.data.proof))
          .catch(e => console.log(e))
          .finally(() => (this.loaded = false));
      });
    },
    async takeOrder () {
      const tx = await this.dex.takeOrder(this.order.orderId, ...this.proof, this.stakeNote.encrypt(), {
        from: this.coinbase,
      });

      const note = {
        hash: tx.logs[0].args.note,
        state: tx.logs[0].args.state,
      };
      await addNote(this.account, note);

      this.stakeNote.hash = tx.logs[1].args.note;
      this.stakeNote.state = tx.logs[1].args.state;
      await addNote(this.account, this.stakeNote);

      // const order = await this.dex.orders(this.orderId);
      // await addOrder(order);

      setTimeout(() => {
        this.$router.push({ path: '/main' });
      }, 3000);
    },
  },
};
</script>

<style>
</style>
