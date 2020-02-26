<template>
  <div class="container">
    <div class="container-header">
      <img src="../../../../assets/icons/exchange/ongoingorders.png" />
      <h3>Ongoing Orders</h3>
    </div>
    <div class="table-container">
      <standard-table
        v-on:settleOrderRequested="settleOrder"
        :type="'order'"
        :datas="ongoingOrders"
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
        :loading="loading"
      />
    </div>
  </div>
</template>

<script>
// TODO: if header 2 line, weirde tbody
import StandardTable from '../../../../components/StandardTable';

import { mapState, mapGetters } from 'vuex';
import api from '../../../../api/index';
import { toHex } from 'web3-utils';
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
  computed: {
    ...mapState([
      'dexContract',
      'userKey',
      'metamaskAccount',
    ]),
    ...mapGetters([
      'ongoingOrders',
    ]),
  },
  methods: {
    async unlockAccount (address, passphrase = '1234') {
      try {
        await api.unlockAccount(this.userKey, passphrase, address);
      } catch (e) {
        console.log('failed to unlock');
      }
    },
    async settleOrder (order) {
      if (this.loading) return;
      this.loading = true;

      const makerNote = order.makerInfo.makerNote;
      const makerZkAddress = this.$options.filters.toZkAddress(makerNote.pubKey0, makerNote.pubKey1);

      await this.unlockAccount(makerZkAddress);

      console.log('generating proof...');
      const proof = (await api.generateProof('/settleOrder', [
        order.makerInfo.makerNote,
        order.makerInfo.stakeNote,
        order.makerInfo.rewardNote,
        order.makerInfo.paymentNote,
        order.makerInfo.changeNote,
        order.price,
      ], [{
        userKey: this.userKey,
        address: makerZkAddress,
      }])).data.proof;

      const tx = await this.dexContract.settleOrder(
        toHex(order.orderId),
        ...proof,
        encode([
          Note.fromJSON(order.makerInfo.rewardNote).encrypt(order.makerInfo.rewardNoteEncKey),
          Note.fromJSON(order.makerInfo.paymentNote).encrypt(order.makerInfo.paymentNoteEncKey),
          Note.fromJSON(order.makerInfo.changeNote).encrypt(order.makerInfo.changeNoteEncKey),
        ]),
        { from: this.metamaskAccount }
      );

      await new Promise(r => setTimeout(r, 3000));

      await this.$store.dispatch('set', ['notes', 'orders', 'ordersByUser']);
      this.loading = false;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "OrderOngoingContainer.scss";
</style>
