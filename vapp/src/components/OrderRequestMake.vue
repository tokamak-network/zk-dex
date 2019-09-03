<template>
  <div>
    <div class="columns">
      <div class="column">
        <button class="button" :class="{ 'is-info': selected1, 'is-outlined': selected1 }" style="width: 100%;" @click="select1">1</button>
      </div>
      <div class="column">
        <button class="button" :class="{ 'is-info': selected2, 'is-outlined': selected2 }" style="width: 100%;" @click="select2">0.5</button>
      </div>
      <div class="column">
        <button class="button" :class="{ 'is-info': selected3, 'is-outlined': selected3 }" style="width: 100%;" @click="select3">0.25</button>
      </div>
    </div>
    <div class="columns">
      <div class="column">
        <button class="button" :class="{ 'is-info': selected4, 'is-outlined': selected4 }" style="width: 100%;" @click="select4">0.2</button>
      </div>
      <div class="column">
        <button class="button" :class="{ 'is-info': selected5, 'is-outlined': selected5 }" style="width: 100%;" @click="select5">0.125</button>
      </div>
      <div class="column">
        <button class="button" :class="{ 'is-info': selected6, 'is-outlined': selected6 }" style="width: 100%;" @click="select6">0.1</button>
      </div>
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
          {{ noteValue | hexToNumberString }}
        </a>
      </p>
    </div>
    <div v-if="radio === 'buy'" style="margin-top: 10px; display: flex; justify-content: flex-end">
      <button class="button" @click="makeNewOrder" :class="{ 'is-static': noteHash === '' || price === '', 'is-loading': loading }">Buy ETH</button>
    </div>
    <div v-else-if="radio === 'sell'" style="margin-top: 10px; display: flex; justify-content: flex-end">
      <button class="button" @click="makeNewOrder" :class="{ 'is-static': noteHash === '' || price === '', 'is-loading': loading }">Sell ETH</button>
    </div>
  </div>
</template>

<script>
import { mapState, mapMutations } from 'vuex';
import { constants } from '../../../scripts/lib/Note';
import Web3Utils from 'web3-utils';
import {
  getNotes,
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
      selected1: false,
      selected2: false,
      selected3: false,
      selected4: false,
      selected5: false,
      selected6: false,
    };
  },
  props: ['radio'],
  computed: {
    ...mapState({
      accounts: state => state.accounts,
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
    ...mapMutations(['SET_ORDERS', 'SET_ORDER_HISTORY', 'SET_NOTES']),
    onlyNumber () {
      if (event.keyCode < 48 || event.keyCode > 57) {
        event.returnValue = false;
      }
    },
    select1 () {
      this.selected1 = true;
      this.selected2 = false;
      this.selected3 = false;
      this.selected4 = false;
      this.selected5 = false;
      this.selected6 = false;
      this.price = 1;
    },
    select2 () {
      this.selected1 = false;
      this.selected2 = true;
      this.selected3 = false;
      this.selected4 = false;
      this.selected5 = false;
      this.selected6 = false;
      this.price = 2;
    },
    select3 () {
      this.selected1 = false;
      this.selected2 = false;
      this.selected3 = true;
      this.selected4 = false;
      this.selected5 = false;
      this.selected6 = false;
      this.price = 4;
    },
    select4 () {
      this.selected1 = false;
      this.selected2 = false;
      this.selected3 = false;
      this.selected4 = true;
      this.selected5 = false;
      this.selected6 = false;
      this.price = 5;
    },
    select5 () {
      this.selected1 = false;
      this.selected2 = false;
      this.selected3 = false;
      this.selected4 = false;
      this.selected5 = true;
      this.selected6 = false;
      this.price = 8;
    },
    select6 () {
      this.selected1 = false;
      this.selected2 = false;
      this.selected3 = false;
      this.selected4 = false;
      this.selected5 = false;
      this.selected6 = true;
      this.price = 10;
    },
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
        const noteOwner = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(this.note.owner)),
          40
        );
        const noteHash = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(tx.logs[0].args.note)),
          64
        );
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
      this.selected1 = false;
      this.selected2 = false;
      this.selected3 = false;
      this.selected4 = false;
      this.selected5 = false;
      this.selected6 = false;
    },
    async createOrder () {
      const orderMaker = Web3Utils.padLeft(
        Web3Utils.toHex(Web3Utils.toBN(this.note.owner)),
        40
      );
      const orderId = (await this.dex.getOrderCount()) - 1;
      const order = await this.dex.orders(orderId);

      order.orderId = Web3Utils.toHex(orderId);
      order.orderMaker = orderMaker;
      order.makerNote = Web3Utils.padLeft(
        Web3Utils.toHex(Web3Utils.toBN(order.makerNote)),
        64
      );
      order.parentNote = Web3Utils.padLeft(
        Web3Utils.toHex(Web3Utils.toBN(order.parentNote)),
        64
      );
      order.takerNoteToMaker = Web3Utils.padLeft(
        Web3Utils.toHex(Web3Utils.toBN(order.takerNoteToMaker)),
        64
      );
      order.makerViewingKey = Web3Utils.padLeft(
        Web3Utils.toHex(Web3Utils.toBN(order.makerViewingKey)),
        16
      );
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
      await updateNoteState(noteOwner, noteHash, noteState);

      const newNotes = [];
      for (let i = 0; i < this.accounts.length; i++) {
        const n = await getNotes(this.accounts[i].address);
        if (n !== null) {
          newNotes.push(...n);
        }
      }
      this.SET_NOTES(newNotes);
    },
  },
};
</script>

<style>
</style>
