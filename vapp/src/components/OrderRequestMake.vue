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
    <div style="margin-top: 10px; display: flex; justify-content: flex-end">
      <button class="button" @click="makeNewOrder" :class="{ 'is-static': noteHash === '' || price === '', 'is-loading': loading }">Make Order</button>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import { constants } from '../../../scripts/lib/Note';
import Web3Utils from 'web3-utils';
import {
  updateNote,
  addOrderByAccount,
  addOrder,
  generateProof,
} from '../api/index';

export default {
  data () {
    return {
      loading: false,
      activeTab: 0,
      noteHash: '',
      noteValue: '',
      price: '',
    };
  },
  mounted () {
    this.$store.watch(
      (state, getters) => getters.note,
      () => {
        this.noteHash = this.note.hash;
        this.noteValue = this.note.value;
      }
    );
  },
  computed: {
    ...mapState({
      note: state => state.note,
      coinbase: state => state.web3.coinbase,
      dex: state => state.dexContractInstance,
      viewingKey: state => state.viewingKey,
    }),
  },
  methods: {
    makerNote () {
      const note = this.note;
      delete note.hash;
      delete note.state;

      return note;
    },
    async proof (note) {
      const params = {
        circuit: 'makeOrder',
        params: [note],
      };
      const res = await generateProof(params);

      return res.data.proof;
    },
    async makeNewOrder () {
      this.loading = true;

      const makerNote = this.makerNote();
      const proof = await this.proof(makerNote);
      const tx = await this.dex.makeOrder(
        this.viewingKey,
        this.note.token === constants.ETH_TOKEN_TYPE
          ? constants.DAI_TOKEN_TYPE
          : constants.ETH_TOKEN_TYPE,
        this.price,
        ...proof,
        {
          from: this.coinbase,
        }
      );

      if (tx.receipt.status) {
        const noteOwner = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(makerNote.owner)), 20);
        const hash = tx.logs[0].args.note;
        const state = Web3Utils.hexToNumberString(
          Web3Utils.toHex(tx.logs[0].args.state)
        );
        makerNote.hash = hash;
        makerNote.state = state;
        await updateNote(noteOwner, makerNote);
        this.$parent.$emit('updateNote', makerNote);

        const orderId = (await this.dex.getOrderCount()) - 1;
        const order = await this.dex.orders(orderId);
        order.orderId = orderId;
        order.orderMaker = noteOwner;
        order.type = 'Sell';
        order.amount = makerNote.value;
        order.timestamp = new Date().getTime();
        await addOrder(order);
        await addOrderByAccount(noteOwner, order);
        this.$parent.$emit('addNewOrder', order);
      } else {}

      this.loading = false;
      this.clear();
    },
    clear () {
      this.noteHash = '';
      this.noteValue = '';
      this.price = '';
    },
  },
};
</script>

<style>
</style>
