<template>
  <div style="text-align: center;" class="box">
    <h2 style="margin-bottom: 40px;">ORDER BOOK</h2>
    <table class="table fixed_header">
      <thead>
        <tr>
          <th>PRICE(DAI)</th>
          <th>STATE</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="order in orders" @click="selectOrder(order)">
          <td>{{ order.price | hexToNumberString }}</td>
          <td>{{ order.state | toNumberString | orderState }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import { getOrders } from '../api/index';

export default {
  data () {
    return {
      selectedOrder: null,
    };
  },
  props: ['orders'],
  methods: {
    ...mapActions(['setOrder']),
    selectOrder (order) {
      this.selectedOrder = order;
      this.setOrder(order);
    },
  },
};
</script>
