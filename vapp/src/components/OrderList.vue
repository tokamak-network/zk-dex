<template>
  <div style="text-align: center;" class="box">
    <h2 style="margin-bottom: 40px;">ORDER BOOK</h2>
    <table class="table fixed_header">
      <thead>
        <tr>
          <th>PRICE(DAI)</th>
          <th>Orders</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(count, price) in orderList" @click="selectOrders(price)">
          <td>{{ price | hexToNumberString }} </td>
          <td>{{ count }}</td>
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
    selectOrders (price) {
      const orders = this.orders.filter(o => (o.price === price && o.state === '0x0'));
      this.$bus.$emit('select-orders', orders);
    },
  },
};


const a = {
  'a': 10,
  'b': 20,
};

</script>
