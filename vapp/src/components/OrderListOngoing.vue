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
          <!-- <td>{{ order.sourceToken | tokenType }}-{{ order.targetToken | tokenType }}</td> -->
          <td>DAI-ETH</td>
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
            <button class="button" @click="settleOrder(order)" :class="{'is-loading': loading }">Settle</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { mapState, mapMutations } from 'vuex';

import { Note, constants } from '../../../scripts/lib/Note';
import Web3Utils from 'web3-utils';
import {
  getNotes,
  addNote,
  generateProof,
  getNoteByNoteHash,
  updateNoteState,
  updateOrderState,
  updateOrderHistoryState,
  getOrderHistory,
} from '../api/index';
import { encode } from 'rlp';

export default {
  data () {
    return {
      order: null,
      loading: false,
    };
  },
  props: ['ongoingOrderHistory'],
  computed: {
    ...mapState({
      accounts: state => state.accounts,
      coinbase: state => state.web3.coinbase,
      dex: state => state.dexContractInstance,
    }),
  },
  methods: {
    ...mapMutations([
      'SET_NOTES',
      'SET_ORDERS',
      'SET_ORDER_HISTORY',
    ]),
    async notes (makerNote, stakeNote) {
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
      this.loading = true;

      this.order = order;

      const makerNote = await getNoteByNoteHash(this.order.orderMaker, this.order.makerNote);
      const stakeNote = await getNoteByNoteHash(this.order.orderMaker, this.order.takerNoteToMaker);
      const { rewardNote, paymentNote, changeNote } = await this.notes(makerNote, stakeNote);

      const proof = await this.proof(makerNote, stakeNote, rewardNote, paymentNote, changeNote);

      const makerNoteValue = Web3Utils.toBN(makerNote.value);
      const stakeNoteValue = Web3Utils.toBN(stakeNote.value);
      const price = Web3Utils.toBN(this.order.price);

      const encoded = encode([
        rewardNote.encrypt(stakeNote.viewingKey),
        paymentNote.encrypt(makerNote.owner),
        (makerNoteValue.mul(price)).cmp(stakeNoteValue) >= 0 ? changeNote.encrypt(makerNote.owner) : changeNote.encrypt(stakeNote.viewingKey),
      ]);
      const tx = await this.dex.settleOrder(order.orderId, ...proof, encoded, {
        from: this.coinbase,
      });

      if (tx.receipt.status) {
        const noteHash1 = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(tx.logs[0].args.note)), 64);
        const noteState1 = Web3Utils.toHex(tx.logs[0].args.state);

        const noteHash2 = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(tx.logs[1].args.note)), 64);
        const noteState2 = Web3Utils.toHex(tx.logs[1].args.state);

        const noteHash3 = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(tx.logs[2].args.note)), 64);
        const noteState3 = Web3Utils.toHex(tx.logs[2].args.state);

        const rewardNoteObject = {};
        rewardNoteObject.owner = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(rewardNote.owner)), 40);
        rewardNoteObject.value = Web3Utils.toHex(Web3Utils.toBN(rewardNote.value));
        rewardNoteObject.token = Web3Utils.toHex(Web3Utils.toBN(rewardNote.token));
        rewardNoteObject.viewingKey = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(rewardNote.viewingKey)), 16);
        rewardNoteObject.salt = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(rewardNote.salt)), 32);
        rewardNoteObject.isSmart = Web3Utils.toHex(Web3Utils.toBN(rewardNote.isSmart));
        rewardNoteObject.hash = noteHash1;
        rewardNoteObject.state = noteState1;
        await addNote(this.order.orderTaker, rewardNoteObject);

        const paymentNoteObject = {};
        paymentNoteObject.owner = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(paymentNote.owner)), 40);
        paymentNoteObject.value = Web3Utils.toHex(Web3Utils.toBN(paymentNote.value));
        paymentNoteObject.token = Web3Utils.toHex(Web3Utils.toBN(paymentNote.token));
        paymentNoteObject.viewingKey = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(paymentNote.viewingKey)), 16);
        paymentNoteObject.salt = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(paymentNote.salt)), 32);
        paymentNoteObject.isSmart = Web3Utils.toHex(Web3Utils.toBN(paymentNote.isSmart));
        paymentNoteObject.hash = noteHash2;
        paymentNoteObject.state = noteState2;
        await addNote(this.order.orderMaker, paymentNoteObject);

        const changeNoteObject = {};
        changeNoteObject.owner = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(changeNote.owner)), 40);
        changeNoteObject.value = Web3Utils.toHex(Web3Utils.toBN(changeNote.value));
        changeNoteObject.token = Web3Utils.toHex(Web3Utils.toBN(changeNote.token));
        changeNoteObject.viewingKey = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(changeNote.viewingKey)), 16);
        changeNoteObject.salt = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(changeNote.salt)), 32);
        changeNoteObject.isSmart = Web3Utils.toHex(Web3Utils.toBN(changeNote.isSmart));
        changeNoteObject.hash = noteHash3;
        changeNoteObject.state = noteState3;

        if ((makerNoteValue.mul(price)).cmp(stakeNoteValue) >= 0) {
          await addNote(this.order.orderMaker, changeNoteObject);
        } else {
          await addNote(this.order.orderTaker, changeNoteObject);
        }

        const noteHash4 = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(tx.logs[3].args.note)), 64);
        const noteState4 = Web3Utils.toHex(tx.logs[3].args.state);
        await updateNoteState(this.order.orderMaker, noteHash4, noteState4);

        const noteHash5 = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(tx.logs[4].args.note)), 64);
        const noteState5 = Web3Utils.toHex(tx.logs[4].args.state);
        await updateNoteState(this.order.orderTaker, noteHash5, noteState5);

        const noteHash6 = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(tx.logs[5].args.note)), 64);
        const noteState6 = Web3Utils.toHex(tx.logs[5].args.state);
        await updateNoteState(this.order.orderMaker, noteHash6, noteState6);

        // order state update
        const order = await this.dex.orders(Web3Utils.toBN(this.order.orderId));
        const orderState = Web3Utils.toHex(order.state);
        const orders = await updateOrderState(
          this.order.orderId,
          orderState,
        );
        this.SET_ORDERS(orders);

        // order history update
        await updateOrderHistoryState(this.order.orderMaker, this.order.orderId, orderState);
        await updateOrderHistoryState(this.order.orderTaker, this.order.orderId, orderState);

        const newNotes = [];
        for (let i = 0; i < this.accounts.length; i++) {
          const n = await getNotes(this.accounts[i].address);
          if (n !== null) {
            newNotes.push(...n);
          }
        }
        this.SET_NOTES(newNotes);

        const orderHistory = [];
        for (let i = 0; i < this.accounts.length; i++) {
          const h = await getOrderHistory(this.accounts[i].address);
          if (h !== null) {
            orderHistory.push(...h);
          }
        }
        this.SET_ORDER_HISTORY(orderHistory);
      }
      this.loading = false;
    },
  },
};
</script>
