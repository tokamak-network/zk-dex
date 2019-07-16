<template>
  <div class="columns">
    <div class="column"></div>
    <div class="column">
      <b-table
        selectable
        :select-mode="selectMode"
        selectedVariant="success"
        :items="orders"
        :fields="orderFields"
        @row-selected="selectOrder"
        responsive="sm"
      >
        <template slot="selected" slot-scope="{ rowSelected }">
          <span v-if="rowSelected">✔</span>
        </template>
      </b-table>
    </div>
    <div class="column">
      <div>
        <b-table
          selectable
          :select-mode="selectMode"
          selectedVariant="success"
          :items="unspentNotes"
          :fields="noteFields"
          @row-selected="selectUnspentNote"
          responsive="sm"
          striped
        >
          <template slot="selected" slot-scope="{ rowSelected }">
            <span v-if="rowSelected">✔</span>
          </template>
          <template slot="make">
            <b-button
              tag="router-link"
              to="/make"
            >make
            </b-button>
          </template>
          <template slot="take">
            <b-button
              tag="router-link"
              to="/take"
            >take
            </b-button>
          </template>
        </b-table>
      </div>
      <div style="height:50px; width:100%; clear:both;"></div>
      <div>
        <b-table
          selectable
          :select-mode="selectMode"
          selectedVariant="success"
          :items="tradingNotes"
          :fields="noteFields"
          @row-selected="selectTradingNote"
          responsive="sm"
        >
          <template slot="selected" slot-scope="{ rowSelected }">
            <span v-if="rowSelected">✔</span>
          </template>
          <template slot="settle">
            <b-button
              tag="router-link"
              to="/settle"
            >settle
            </b-button>
          </template>
        </b-table>
      </div>
      <div style="height:50px; width:100%; clear:both;"></div>
      <div>
        <b-table
          selectable
          :select-mode="selectMode"
          selectedVariant="success"
          :items="spentNotes"
          :fields="noteFields"
          @row-selected="selectSpentNote"
          responsive="sm"
        >
          <template slot="selected" slot-scope="{ rowSelected }">
            <span v-if="rowSelected">✔</span>
          </template>
        </b-table>
      </div>
    </div>
    <div class="column"></div>
  </div>
  
  <!-- <div>
    <div class="columns">
      <div class="column"></div>
      <div class="column">
        ORDER BOOKS
        <div style="height:30px; width:100%; clear:both;"></div>
        <b-table
          :data="sellOrders"
          :columns="orderColumns"
          :selected.sync="selectedOrder"
          focusable
        >
        </b-table>
        <div style="height:50px; width:100%; clear:both;"></div>
        <b-table
          :data="buyOrders"
          :columns="orderColumns"
          :selected.sync="selectedOrder"
          focusable>
        </b-table>
        <div style="height:50px; width:100%; clear:both;"></div>
        <div>
          <b-button tag="router-link"
            to="/make"
            type="is-info"
          >
            <span v-on:click="takeOrder()">ORDER</span>
          </b-button>
        </div>
      </div>
      <div style="height:30px; width:10%; clear:both;"></div>
      <div class="column">
        MY NOTES
        <div style="height:30px; width:100%; clear:both;"></div>
        <b-table
          :data="unspentNotes"
          :columns="noteColumns"
          :selected.sync="selectedNote"
          focusable>
        </b-table>
        <div style="height:20px; width:100%; clear:both;"></div>
        <div>
          <b-button tag="router-link"
            to="/create"
            type="is-info"
          >
            <span v-on:click="selectNote()">TRADE</span>
          </b-button>
        </div>
        <div style="height:100px; width:100%; clear:both;"></div>
        <b-table
          :data="tradingNotes"
          :columns="noteColumns"
          :selected.sync="selectedNote"
          focusable>
        </b-table>
        <div style="height:20px; width:100%; clear:both;"></div>
        <div>
          <b-button tag="router-link"
            to="/settle"
            type="is-info"
          >
            <span v-on:click="settleOrder()">SETTLE</span>
          </b-button>
        </div>
        <div style="height:100px; width:100%; clear:both;"></div>
        <b-table
          :data="spentNotes"
          :columns="noteColumns"
          :selected.sync="selectedNote"
          focusable>
        </b-table>
      </div>
      <div class="column"></div>
    </div>
  </div> -->
</template>

<script>
const dummyNotes = [
  {
    hash: '0x1',
    token: 'eth',
    value: 100,
    status: 'trading'
  },
  {
    hash: '0x1',
    token: 'eth',
    value: 100,
    status: 'trading'
  },
  {
    hash: '0x1',
    token: 'eth',
    value: 100,
    status: 'trading'
  },
  {
    hash: '0x2',
    token: 'dai',
    value: 200,
    status: 'spent'
  },
  {
    hash: '0x2',
    token: 'dai',
    value: 200,
    status: 'spent'
  },
  {
    hash: '0x2',
    token: 'dai',
    value: 200,
    status: 'spent'
  },
  {
    hash: '0x3',
    token: 'eth',
    value: 300,
    status: 'unspent'
  },
  {
    hash: '0x3',
    token: 'eth',
    value: 300,
    status: 'unspent'
  },
  {
    hash: '0x3',
    token: 'eth',
    value: 300,
    status: 'unspent'
  }
]

export default {
  data () {
    return {
      noteToMakeOrder: null,
      selectedOrder: [],
      selectMode: 'single',
      web3: {},
      orders: [],
      selectedNote: null,
      myNotes: [],
      isOrdered: false,
      orderFields: ['selected', 'orderId', 'price'],
      noteFields: [
        { key: 'selected', label: 'selected', class: 'text-center' },
        { key: 'status', label: 'status', class: 'text-center' },
        { key: 'token', label: 'token', class: 'text-center' },
        { key: 'hash', label: 'hash', class: 'text-center' },
        { key: 'value', label: 'value', class: 'text-center' },
        { key: 'make', label: '', class: 'text-center' },
        { key: 'take', label: '', class: 'text-center' },
        { key: 'settle', label: '', class: 'text-center' },
      ]
    }
  },
  created () {
    this.getMyNotes();
    this.orders = this.$store.state.orders;
  },
  mounted () {
    this.$store.dispatch('GET_CONTRACT_INSTANCE')
  },
  computed: {
    spentNotes() {
      return this.myNotes.filter(note => note.status === 'spent');
    },
    unspentNotes() {
      return this.myNotes.filter(note => note.status === 'unspent');
    },
    tradingNotes() {
      return this.myNotes.filter(note => note.status === 'trading');
    },
  },
  methods: {
    getMyNotes() {
      this.myNotes = dummyNotes;
    },
    selectOrder(order) {
      this.$store.dispatch('SET_ORDER', order);
    },
    selectTradingNote(note) {
      this.$store.dispatch('SET_NOTE_TO_SETTLE_ORDER', note);
    },
    selectUnspentNote(note) {
      this.$store.dispatch('SET_NOTE_TO_MAKE_ORDER', note);
      this.$store.dispatch('SET_NOTE_TO_TAKE_ORDER', note);
    },
    selectSpentNote(note) {}
  },
}
</script>

<style>

</style>
