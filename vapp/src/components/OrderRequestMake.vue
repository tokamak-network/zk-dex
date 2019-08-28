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
import { mapState, mapMutations } from 'vuex';
import { constants } from '../../../scripts/lib/Note';
import Web3Utils from 'web3-utils';
import {
  updateNoteState,
  addOrderHistory,
  addOrder,
  generateProof,
} from '../api/index';

export default {
  data () {
    return {
      note: null,
      loading: false,
      activeTab: 0,
      noteHash: '',
      noteValue: '',
      price: '',
    };
  },
  computed: {
    ...mapState({
      coinbase: state => state.web3.coinbase,
      dex: state => state.dexContractInstance,
      viewingKey: state => state.viewingKey,
    }),
  },
  created () {
    this.$bus.$on('select-note', this.selectNote);
  },
  beforeDestroy () {
    // this.$bus.$off('select-note');
  },
  methods: {
    ...mapMutations([
      'SET_ORDERS',
      'SET_ORDER_HISTORY',
      'SET_NOTES',
    ]),
    selectNote (note) {
      this.note = note;
      this.noteHash = note.hash;
      this.noteValue = note.value;
    },
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
        '0x0',
        this.note.token === '0x0'
          ? constants.DAI_TOKEN_TYPE
          : constants.ETH_TOKEN_TYPE,
        this.price,
        ...proof,
        {
          from: this.coinbase,
        }
      );

      if (tx.receipt.status) {
        const noteOwner = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(this.note.owner)), 40);
        const noteHash = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(tx.logs[0].args.note)), 64);
        const noteState = Web3Utils.toHex(tx.logs[0].args.state);
        await this.updateNoteState(noteOwner, noteHash, noteState);

        const order = await this.createOrder();
        await this.createOrderHistory(noteOwner, order);
      }
      this.loading = false;
      this.clear();
    },
    clear () {
      this.noteHash = '';
      this.noteValue = '';
      this.price = '';
    },
    async createOrder () {
      const orderMaker = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(this.note.owner)), 40);
      const orderId = (await this.dex.getOrderCount()) - 1;
      const order = await this.dex.orders(orderId);

      order.orderId = Web3Utils.toHex(orderId);
      order.orderMaker = orderMaker;
      order.makerNote = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(order.makerNote)), 64);
      order.parentNote = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(order.parentNote)), 64);
      order.takerNoteToMaker = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(order.takerNoteToMaker)), 64);
      order.makerViewingKey = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(order.makerViewingKey)), 16);
      order.price = Web3Utils.toHex(order.price);
      order.sourceToken = Web3Utils.toHex(order.sourceToken);
      order.targetToken = Web3Utils.toHex(order.targetToken);
      order.state = Web3Utils.toHex(order.state);
      order.type = Web3Utils.toHex('0'); // '0': sell, '1': buy
      order.timestamp = new Date().getTime();
      order.makerNoteAmount = Web3Utils.toHex(this.note.value);
      order.takerNoteAmount = Web3Utils.toHex('0');

      const orders = await addOrder(order);
      this.SET_ORDERS(orders);

      return order;
    },
    async createOrderHistory (account, order) {
      const orderHistory = order;
      const history = await addOrderHistory(account, orderHistory);
      this.SET_ORDER_HISTORY(history);
    },
    async updateNoteState (noteOwner, noteHash, noteState) {
      const notes = await updateNoteState(noteOwner, noteHash, noteState);
      this.SET_NOTES(notes);
    },
  },
};
</script>

<style>
</style>
