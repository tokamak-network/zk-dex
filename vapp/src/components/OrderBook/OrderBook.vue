<template>
  <div style="text-align: center;">
    <h2 style="margin-bottom: 40px;">ORDER BOOK</h2>
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

const dummyOrders = [
  {
    orderId: '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b',
    price: '14'
  }, {
    orderId: 'd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35',
    price: '13'
  }, {
    orderId: '4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce',
    price: '12'
  }, {
    orderId: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    price: '11'
  }
]

export default {
  data() {
    return {
      orders: dummyOrders,
      selectedOrder: null,
      web3WS: null
    }
  },
  computed: mapState({
    coinbase: state => state.web3.coinbase,
    contract: state => state.contractInstance(),
    web3: state => state.web3.web3Instance
  }),
  methods: {
    ...mapActions([
      'setOrder',
      'setOrders'
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
  created () {
    this.setOrders(this.orders)
  },
  mounted () {
    // this.$store.dispatch('getContract')
  },
}
</script>