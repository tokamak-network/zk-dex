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
          {{ orderId | hexToNumberString }}
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
          {{ orderPrice | hexToNumberString }}
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
          {{ noteValue | hexToNumberString }}
        </a>
      </p>
    </div>
    <div style="margin-top: 10px; display: flex; justify-content: flex-end">
      <button class="button" @click="takeOrder" :class="{ 'is-static': orderId === '' || noteHash === '', 'is-loading': loading }">Take Order</button>
    </div>
    <b-modal :active.sync="createAccountModalActive" :width="640" scroll="keep" class="hide-footer centered">
      <div class="box">
        <table class="table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            <tr class="hoverable" v-for="order in orders" @click="selectOrder(order)">
              <td>{{ order.orderId | hexToNumberString }}</td>
              <td>{{ order.price | hexToNumberString }}</td>
            </tr>
          </tbody>
        </table>
        <div style="display: flex; justify-content: flex-end">
          <button class="button" @click="closeModal">Close</button>
        </div>
      </div>
    </b-modal>
  </div>
</template>

<script>
import { mapState, mapMutations } from 'vuex';
import { constants, Note } from '../../../scripts/lib/Note';
import Web3Utils from 'web3-utils';
import {
  getNotes,
  getOrder,
  getOrderHistory,
  addNote,
  addOrderHistory,
  addOrder,
  generateProof,
  updateNoteState,
  updateOrderHistory,
  updateOrderState,
  updateOrderTaker,
} from '../api/index';

export default {
  data () {
    return {
      createAccountModalActive: false,
      loading: false,
      orderId: '',
      orderPrice: '',
      order: null,
      orders: [],
      note: null,
      noteHash: '',
      noteValue: '',
      salt: null,
    };
  },
  computed: {
    ...mapState({
      accounts: state => state.accounts,
      coinbase: state => state.web3.coinbase,
      viewingKey: state => state.viewingKey,
      dex: state => state.dexContractInstance,
    }),
  },
  created () {
    this.$bus.$on('select-note', this.selectNote);
    this.$bus.$on('select-orders', this.selectOrders);
    this.salt = Web3Utils.randomHex(16);
  },
  beforeDestroy () {
    // TODO: research
    // this.$bus.$off('select-note');
  },
  methods: {
    ...mapMutations(['SET_ORDERS', 'SET_ORDER_HISTORY', 'SET_NOTES']),
    closeModal () {
      this.createAccountModalActive = false;
    },
    selectNote (note) {
      this.note = note;
      this.noteHash = note.hash;
      this.noteValue = note.value;
    },
    selectOrder (order) {
      this.order = order;
      this.orderId = order.orderId;
      this.orderPrice = order.price;
      this.createAccountModalActive = false;
    },
    selectOrders (orders) {
      this.createAccountModalActive = true;
      this.orders = orders;
    },
    stakeNote () {
      const stakeNote = new Note(
        this.order.makerNote,
        this.note.value,
        this.order.targetToken,
        this.viewingKey,
        this.salt,
        true
      );
      return stakeNote;
    },
    takerNote () {
      const note = this.note;
      delete note.hash;
      delete note.state;

      return note;
    },
    async proof () {
      const takerNote = this.takerNote();
      const stakeNote = this.stakeNote();
      const params = {
        circuit: 'takeOrder',
        params: [this.order.makerNote, takerNote, stakeNote],
      };
      const res = await generateProof(params);

      return res.data.proof;
    },
    async takeOrder () {
      this.loading = true;

      const takerNote = this.takerNote();
      const stakeNote = this.stakeNote();
      const proof = await this.proof();
      const tx = await this.dex.takeOrder(
        this.order.orderId,
        ...proof,
        stakeNote.encrypt(this.order.makerViewingKey),
        {
          from: this.coinbase,
        }
      );

      if (tx.receipt.status) {
        // 1. taker note state update
        const noteOwner = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(takerNote.owner)),
          40
        );
        const noteHash = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(tx.logs[0].args.note)),
          64
        );
        const noteState = Web3Utils.toHex(tx.logs[0].args.state);
        await updateNoteState(noteOwner, noteHash, noteState);

        // 2. stake note create
        const hash = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(tx.logs[1].args.note)),
          64
        );
        const state = Web3Utils.toHex(tx.logs[1].args.state);
        const noteObject = {};
        noteObject.owner = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(stakeNote.owner)),
          40
        );
        noteObject.value = Web3Utils.toHex(Web3Utils.toBN(stakeNote.value));
        noteObject.token = Web3Utils.toHex(Web3Utils.toBN(stakeNote.token));
        noteObject.viewingKey = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(stakeNote.viewingKey)),
          16
        );
        noteObject.salt = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(stakeNote.salt)),
          32
        );
        noteObject.isSmart = Web3Utils.toHex(Web3Utils.toBN(stakeNote.isSmart));
        noteObject.hash = hash;
        noteObject.state = state;
        await addNote(this.order.orderMaker, noteObject);

        // 3. order state update
        const order = await this.dex.orders(Web3Utils.toBN(this.order.orderId));
        await updateOrderState(
          this.order.orderId,
          Web3Utils.toHex(order.state)
        );
        const orders = await updateOrderTaker(this.order.orderId, noteOwner);
        this.SET_ORDERS(orders);

        // 4. update order history state
        this.order.parentNote = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(order.parentNote)),
          64
        );
        this.order.takerNoteToMaker = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(order.takerNoteToMaker)),
          64
        );
        this.order.state = Web3Utils.toHex(order.state);
        const orderHistory = this.order;
        orderHistory.takerNote = noteObject.hash;
        orderHistory.takerNoteAmount = noteObject.value;
        await updateOrderHistory(this.order.orderMaker, orderHistory);

        // 5. create order history (buy)
        orderHistory.timestamp = new Date().getTime();
        orderHistory.type = '0x1';
        await addOrderHistory(takerNote.owner, orderHistory);

        const newNotes = [];
        for (let i = 0; i < this.accounts.length; i++) {
          const n = await getNotes(this.accounts[i].address);
          if (n !== null) {
            newNotes.push(...n);
          }
        }
        this.SET_NOTES(newNotes);

        const newOrderHistory = [];
        for (let i = 0; i < this.accounts.length; i++) {
          const h = await getOrderHistory(this.accounts[i].address);
          if (h !== null) {
            newOrderHistory.push(...h);
          }
        }
        this.SET_ORDER_HISTORY(newOrderHistory);
      }
      this.loading = false;
      this.clear();
    },
    clear () {
      this.orderId = '';
      this.orderPrice = '';
      this.noteHash = '';
      this.noteValue = '';
    },
  },
};
</script>
<style>
.hoverable {
  cursor: pointer;
}
</style>
