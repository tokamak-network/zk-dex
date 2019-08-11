<template>
  <div style="text-align: center;">
    <h2 style="margin-bottom: 40px;">ORDER BOOK</h2>
    <el-table :data="orders" highlight-current-row @current-change="selectOrder">
      <el-table-column property="orderId" align="center" label="ORDER"></el-table-column>
      <el-table-column property="sourceToken" align="center" label="SOURCE"></el-table-column>
      <el-table-column property="targetToken" align="center" label="TARGET"></el-table-column>
      <el-table-column property="price" align="center" label="PRICE"></el-table-column>
      <el-table-column property="state" align="center" label="STATE"></el-table-column>
      <el-table-column align="right">
        <template slot-scope="scope">
          <el-button size="mini" @click="handleNoteToSettleOrder(scope.$index, scope.row)">settle order</el-button>
        </template>
      </el-table-column>
    </el-table>
    <p>selected order: {{ selectedOrder }}</p>
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
    async getOrders (count) {
      const orders = [];
      for (let i = 0; i <= count; i++) {
        try {
          const order = await this.dex.orders(i);
          order.orderId = i;
          orders.push(order);
        } catch (err) {
          console.log(err);
        }
      }
      return orders;
    },
  },
  created () {
    getOrderCount()
      .then(count => this.getOrders(count))
      .then((orders) => {
        // NOTE: 'undefined' has BN value.
        this.orders = orders;
      });
  },
};
</script>
