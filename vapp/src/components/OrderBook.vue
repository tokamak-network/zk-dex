<template>
  <div>
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
            <span v-on:click="takeOrder()">TRADE</span>
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
            <span v-on:click="selectNote()">ORDER</span>
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
  </div>
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
  }
]

export default {
  data () {
    return {
      radio: '1',
      orders: [],
      selectedNote: null,
      selectedOrder: null,
      myNotes: [],
      isOrdered: false,
      radioButton: '',
      orderColumns: [
        {
          field: 'type',
          label: 'type',
          centered: true
        },
        {
          field: 'price',
          label: 'price',
          centered: true
        }
      ],
      noteColumns: [
        {
          field: 'status',
          label: 'status',
          centered: true
        },
        {
          field: 'token',
          label: 'token',
          centered: true
        },
        {
          field: 'hash',
          label: 'hash',
          centered: true
        },
        {
          field: 'value',
          label: 'value',
          centered: true
        }
      ]
    }
  },
  created () {
    this.getMyNotes();
    this.orders = this.$store.state.orders;
  },
  computed: {
    sellOrders() {
      return this.orders.filter(order => order.type === 'sell');
    },
    buyOrders() {
      return this.orders.filter(order => order.type === 'buy');
    },
    spentNotes() {
      return this.myNotes.filter(note => note.status === 'spent');
    },
    unspentNotes() {
      return this.myNotes.filter(note => note.status === 'unspent');
    },
    tradingNotes() {
      return this.myNotes.filter(note => note.status === 'trading');
    }
  },
  methods: {
    getMyNotes() {
      this.myNotes = dummyNotes;
    },
    selectOrder() {
      this.selectedNote = null;
      this.$store.dispatch('SET_SELECTED_ORDER', this.selectedOrder);
    },
    selectNote() {
      this.selectedOrder = null;
      this.$store.dispatch('SET_SELECTED_NOTE', this.selectedNote);
    },
    takeOrder() {

    },
    settleOrder() {

    },
    makeOrder() {
      this.isOrdered = true;
    },
    cancelOrder() {
      this.isOrdered = false;
    }
  },
}
</script>

<style>
  .el-col {
    border-radius: 4px;
  }
  .bg-purple-dark {
    background: #99a9bf;
  }
  .bg-purple {
    background: #d3dce6;
  }
  .bg-purple-light {
    background: #e5e9f2;
  }
  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
  .row-bg {
    padding: 10px 0;
    background-color: #f9fafc;
  }
  .fix {
    bottom: 0px;
    right: 0px;
    margin-bottom: 10%;
    margin-right: 10%;
    position: fixed;
  }
</style>
