<template>
  <div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          Order id
        </a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">
          {{ orderId }}
        </a>
      </p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          Price
        </a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">
          {{ orderPrice | hexToNumberString }}
        </a>
      </p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          Note
        </a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">
          {{ noteHash | abbreviate }}
        </a>
      </p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          Note amount
        </a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">
          {{ noteValue | hexToNumberString }}
        </a>
      </p>
    </div>
    <div style="margin-top: 10px; display: flex; justify-content: flex-end">
      <button class="button" @click="takeOrder" :class="{ 'is-static': orderId === '' || noteHash === '', 'is-loading': loading }">Take Order</button>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import { constants, decrypt, Note } from '../../../scripts/lib/Note';
import Web3Utils from 'web3-utils';
import {
  getOrder,
  addNote,
  addOrderByAccount,
  addOrder,
  generateProof,
  updateNote,
  updateOrderByAccount,
  updateOrder,
} from '../api/index';

export default {
  data () {
    return {
      loading: false,
      orderId: '',
      orderPrice: '',
      noteHash: '',
      noteValue: '',
      salt: null,
    };
  },
  computed: {
    ...mapState({
      coinbase: state => state.web3.coinbase,
      viewingKey: state => state.viewingKey,
      note: state => state.note,
      order: state => state.order,
      dex: state => state.dexContractInstance,
    }),
  },
  created () {
    this.salt = Web3Utils.randomHex(16);
  },
  mounted () {
    this.$store.watch(
      (state, getters) => getters.note,
      () => {
        this.noteHash = this.note.hash;
        this.noteValue = this.note.value;
      }
    );
    this.$store.watch(
      (state, getters) => getters.order,
      () => {
        this.orderId = this.order.orderId;
        this.orderPrice = this.order.price;
      }
    );
  },
  methods: {
    stakeNote () {
      const stakeNote = new Note(
        this.order.makerNote,
        this.note.value,
        this.order.targetToken,
        this.order.makerViewingKey,
        this.salt,
        true
      );
      return stakeNote;
    },
    takerNote () {
      const note = this.note;
      delete note.hash;
      delete note.state;

      return note;
    },
    async proof () {
      const takerNote = this.takerNote();
      const stakeNote = this.stakeNote();
      const params = {
        circuit: 'takeOrder',
        params: [this.order.makerNote, takerNote, stakeNote],
      };
      const res = await generateProof(params);

      return res.data.proof;
    },
    async takeOrder () {
      this.loading = true;

      const takerNote = this.takerNote();
      const stakeNote = this.stakeNote();
      const proof = await this.proof();
      const tx = await this.dex.takeOrder(
        this.order.orderId,
        ...proof,
        stakeNote.encrypt(),
        {
          from: this.coinbase,
        }
      );

      if (tx.receipt.status) {
        const taker = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(takerNote.owner)),
          20
        );
        const maker = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(this.order.orderMaker)),
          20
        );

        const hash1 = tx.logs[0].args.note;
        const state1 = Web3Utils.hexToNumberString(
          Web3Utils.toHex(tx.logs[0].args.state)
        );
        takerNote.hash = hash1;
        takerNote.state = state1;
        await updateNote(taker, takerNote);
        this.$parent.$emit('updateNote', takerNote);

        const hash2 = tx.logs[1].args.note;
        const state2 = Web3Utils.hexToNumberString(
          Web3Utils.toHex(tx.logs[1].args.state)
        );
        stakeNote.hash = hash2;
        stakeNote.state = state2;
        await addNote(maker, stakeNote);
        this.$parent.$emit('addNote', stakeNote);
        // TODO: if taking order occurs between same accounts, it is not reflect view.

        const order = await getOrder(this.order.orderId);
        order.state = '1';
        await updateOrderByAccount(maker, order);
        this.$parent.$emit('updateOrder', order);

        order.type = 'Buy';
        order.orderTaker = taker;
        order.receivedNote = takerNote.hash;
        order.receivedAmount = takerNote.value;
        order.timestamp = new Date().getTime();
        await updateOrder(order);
        await addOrderByAccount(taker, order);
        this.$parent.$emit('addNewOrderOngoingHistory', order);
      } else {}

      this.loading = false;
      this.clear();
    },
    clear () {
      this.orderId = '';
      this.orderPrice = '';
      this.noteHash = '';
      this.noteValue = '';
    },
  },
};
</script>

<style>
</style>
