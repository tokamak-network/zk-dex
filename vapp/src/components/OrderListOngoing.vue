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
        <tr v-for="order in ongoingOrder">
          <td>{{ order.sourceToken | tokenType }}-{{ order.targetToken | tokenType }}</td>
          <td>{{ order.orderId }}</td>
          <td>{{ order.type }}</td>
          <td>{{ order.price | hexToNumberString }}</td>
          <td>{{ order.makerNote | abbreviate }}</td>
          <td>{{ order.amount | hexToNumberString }}</td>
          <td>{{ order.receivedNote | abbreviate }}</td>
          <td>{{ order.receivedAmount | hexToNumberString }}</td>
          <td>{{ order.state | orderState }}</td>
          <td>{{ order.timestamp }}</td>
          <td v-if="$route.path === '/exchange' && order.type === 'Sell' && order.state === '1'">
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
import { generateProof } from '../api/index';
import { encode } from 'rlp';

export default {
  props: ['ongoingOrder'],
  computed: {
    ...mapState({
      coinbase: state => state.web3.coinbase,
      dex: state => state.dexContractInstance,
    }),
  },
  methods: {
    async notes (order) {
      const makerNote = decrypt(
        await this.dex.encryptedNotes(order.makerNote),
        order.makerViewingKey
      );
      const takerNote = decrypt(
        await this.dex.encryptedNotes(order.parentNote),
        order.makerViewingKey
      );
      const stakeNote = decrypt(
        await this.dex.encryptedNotes(order.takerNoteToMaker),
        order.makerViewingKey
      );

      const change = this.change(makerNote.value, takerNote.value);

      const rewardNote = new Note(
        takerNote.hash(),
        makerNote.value,
        order.sourceToken,
        order.makerViewingKey,
        Web3Utils.randomHex(16),
        true
      );
      const paymentNote = new Note(
        makerNote.hash(),
        takerNote.value,
        order.targetToken,
        order.makerViewingKey,
        Web3Utils.randomHex(16),
        true
      );
      const changeNote = new Note(
        makerNote.hash(),
        change,
        order.sourceToken,
        order.makerViewingKey,
        Web3Utils.randomHex(16),
        true
      );

      return {
        makerNote,
        takerNote,
        stakeNote,
        rewardNote,
        paymentNote,
        changeNote,
      };
    },
    async proof (order, notes) {
      const params = {
        circuit: 'settleOrder',
        params: [
          notes.makerNote,
          notes.stakeNote,
          notes.rewardNote,
          notes.paymentNote,
          notes.changeNote,
          order.price,
        ],
      };

      const res = await generateProof(params);
      return res.data.proof;
    },
    async settleOrder (order) {
      const notes = await this.notes(order);
      const proof = this.proof(order, notes);

      const encoded = encode([
        notes.rewardNote.encrypt(),
        notes.paymentNote.encrypt(),
        notes.changeNote.encrypt(),
      ]);
      const tx = await this.dex.settleOrder(order.orderId, ...proof, encoded, {
        from: this.coinbase,
      });
    },
    change (s, d) {
      return Web3Utils.toBN(d).sub(Web3Utils.toBN(s));
    },
  },
};
</script>
