<template>
  <div style="text-align: center;">
    <h1>ORDER BOOK</h1>
    <el-table
      :data="orders"
      highlight-current-row
      @current-change="selectOrder"
    >
      <el-table-column
        property="orderId"
        align="center"
        label="ORDER ID"
      >
      </el-table-column>
      <el-table-column
        property="price"
        align="center"
        label="PRICE">
      </el-table-column>
    </el-table>
    <p>selected order: {{ selectedOrder }}</p>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'

export default {
  data() {
    return {
      orders: [{
        orderId: 'Tom',
        price: 'No. 189, Grove St, Los Angeles'
      }, {
        orderId: 'Tom',
        price: 'No. 189, Grove St, Los Angeles'
      }, {
        orderId: 'Tom',
        price: 'No. 189, Grove St, Los Angeles'
      }, {
        orderId: 'Tom',
        price: 'No. 189, Grove St, Los Angeles'
      }],
      selectedOrder: null,
      web3WS: null
    }
  },
  computed: mapState({
    coinbase: state => state.web3.coinbase,
    contract: state => state.contractInstance(),
    web3: state => state.web3.web3Instance,
  }),
  methods: {
    ...mapActions([
      'setOrder'
    ]),
    selectOrder(order) {
      this.selectedOrder = order
      this.setOrder(order)
    }
  },
  beforeCreate () {
    // const options = {
    //   fromBlock: 0,
    //   toBlock: 'latest'
    // }
    // const filter = this.web3WS.eth.filter(options, (error, result) => {
    //   if (error) console.log('error', error)
    //   console.log('result', result)
    // })
    // filter.watch(function(error, result) {
    // });
  },
  mounted () {
    // this.$store.dispatch('getContract')
  },
}
</script>