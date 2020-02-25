<template>
  <div class="container">
    <div class="container-header">
      <img src="../../../../assets/icons/exchange/ongoingorders.png" />
      <h3>Ongoing Orders</h3>
    </div>
    <div class="table-container">
      <standard-table
        v-on:settleOrderRequested="settleOrder"
        :type="'ongoingOrder'"
        :datas="$store.state.ordersByUser"
        :columns="[
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
            title: 'ETH Note Hash',
            data: 'ethNoteHash',
            options: [],
          },
          {
            title: 'DAI Note Hash',
            data: 'daiNoteHash',
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
        ]"
        :loading=loading
      />
    </div>
  </div>
</template>

<script>
// TODO: if header 2 line, weirde tbody
import StandardTable from '../../../../components/StandardTable';

import { mapState } from 'vuex';
import Web3Utils from 'web3-utils';
import api from '../../../../api/index';

import { Note } from '../../../../../../scripts/lib/Note';
import { encode } from 'rlp';

export default {
  data () {
    return {
      loading: false,
    };
  },
  components: {
    StandardTable,
  },
  computed: mapState({
    dexContract: state => state.app.dexContract,
    metamaskAccount: state => state.app.metamaskAccount,
  }),
  methods: {
    async settleOrder (order) {
      this.loading = true;
      const makerNote = order.makerNoteObject;
      const takerNote = order.takerNoteObject;
      const stakeNote = order.stakeNoteObject;
      const { rewardNote, paymentNote, changeNote } = this.makeNotes(order);

      const circuit = 'settleOrder';
      const params = [
        makerNote,
        stakeNote,
        rewardNote,
        paymentNote,
        changeNote,
        order.price,
      ];
      const proof = (await api.generateProof(circuit, params)).data.proof;

      const makerNoteValue = Web3Utils.toBN(order.makerNoteValue);
      const stakeNoteValue = Web3Utils.toBN(order.takerNoteValue);
      const price = Web3Utils.toBN(order.price);
      const encoded = encode([
        rewardNote.encrypt(stakeNote.viewingKey),
        paymentNote.encrypt(makerNote.owner),
        (makerNoteValue.mul(price)).cmp(stakeNoteValue) >= 0 ? changeNote.encrypt(makerNote.owner) : changeNote.encrypt(stakeNote.viewingKey),
      ]);

      const tx = await this.dexContract.settleOrder(order.orderId, ...proof, encoded, {
        from: this.metamaskAccount,
      });

      await new Promise(r => setTimeout(r, 5000));

      const notes = await api.getNotes(this.userKey);
      const orders = await api.getOrders();
      const ordersByUser = await api.getOrdersByUser(this.userKey);

      this.$store.dispatch('setNotes', notes);
      this.$store.dispatch('setOrders', orders);
      this.$store.dispatch('setOrdersByUser', ordersByUser);

      this.loading = false;
    },
    makeNotes (order) {
      const makerNoteValue = Web3Utils.toBN(order.makerNoteValue);
      const stakeNoteValue = Web3Utils.toBN(order.takerNoteValue);
      const price = Web3Utils.toBN(order.price);

      let rewardNote;
      let paymentNote;
      let changeNote;

      if ((makerNoteValue.mul(price)).cmp(stakeNoteValue) >= 0) {
        rewardNote = new Note(
          order.parentNote,
          stakeNoteValue.div(price),
          order.sourceToken,
          '0x0',
          Web3Utils.randomHex(8),
          true
        );
        paymentNote = new Note(
          order.makerNote,
          stakeNoteValue,
          order.targetToken,
          '0x0',
          Web3Utils.randomHex(8),
          true
        );
        changeNote = new Note(
          order.makerNote,
          makerNoteValue.sub(stakeNoteValue.div(price)),
          order.sourceToken,
          '0x0',
          Web3Utils.randomHex(8),
          true
        );
      } else {
        rewardNote = new Note(
          order.parentNote,
          makerNoteValue,
          order.sourceToken,
          '0x0',
          Web3Utils.randomHex(8),
          true
        );
        paymentNote = new Note(
          order.makerNote,
          makerNoteValue.mul(price),
          order.targetToken,
          '0x0',
          Web3Utils.randomHex(8),
          true
        );
        changeNote = new Note(
          order.parentNote,
          stakeNoteValue.sub(makerNoteValue.mul(price)),
          order.targetToken,
          '0x0',
          Web3Utils.randomHex(8),
          true
        );
      }
      return {
        rewardNote,
        paymentNote,
        changeNote,
      };
    },
  },
};
</script>

<style lang="scss" scoped>
@import "OrderOngoingContainer.scss";
</style>
