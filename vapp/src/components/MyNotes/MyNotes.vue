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
      selectedNote: null
    }
  },
  methods: {
    selectNote (note) {
      this.selectedNote = note
    },
    handleNoteToMakeOrder(index, note) {
    },
    handleNoteToTakeOrder(index, note) {
    },
  },
  mounted () {
    this.$store.dispatch('getContract')
  },
}
</script>