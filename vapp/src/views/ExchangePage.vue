<template>
  <div class="container">
    <div class="columns">
      <div class="column is-three-fifths">
        <div>
          <order-request style="margin-top: 10px"/>
          <note-list :notes="notes" />
        </div>
      </div>
      <div class="column">
        <order-list :orders="orders" style="margin-top: 10px;" />
      </div>
    </div>
    <div class="container">
      <order-list-ongoing :ongoingOrder="ongoingOrder" />
      <order-list-history :finishedOrder="finishedOrder" />
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import NoteList from '../components/NoteList.vue';
import OrderList from '../components/OrderList.vue';
import OrderRequest from '../components/OrderRequest.vue';
import OrderChart from '../components/OrderChart.vue';
import OrderListOngoing from '../components/OrderListOngoing.vue';
import OrderListHistory from '../components/OrderListHistory.vue';

import {
  getAccounts,
  getNotes,
  getOrdersByUser,
  getOrders,
} from '../api/index';

export default {
  data () {
    return {
      isNoteSelected: false,
      notes: [],
      orders: [],
      personalOrders: [],
    };
  },
  components: {
    NoteList,
    OrderList,
    OrderRequest,
    OrderListOngoing,
    OrderListHistory,
  },
  computed: {
    ...mapState({
      key: state => state.key,
      viewingKey: state => state.viewingKey,
      secretKey: state => state.secretKey,
      order: state => state.order,
      note: state => state.note,
    }),
    ongoingOrder () {
      return this.personalOrders.filter(order => parseInt(order.state) <= 1);
    },
    finishedOrder () {
      return this.personalOrders.filter(order => parseInt(order.state) > 1);
    },
  },
  methods: {
    addNewOrder (order) {
      this.orders.push(order);
    },
    addNewOrderOngoingHistory (order) {
      this.personalOrders.push(order);
    },
    updateNote (note) {
      for (let i = 0; i < this.notes.length; i++) {
        if (this.notes[i].hash === note.hash) {
          this.$set(this.notes, i, note);
          break;
        }
      }
    },
    updateOrder (order) {
      for (let i = 0; i < this.orders.length; i++) {
        if (this.orders[i].orderId === order.orderId) {
          this.$set(this.orders, i, order);
          break;
        }
      }
    },
  },
  created () {
    getAccounts(this.key).then(async (accounts) => {
      if (accounts !== null) {
        const notes = [];
        const orders = [];
        for (let i = 0; i < accounts.length; i++) {
          const n = await getNotes(accounts[i].address);
          if (n != null) {
            notes.push(...n);
          }
          const o = await getOrdersByUser(accounts[i].address);
          if (o != null) {
            orders.push(...o);
          }
        }
        this.personalOrders = orders;
        this.notes = notes;
      }
    });
    getOrders().then((orders) => {
      if (orders !== null) {
        this.orders = orders;
      }
    });
    this.$on('addNewOrder', this.addNewOrder);
    this.$on('addNewOrderOngoingHistory', this.addNewOrderOngoingHistory);
    this.$on('updateNote', this.updateNote);
    this.$on('updateOrder', this.updateOrder);
  },
  beforeDestroy () {
    this.$off('addNewOrder', this.addNewOrder);
    this.$off('addNewOrderOngoingHistory', this.addNewOrderOngoingHistory);
    this.$off('updateNote', this.updateNote);
    this.$off('updateOrder', this.updateOrder);
  },
};
</script>
