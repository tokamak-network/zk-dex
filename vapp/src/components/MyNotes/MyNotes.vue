<template>
  <div style="text-align: center;">
    <h1>MY NOTES</h1>
    <el-table
      :data="notes"
      highlight-current-row
      @current-change="selectNote"
      style="width: 100%">
      <el-table-column
        property="date"
        label="Date"
        align="center"
      >
      </el-table-column>
      <el-table-column
        property="name"
        label="Name"
        align="center"
      >
      </el-table-column>
      <el-table-column
        property="address"
        label="Address"
        align="center"
      >
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
    <p>selected note: {{ selectedNote }}</p>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'

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
    contract: state => state.contractInstance(),
    web3: state => state.web3.web3Instance,
  }),
  methods: {
    ...mapActions([
      'setNote'
    ]),
    selectNote (note) {
      this.selectedNote = note
    },
    handleNoteToMakeOrder(index, note) {
      this.setNote(note)
      this.$router.push({ path: '/make' })
    },
    handleNoteToTakeOrder(index, note) {
      this.setNote(note)
      this.$router.push({ path: '/take' })
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
    this.$store.dispatch('getContract')
  },
}
</script>