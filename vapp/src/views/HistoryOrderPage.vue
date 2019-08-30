<template>
  <div>
    <order-list-ongoing :ongoingOrder="ongoingOrder" />
    <order-list-history :finishedOrder="finishedOrder" />
  </div>
</template>

<script>
import OrderListOngoing from '../components/OrderListOngoing.vue';
import OrderListHistory from '../components/OrderListHistory.vue';

import { mapState } from 'vuex';
import { getAccounts, getOrdersByUser } from '../api/index';

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
    }),
    ongoingOrder () {
      return this.orders.filter(order => parseInt(order.state) <= 1);
    },
    finishedOrder () {
      return this.orders.filter(order => parseInt(order.state) > 1);
    },
  },
  created () {
    getAccounts(this.key).then(async (accounts) => {
      if (accounts !== null) {
        const orders = [];
        for (let i = 0; i < accounts.length; i++) {
          const o = await getOrdersByUser(accounts[i].address);
          if (o != null) {
            orders.push(...o);
          }
        }
        this.orders = orders;
      }
    });
  },
};
</script>
