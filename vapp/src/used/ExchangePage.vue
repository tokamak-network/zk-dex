<template>
  <div class="container">
    <div class="columns">
      <div class="column is-three-fifths">
        <div>
          <order-request style="margin-top: 10px" />
          <note-list :notes="notes" />
        </div>
      </div>
      <div class="column">
        <order-list :orders="orders" style="margin-top: 10px;" />
      </div>
    </div>
    <div class="container">
      <order-list-ongoing :ongoingOrderHistory="ongoingOrderHistory" />
      <order-list-history :completedOrderHistory="completedOrderHistory" />
    </div>
  </div>
</template>

<script>
import { mapState, mapMutations, mapGetters } from 'vuex';
import NoteList from '../components/NoteList.vue';
import OrderList from '../components/OrderList.vue';
import OrderRequest from '../components/OrderRequest.vue';
import OrderChart from '../components/OrderChart.vue';
import OrderListOngoing from '../components/OrderListOngoing.vue';
import OrderListHistory from '../components/OrderListHistory.vue';

import {
  getAccounts,
  getNotes,
  getOrderHistory,
  getOrders,
} from '../api/index';

export default {
  data () {
    return {
      isNoteSelected: false,
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
      accounts: state => state.accounts,
      orders: state => state.orders,
      notes: state => state.notes,
      orderHistory: state => state.orderHistory,
    }),
    ...mapGetters(['ongoingOrderHistory', 'completedOrderHistory']),
  },
  created () {
    // TODO: call methods not logic code here.
    if (this.accounts === null) {
      getAccounts(this.key).then(async (a) => {
        const accounts = [];
        const notes = [];
        const orderHistory = [];

        if (a !== null) {
          accounts.push(...a);
          for (let i = 0; i < accounts.length; i++) {
            const n = await getNotes(accounts[i].address);
            if (n !== null) {
              notes.push(...n);
            }
          }
        }
        this.SET_ACCOUNTS(accounts);
        this.SET_NOTES(notes);
      });
    }
    if (this.orderHistory === null) {
      this.getOrderHistory();
    }
    if (this.orders === null) {
      this.getOrders();
    }
  },
  methods: {
    ...mapMutations([
      'SET_ACCOUNTS',
      'SET_NOTES',
      'SET_ORDERS',
      'SET_ORDER_HISTORY',
    ]),
    async getOrders () {
      const o = await getOrders();
      const orders = [];
      if (o !== null) {
        orders.push(...o);
      }
      this.SET_ORDERS(orders);
    },
    async getOrderHistory () {
      const orderHistory = [];
      for (let i = 0; i < this.accounts.length; i++) {
        const h = await getOrderHistory(this.accounts[i].address);
        if (h !== null) {
          orderHistory.push(...h);
        }
      }
      this.SET_ORDER_HISTORY(orderHistory);
    },
  },
};
</script>
