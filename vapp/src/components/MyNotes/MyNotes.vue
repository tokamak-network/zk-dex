<template>
  <div style="text-align: center;">
    <h2 style="margin-bottom: 40px;">MY NOTES</h2>
    <el-table
      :data="notes"
      highlight-current-row
      @current-change="selectNote"
      style="width: 100%">
      <el-table-column
        property="token"
        label="TOKEN"
        align="center"
      >
      </el-table-column>
      <el-table-column
        property="value"
        label="VALUE"
        align="center"
      >
      </el-table-column>
      <el-table-column
        property="status"
        label="STATUS"
        align="center"
      >
      </el-table-column>
      <el-table-column
        align="right">
        <template slot-scope="scope">
          <div
            v-if="scope.row.status==='trading'"
          >
            <el-button
              size="mini"
              @click="handleNoteToSettleOrder(scope.$index, scope.row)">settle order
            </el-button>
          </div>
          <div
            v-else
          >
            <el-button
              style="margin-bottom: 10px;"
              size="mini"
              @click="handleNoteToMakeOrder(scope.$index, scope.row)">make order
            </el-button>
            <el-button
              size="mini"
              @click="handleNoteToTakeOrder(scope.$index, scope.row)">take order
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
    <p>selected note: {{ selectedNote }}</p>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import Wallet from '../../../../scripts/lib/Wallet'
import util from '../../../../scripts/lib/util'
import Web3Utils from 'web3-utils'

const dummyNotes = [
  {
    token: 'eth',
    value: '10',
    status: 'valid'
  }, {
    token: 'dai',
    value: '2500',
    status: 'valid'
  }, {
    token: 'eth',
    value: '500',
    status: 'trading'
  }]

export default {
  data() {
    return {
      notes: dummyNotes,
      selectedNote: null
    }
  },
  computed: mapState({

  }),
  methods: {
    ...mapActions([
      'setNote',
      'setMyNotes'
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
    },
    handleNoteToSettleOrder(index, note) {
      this.setNote(note)
      this.$router.push({ path: '/settle' })
    }
  },
  beforeCreate () {
    const coinbase = this.$store.state.web3.coinbase
    const wallet = this.$store.state.wallet
    console.log('getNotes', wallet.getNotes(coinbase))
  },
  created () {
    this.setMyNotes(this.notes)
  },
  mounted () {
    this.$store.dispatch('getContract')
  },
}
</script>