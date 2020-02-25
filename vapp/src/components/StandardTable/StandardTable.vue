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
          <div v-if="column.options.includes('action') && data.state === '1' && data.makerInfo.makerUserKey === userKey">
            <div class="button-container">
              <standard-button
                @click.native="clickButton(data)"
                :text="'Settle'"
                :loading="loading"
              />
            </div>
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
import { ZkDexPublicKey } from 'zk-dex-keystore/lib/Account';

import StandardButton from '../StandardButton';

export default {
  components: {
    StandardButton,
  },
  props: {
    clickable: {
      type: Boolean,
      default: false,
    },
    columns: {
      type: Array,
      default: () => [],
    },
    datas: {
      type: Array,
      default: () => [],
    },
    type: {
      type: String,
      default: '',
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    ...mapState([
      'dexContract',
      'userKey',
      'metamaskAccount',
    ]),
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
      if (this.type === 'account') {
        switch (column) {
        case 'index':
          return this.datas.indexOf(data);
        case 'numNotes':
          const address = data;
          return this.$store.getters.numNotes(address);

        default:
          return data;
        }
      } else if (this.type === 'note') {
        const note = data;
        switch (column) {
        case 'noteHash':
          const noteHash = this.$options.filters.toNoteHash(note);
          // return this.$options.filters.hexSlicer(noteHash);
          return noteHash;

        case 'owner':
          return (new ZkDexPublicKey(note.pubKey0, note.pubKey1)).toAddress().toString();

        case 'token':
          const type = parseInt(columnData);
          if (type === 0) return 'ETH';
          else if (type === 1) return 'DAI';

        case 'value':
          return parseInt(columnData);

        case 'state':
          const state = parseInt(columnData);
          if (state === 0) return 'Invalid';
          else if (state === 1) return 'Valid';
          else if (state === 2) return 'Traiding';
          else if (state === 3) return 'Spent';

        default:
          return columnData;
        }
      } else if (this.type === 'balance') {
        switch (column) {
        case 'totalBalance':
          return parseInt(columnData);

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
      } else if (this.type === 'orderBook') {
        switch (column) {
        case 'orderId':
          return parseInt(columnData);

        case 'price':
          return parseInt(`0x${columnData}`);

        default:
          return columnData;
        }
      } else if (this.type === 'ongoingOrder') {
        const order = data;
        switch (column) {
        case 'orderId':
          return parseInt(columnData);

        case 'price':
          return parseInt(`0x${columnData}`);

        case 'type':
          if (this.userKey === order.makerInfo.makerUserKey) {
            return 'Sell';
          } else if (this.userKey === order.takerInfo.takerUserKey) {
            return 'Buy';
          }
          return '';

        case 'ethNoteHash':
          if (order.sourceToken === '0') {
            return order.makerNote;
          } else {
            if (!order.taken) return '-';
            return order.takerNoteToMaker;
          }

        case 'daiNoteHash':
          if (order.sourceToken === '1') {
            return order.makerNote;
          } else {
            if (!order.taken) return '-';
            return order.takerNoteToMaker;
          }

        case 'state':
          const state = parseInt(columnData);
          if (state === 0) return 'Created';
          else if (state === 1) return 'Taken';
          else if (state === 2) return 'Settled';

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

        case 'orderId':
        case 'makerNoteValue':
        case 'takerNoteValue':
          if (!columnData) return '';
          return parseInt(columnData);

        case 'state':
          const state = parseInt(columnData);
          if (state === 0) return 'Created';
          else if (state === 1) return 'Taken';
          else if (state === 2) return 'Settled';

        case 'change':
          const makerNoteValue = Web3Utils.toBN(order.makerNoteValue);
          const stakeNoteValue = Web3Utils.toBN(order.takerNoteValue);
          const price = Web3Utils.toBN(order.price);

          if ((makerNoteValue.mul(price)).cmp(stakeNoteValue) >= 0) {
            return makerNoteValue.sub(stakeNoteValue.div(price));
          } else {
            return stakeNoteValue.sub(makerNoteValue.mul(price));
          }

        case 'timestamp':
          if (!columnData) return '';
          return this.timeConverter(columnData);

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
    timeConverter (timestamp) {
      const a = new Date(timestamp * 1000);
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const year = a.getFullYear();
      const month = months[a.getMonth()];
      const date = a.getDate();
      const hour = a.getHours();
      const min = a.getMinutes();
      const sec = a.getSeconds();
      const time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec;
      return time;
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
  ],
};
</script>

<style lang="scss" scoped>
@import "StandardTable.scss";
</style>
