<template>
  <div class="box">
    <div style="float: left;">
      <p style="margin-left: 10px; margin-bottom: 20px;">Ongoing Orders</p>
    </div>
    <table class="table fixed_header">
      <thead>
        <tr>
          <th>Market</th>
          <th>Order</th>
          <th>Type</th>
          <th>Price</th>
          <th>Note</th>
          <th>Amount</th>
          <th>Note(Received)</th>
          <th>Amount(Received)</th>
          <th>State</th>
          <th>Timestamp</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="order in ongoingOrderHistory">
          <td>{{ order.sourceToken | tokenType }}-{{ order.targetToken | tokenType }}</td>
          <td>{{ order.orderId | hexToNumberString }}</td>
          <td>{{ order.type | orderType }}</td>
          <td>{{ order.price | hexToNumberString }}</td>
          <td>{{ order.makerNote | abbreviate }}</td>
          <td>{{ order.makerNoteAmount | hexToNumberString }}</td>
          <td>{{ order.takerNote | abbreviate }}</td>
          <td>{{ order.takerNoteAmount | hexToNumberString }}</td>
          <td>{{ order.state | orderState }}</td>
          <td>{{ order.timestamp }}</td>
          <td v-if="$route.path === '/exchange' && order.type === '0x0' && order.state === '0x1'">
            <button class="button" @click="settleOrder(order)">Settle</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { mapState } from 'vuex';

import { Note, constants, decrypt } from '../../../scripts/lib/Note';
import Web3Utils from 'web3-utils';
import { generateProof, getNoteByNoteHash, updateNoteState } from '../api/index';
import { encode } from 'rlp';

export default {
  data () {
    return {
      order: null,
    };
  },
  props: ['ongoingOrderHistory'],
  computed: {
    ...mapState({
      coinbase: state => state.web3.coinbase,
      dex: state => state.dexContractInstance,
    }),
  },
  methods: {
    async notes () {
      const makerNote = await getNoteByNoteHash(this.order.orderMaker, this.order.makerNote);
      const stakeNote = await getNoteByNoteHash(this.order.orderMaker, this.order.takerNoteToMaker);

      const makerNoteValue = Web3Utils.toBN(makerNote.value);
      const stakeNoteValue = Web3Utils.toBN(stakeNote.value);
      const price = Web3Utils.toBN(this.order.price);

      let rewardNote;
      let paymentNote;
      let changeNote;

      if ((makerNoteValue.mul(price)).cmp(stakeNoteValue) >= 0) {
        rewardNote = new Note(
          this.order.parentNote,
          stakeNoteValue.div(price),
          this.order.sourceToken,
          '0x0',
          Web3Utils.randomHex(16),
          true
        );
        paymentNote = new Note(
          makerNote.hash,
          stakeNote.value,
          this.order.targetToken,
          '0x0',
          Web3Utils.randomHex(16),
          true
        );
        changeNote = new Note(
          makerNote.hash,
          makerNoteValue.sub(stakeNoteValue.div(price)),
          this.order.sourceToken,
          '0x0',
          Web3Utils.randomHex(16),
          true
        );
      } else {
        rewardNote = new Note(
          this.order.parentNote,
          makerNoteValue,
          this.order.sourceToken,
          '0x0',
          Web3Utils.randomHex(16),
          true
        );
        paymentNote = new Note(
          makerNote.hash,
          makerNoteValue.mul(price),
          this.order.targetToken,
          '0x0',
          Web3Utils.randomHex(16),
          true
        );
        changeNote = new Note(
          this.order.parentNote,
          stakeNoteValue.sub(makerNoteValue.mul(price)),
          this.order.targetToken,
          '0x0',
          Web3Utils.randomHex(16),
          true
        );
      }
      return {
        makerNote,
        stakeNote,
        rewardNote,
        paymentNote,
        changeNote,
      };
    },
    async proof (makerNote, stakeNote, rewardNote, paymentNote, changeNote) {
      const params = {
        circuit: 'settleOrder',
        params: [
          makerNote,
          stakeNote,
          rewardNote,
          paymentNote,
          changeNote,
          this.order.price,
        ],
      };

      const res = await generateProof(params);
      return res.data.proof;
    },
    async settleOrder (order) {
      this.order = order;

      const { makerNote, stakeNote, rewardNote, paymentNote, changeNote } = await this.notes();
      const proof = await this.proof(makerNote, stakeNote, rewardNote, paymentNote, changeNote);
      const encoded = encode([
        rewardNote.encrypt(),
        paymentNote.encrypt(),
        changeNote.encrypt(),
      ]);
      const tx = await this.dex.settleOrder(order.orderId, ...proof, encoded, {
        from: this.coinbase,
      });

      if (tx.receipt.status) {
        alert('success');
        let noteHash;
        let noteState;

        // noteHash = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(tx.logs[0].args.note)), 64);
        // noteState = Web3Utils.toHex(tx.logs[0].args.state);
        // await addNote(orderMaker, noteObject);

        // noteHash = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(tx.logs[1].args.note)), 64);
        // noteState = Web3Utils.toHex(tx.logs[1].args.state);
        // await addNote(orderMaker, noteObject);

        // noteHash = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(tx.logs[2].args.note)), 64);
        // noteState = Web3Utils.toHex(tx.logs[2].args.state);
        // await addNote(orderMaker, noteObject);

        // noteHash = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(tx.logs[3].args.note)), 64);
        // noteState = Web3Utils.toHex(tx.logs[3].args.state);
        // await updateNoteState(noteOwner, noteHash, noteState);

        // noteHash = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(tx.logs[4].args.note)), 64);
        // noteState = Web3Utils.toHex(tx.logs[4].args.state);
        // await updateNoteState(noteOwner, noteHash, noteState);

        // noteHash = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(tx.logs[5].args.note)), 64);
        // noteState = Web3Utils.toHex(tx.logs[5].args.state);
        // await updateNoteState(noteOwner, noteHash, noteState);
      }
    },
  },
};
</script>
