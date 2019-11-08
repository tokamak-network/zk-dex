<template>
  <table>
    <thead>
      <tr>
        <th
          v-for="column in columns"
          :key="column.title"
          :style="setWidth(columns)"
        >
          {{ column.title }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        :class="{ clickable }"
        v-for="data in datas"
        @click="selectTableData(data)"
      >
        <td
          v-for="column in columns"
          :key="column.title"
          :style="[setWidth(columns), setColor(column, data)]"
        >
          <div v-if="column.options.includes('action') && data.state === '1' && data.orderMaker === metamaskAccount">
            <button
              @click="clickButton(data)"
            >
              {{ column.action }}
            </button>
          </div>
          <div v-else>
            {{ filterData(column.data, data) }}
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script>
import { mapState } from 'vuex';

import Web3Utils from 'web3-utils';
import { Note } from '../../../../scripts/lib/Note';
import { generateProof } from '../../api/index';

export default {
  data () {
    return {
      columns: [],
    };
  },
  props: {
    clickable: {
      type: Boolean,
      default: false,
    },
    datas: {
      type: Array,
      default: () => [],
    },
    type: {
      type: String,
      default: '',
    },
  },
  computed: mapState({
    dexContract: state => state.app.dexContract,
    metamaskAccount: state => state.app.metamaskAccount,
  }),
  created () {
    this.columns = columns[this.type];
  },
  methods: {
    setWidth (columns) {
      const length = columns.length;
      return {
        width: `${100 / length}%`,
      };
    },
    setColor (column, data) {
      if (column.options.includes('color')) {
        return column.setColor(data);
      }
    },
    selectTableData (data) {
      if (this.clickable) {
        switch (this.type) {
        case 'note':
          this.$bus.$emit('noteSelected', data);
          break;

        case 'orderBook':
          this.$bus.$emit('orderSelected', data);
          break;

        default:
          this.$bus.$emit('tableDataSelected', data);
          break;
        }
      }
    },
    filterData (column, data) {
      const columnData = data[column];

      if (this.type === 'note') {
        const note = data;
        switch (column) {
          case '1':
            return 1;
  
          default:
            return columnData;
        }
      } else if (this.type === 'order') {
        const order = data;
        switch (column) {
          case '1':
            return 1;
  
          default:
            return columnData;
        }
      } else if (this.type === 'ongoingOrder') {
        const order = data;
        switch (column) {
          case 'type': 
            if (this.metamaskAccount === order.orderMaker) {
              return 'Buy';
            } else if (this.metamaskAccount === order.orderTaker) {
              return 'Sell';
            }
            return '';
  
          default:
            return columnData;
        }
      } else if (this.type === 'orderHistory') {
        const order = data;
        switch (column) {
          case 'type': 
            if (this.metamaskAccount === order.orderMaker) {
              return 'Buy';
            } else if (this.metamaskAccount === order.orderTaker) {
              return 'Sell';
            }
            return '';

          case 'change':
            const makerNoteValue = Web3Utils.toBN(order.makerNoteValue);
            const stakeNoteValue = Web3Utils.toBN(order.takerNoteValue);
            const price = Web3Utils.toBN(order.price);

            if ((makerNoteValue.mul(price)).cmp(stakeNoteValue) >= 0) {
              return makerNoteValue.sub(stakeNoteValue.div(price));
            } else {
              return stakeNoteValue.sub(makerNoteValue.mul(price));
            }

          default:
            return columnData;
        }
      } else {
        return columnData;
      }
    },
    clickButton (order) {
      this.$emit('settleOrderRequested', order);  
    },
  },
};

const columns = {
  tradeHistory: [
    {
      title: 'Price (DAI)',
      data: 'price',
      options: [],
      // options: ['color'],
      // setColor: function (type) {
      //   return type === 'buy'
      //     ? { color: '#569aff' }
      //     : { color: '#ff5640' };
      // },
    },
    {
      title: 'Time',
      data: 'timestamp',
      options: [],
    },
  ],
  account: [
    {
      title: 'Index',
      data: 'index',
      options: [],
    },
    {
      title: 'Address',
      data: 'address',
      options: [],
    },
    {
      title: 'Name',
      data: 'name',
      options: [],
    },
    {
      title: 'Total Note',
      data: 'totalNoteAmount',
      options: [],
    },
  ],
  note: [
    {
      title: 'Note Hash',
      data: 'hash',
      options: [],
    },
    {
      title: 'Owner',
      data: 'owner',
      options: [],
    },
    {
      title: 'Token',
      data: 'token',
      options: [],
    },
    {
      title: 'Value',
      data: 'value',
      options: [],
    },
    {
      title: 'State',
      data: 'state',
      options: [],
    },
  ],
  balance: [
    {
      title: 'Currency Name',
      data: 'name',
      options: [],
    },
    {
      title: 'Symbol',
      data: 'symbol',
      options: [],
    },
    {
      title: 'Total Notes',
      data: 'noteAmount',
      options: [],
    },
    {
      title: 'Available Balance',
      data: 'totalBalance',
      options: [],
    },
    // {
    //   title: 'Available Balance',
    //   data: 'availableBalance',
    //   options: [],
    // },
    // {
    //   title: 'Reserved',
    //   data: 'reserved',
    //   options: [],
    // },
    // {
    //   title: 'Total',
    //   data: 'total',
    //   options: [],
    // },
  ],
  noteTransferHistory: [
    {
      title: 'Note Hash',
      data: 'noteHash',
      options: [],
    },
    {
      title: 'Type',
      data: 'type',
      options: [],
    },
    {
      title: 'Token',
      data: 'token',
      options: [],
    },
    {
      title: 'Value',
      data: 'value',
      options: [],
    },
    {
      title: 'From',
      data: 'from',
      options: [],
    },
    {
      title: 'To',
      data: 'to',
      options: [],
    },
    {
      title: 'Change',
      data: 'change',
      options: [],
    },
    {
      title: 'Transaction',
      data: 'transactionHash',
      options: [],
    },
  ],
  ongoingOrder: [
    {
      title: 'Order ID',
      data: 'orderId',
      options: [],
    },
    {
      title: 'Type',
      data: 'type',
      options: [],
    },
    {
      title: 'Price',
      data: 'price',
      options: [],
    },
    {
      title: 'Note Hash',
      data: 'makerNote',
      options: [],
    },
    {
      title: 'Note Amount',
      data: 'makerNoteValue',
      options: [],
    },
    {
      title: 'Received Note Hash',
      data: 'parentNote',
      options: [],
    },
    {
      title: 'Received Note Amount',
      data: 'takerNoteValue',
      options: [],
    },
    {
      title: 'State',
      data: 'state',
      options: [],
    },
    {
      title: 'Action',
      options: ['action'],
      action: 'Settle',
    },
  ],
  orderBook: [
    {
      title: 'Price (DAI)',
      data: 'price',
      options: [],
      // setColor: function (type) {
      //   return type === 'buy'
      //     ? { color: '#569aff' }
      //     : { color: '#ff5640' };
      // },
    },
    {
      title: 'Order ID',
      data: 'orderId',
      options: [],
    },
  ],
  orderHistory: [
    {
      title: 'Order ID',
      data: 'orderId',
      options: [],
    },
    {
      title: 'Type',
      data: 'type',
      options: [],
    },
    {
      title: 'Price',
      data: 'price',
      options: [],
    },
    {
      title: 'DAI Amount',
      data: 'makerNoteValue',
      options: [],
    },
    {
      title: 'ETH Amount',
      data: 'takerNoteValue',
      options: [],
    },
    {
      title: 'Change',
      data: 'change',
      options: [],
    },
    {
      title: 'State',
      data: 'state',
      options: [],
    },
    {
      title: 'Time',
      data: 'timestamp',
      options: [],
    },
  ]
};
</script>

<style lang="scss" scoped>
@import "StandardTable.scss";
</style>
