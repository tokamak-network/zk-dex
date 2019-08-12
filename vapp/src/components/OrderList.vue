<template>
  <div style="text-align: center;" class="zone">
    <h2 style="margin-bottom: 40px;">ORDER BOOK</h2>
    <table class="table">
      <thead>
        <tr>
          <th>PRICE(DAI)</th>
          <th>STATE</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="order in orders" @click="selectOrder(order)" :class="{ 'is-selected': order == selectedOrder }">
          <!-- <td>{{ order.orderId }}</td> -->
          <!-- <td>{{ order.sourceToken | toNumberString | tokenType }}</td> -->
          <!-- <td>{{ order.targetToken | toNumberString | tokenType }}</td> -->
          <td>{{ order.price }}</td>
          <td>{{ order.state | toNumberString | orderState }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import { getOrderCount } from '../api/index';

export default {
  data () {
    return {
      orders: [],
      selectedOrder: null,
    };
  },
  computed: mapState({
    coinbase: state => state.web3.coinbase,
    contract: state => state.contractInstance(),
    web3: state => state.web3.web3Instance,
    dex: state => state.dexContractInstance,
  }),
  methods: {
    ...mapActions(['setOrder', 'setOrders']),
    selectOrder (order) {
      this.selectedOrder = order;
      this.setOrder(order);
    },
    handleNoteToSettleOrder (index) {
      this.selectOrder(this.orders[index]);
      this.$router.push({ path: '/settle' });
    },
    async getOrders () {
      const count = await this.dex.orderCount();
      console.log(count);
      this.orders = [];
      for (let i = 0; i < count; i++) {
        try {
          const order = await this.dex.orders(i);
          order.orderId = i;
          this.orders.push(order);
        } catch (err) {
          console.log(err);
        }
      }
    },
    // async getOrders (count) {
    //   const orders = [];
    //   for (let i = 0; i <= count; i++) {
    //     try {
    //       const order = await this.dex.orders(i);
    //       order.orderId = i;
    //       orders.push(order);
    //     } catch (err) {
    //       console.log(err);
    //     }
    //   }
    //   return orders;
    // },
  },
  created () {
    this.getOrders();
    // getOrderCount()
    //   .then(count => this.getOrders(count))
    //   .then((orders) => {
    //     // NOTE: 'undefined' has BN value.
    //     this.orders = orders;
    //   });
  },
};
</script>
