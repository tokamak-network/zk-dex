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
        :datas="$store.getters.ongoingOrders"
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
  components: {
    StandardTable,
  },
  computed: mapState({
    dexContract: state => state.app.dexContract,
    metamaskAccount: state => state.app.metamaskAccount,
  }),
  methods: {
    async settleOrder (order) {
      const makerNote = order.makerNoteObject;
      const stakeNote = order.stakeNoteObject;
      const { rewardNote, paymentNote, changeNote } = this.makeNotes(order);
      const params = {
        circuit: 'settleOrder',
        params: [
          makerNote,
          stakeNote,
          rewardNote,
          paymentNote,
          changeNote,
          order.price,
        ],
      };
      const proof = (await api.generateProof(params)).data.proof;

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

      try {
        rewardNote.hash = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(tx.logs[0].args.note)),
          64
        );
        rewardNote.state = Web3Utils.toHex(tx.logs[0].args.state);
        // Note: only order maker can settle order.
        await api.addNote(order.orderTaker, rewardNote);
      } catch (err) {}

      try {
        paymentNote.hash = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(tx.logs[1].args.note)),
          64
        );
        paymentNote.state = Web3Utils.toHex(tx.logs[1].args.state);
        this.$store.dispatch('addNote', (await api.addNote(order.orderMaker, paymentNote)));
      } catch (err) {}

      try {
        changeNote.hash = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(tx.logs[2].args.note)),
          64
        );
        changeNote.state = Web3Utils.toHex(tx.logs[2].args.state);
        if ((makerNoteValue.mul(price)).cmp(stakeNoteValue) >= 0) {
          this.$store.dispatch('addNote', (await api.addNote(order.orderMaker, changeNote)));
        } else {
          this.$store.dispatch('addNote', order.orderTaker, changeNote);
        }
      } catch (err) {}

      try {
        const noteHash = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(tx.logs[3].args.note)),
          64
        );
        const noteState = Web3Utils.toHex(tx.logs[3].args.state);
        this.$store.dispatch(
          'updateNote',
          (await api.updateNoteState(order.orderMaker, noteHash, noteState))
        );
      } catch (err) {
        console.log(err); // TODO: error handling.
      }

      try {
        const noteHash = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(tx.logs[4].args.note)),
          64
        );
        const noteState = Web3Utils.toHex(tx.logs[4].args.state);
        this.$store.dispatch(
          'updateNote',
          (await api.updateNoteState(order.orderTaker, noteHash, noteState))
        );
      } catch (err) {
        console.log(err); // TODO: error handling.
      }

      try {
        const noteHash = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(tx.logs[5].args.note)),
          64
        );
        const noteState = Web3Utils.toHex(tx.logs[5].args.state);
        this.$store.dispatch(
          'updateNote',
          (await api.updateNoteState(order.orderMaker, noteHash, noteState))
        );
      } catch (err) {
        console.log(err); // TODO: error handling.
      }

      try {
        const orderId = Web3Utils.toHex(tx.logs[6].args.orderId);
        order.state = (await this.dexContract.orders(orderId)).state;
        order.timestamp = new Date().getTime();
  
        this.$store.dispatch(
          'updateOrder',
          (await api.updateOrder(orderId, order))
        );
      } catch (err) {}
    },
    makeNotes (order, makerNote, takerNote, stakeNote) {
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
