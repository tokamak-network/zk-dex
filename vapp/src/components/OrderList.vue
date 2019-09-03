<template>
  <div style="text-align: center;" class="box">
    <h2 style="margin-bottom: 40px;">ORDER BOOK</h2>
    <table class="table fixed_header">
      <thead>
        <tr>
          <th>PRICE(DAI)</th>
          <th>Orders</th>
          <th>Type</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(order, price) in orderList" @click="selectOrders(price, order.sourceToken)">
          <td>{{ price | hexToNumberString }} </td>
          <td>{{ order.count }}</td>
          <td>{{ order.type | orderType}}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex';
import { getOrders } from '../api/index';

export default {
  data () {
    return {
      selectedOrder: null,
    };
  },
  props: ['orders'],
  computed: {
    ...mapGetters(['orderList']),
  },
  methods: {
    selectOrders (price, sourceToken) {
      const orders = this.orders.filter(o => (o.price === price && o.state === '0x0' && o.sourceToken === sourceToken));
      this.$bus.$emit('select-orders', orders);
    },
  },
};
</script>
