<template>
  <div>
    <el-table
      :data="notes"
      highlight-current-row
      @current-change="selectNote"
      style="width: 100%">
      <el-table-column
        type="index"
        width="50">
      </el-table-column>
      <el-table-column
        property="date"
        label="Date"
        width="120">
      </el-table-column>
      <el-table-column
        property="name"
        label="Name"
        width="120">
      </el-table-column>
      <el-table-column
        property="address"
        label="Address">
      </el-table-column>
      <el-table-column
        align="right">
        <template slot-scope="scope">
          <el-button
            size="mini"
            @click="handleNoteToMakeOrder(scope.$index, scope.row)">Make</el-button>
          <el-button
            size="mini"
            @click="handleNoteToTakeOrder(scope.$index, scope.row)">Take</el-button>
        </template>
      </el-table-column>
    </el-table>
    {{selectedNote}}
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  data() {
    return {
      notes: [{
        date: '2016-05-03',
        name: 'Tom',
        address: 'No. 189, Grove St, Los Angeles'
      }, {
        date: '2016-05-02',
        name: 'Tom',
        address: 'No. 189, Grove St, Los Angeles'
      }, {
        date: '2016-05-04',
        name: 'Tom',
        address: 'No. 189, Grove St, Los Angeles'
      }, {
        date: '2016-05-01',
        name: 'Tom',
        address: 'No. 189, Grove St, Los Angeles'
      }],
      selectedNote: null,
      web3WS: null
    }
  },
  computed: mapState({
    coinbase: state => state.web3.coinbase,
    contract: state => state.contractInstance()
  }),
  methods: {
    selectNote (note) {
      this.selectedNote = note
    },
    handleNoteToMakeOrder(index, note) {
    },
    handleNoteToTakeOrder(index, note) {
    }
  },
  beforeCreate () {
    const options = {
      fromBlock: 0,
      toBlock: 'latest'
    }
    const filter = this.web3WS.eth.filter(options, (error, result) => {
      if (error) console.log('error', error)
      console.log('result', result)
    })
    filter.watch(function(error, result) {
    });
  },
  mounted () {
    // this.$store.dispatch('getContract')
  },
}
</script>