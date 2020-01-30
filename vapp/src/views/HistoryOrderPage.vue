<template>
  <div>
    <order-list-ongoing :ongoingOrderHistory="ongoingOrderHistory" />
    <order-list-history :completedOrderHistory="completedOrderHistory" />
  </div>
</template>

<script>
import OrderListOngoing from '../components/OrderListOngoing.vue';
import OrderListHistory from '../components/OrderListHistory.vue';

import { mapState, mapGetters, mapMutations } from 'vuex';
import { getAccounts, getOrderHistory } from '../api/index';

export default {
  components: {
    OrderListOngoing,
    OrderListHistory,
  },
  data () {
    return {
      orders: [],
    };
  },
  computed: {
    ...mapState({
      key: state => state.key,
      accounts: state => state.accounts,
      orderHistory: state => state.orderHistory,
    }),
    ...mapGetters([
      'ongoingOrderHistory',
      'completedOrderHistory',
    ]),
  },
  created () {
    if (this.accounts === null) {
      getAccounts(this.key).then(async (a) => {
        const accounts = [];
        if (a !== null) {
          accounts.push(...a);
        }
        this.SET_ACCOUNTS(accounts);
      });
    }
    if (this.accounts !== null && this.orderHistory === null) {
      this.getOrderHistory();
    }
  },
  methods: {
    ...mapMutations([
      'SET_ACCOUNTS',
      'SET_ORDER_HISTORY',
    ]),
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
