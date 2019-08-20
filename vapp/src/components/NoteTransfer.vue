<template>
  <div class="box">
    <div style="float: left;">
      <p style="margin-left: 10px; margin-bottom: 20px;">Transfer</p>
    </div>
    <div class="block" style="display: flex; justify-content: flex-end">
      <b-switch v-model="isSelfTransfer">self-transfer</b-switch>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          From
        </a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">
          {{ noteOwner }}
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
          Note Amount
        </a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">
          {{ noteValue | hexToNumberString }}
        </a>
      </p>
    </div>
    <div class="field has-addons" style="margin-top: 40px;">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          To
        </a>
      </p>
      <p class="control is-expanded">
        <input style="width: 100%; text-align: right;" class="input" type="text" v-model="account">
      </p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          Amount
        </a>
      </p>
      <p class="control is-expanded">
        <input style="width: 100%; text-align: right;" class="input" type="text" v-model="amount">
      </p>
    </div>
    <div style="margin-top: 10px; display: flex; justify-content: flex-end">
      <button class="button" @click="transferNote" :class="{ 'is-static': noteHash === '' || amount === '', 'is-loading': loading }">Transfer</button>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';

import Web3Utils from 'web3-utils';
import { Note } from '../../../scripts/lib/Note';
import {
  addNote,
  addTransferNote,
  updateNote,
  generateProof,
} from '../api/index';

export default {
  data () {
    return {
      loading: false,
      noteOwner: '',
      noteHash: '',
      noteValue: '',
      account: '',
      amount: '',
      isSelfTransfer: false,
    };
  },
  computed: {
    ...mapState({
      coinbase: state => state.web3.coinbase,
      note: state => state.note,
      dex: state => state.dexContractInstance,
      viewingKey: state => state.viewingKey,
    }),
  },
  mounted () {
    this.$store.watch(
      (state, getters) => getters.note,
      () => {
        this.noteOwner = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(this.note.owner)),
          20
        );
        this.noteHash = this.note.hash;
        this.noteValue = this.note.value;
        if (this.isSelfTransfer) {
          this.account = this.noteOwner;
        }
      }
    );
  },
  methods: {
    notes () {
      if (this.note.state !== '1') {
        alert('invalid note');
        return null;
      }
      if (
        !this.isValidAccount(this.account) ||
        !this.isValidAmount(this.amount)
      ) {
        alert('invalid account(or amount)');
        return null;
      }
      const type = this.note.token;
      const change = this.change(this.amount);
      const note1 = new Note(
        this.account,
        this.amount,
        type,
        this.viewingKey,
        Web3Utils.randomHex(16)
      );
      const note2 = new Note(
        this.note.owner,
        change,
        type,
        this.viewingKey,
        Web3Utils.randomHex(16)
      );

      return { note1, note2 };
    },
    async proof (oldNote, newNote1, newNote2) {
      const params = {
        circuit: 'transferNote',
        params: [oldNote, newNote1, newNote2],
      };

      const res = await generateProof(params);
      return res.data.proof;
    },
    async transferNote () {
      this.loading = true;

      const notes = this.notes();
      if (this.notes() === null) {
        this.loading = false;
        return;
      }

      const proof = await this.proof(this.note, notes.note1, notes.note2);

      const tx = await this.dex.spend(
        ...proof,
        notes.note1.encrypt(),
        notes.note2.encrypt(),
        { from: this.coinbase }
      );

      const hash1 = tx.logs[0].args.note;
      const state1 = Web3Utils.hexToNumberString(
        Web3Utils.toHex(tx.logs[0].args.state)
      );
      this.note.hash = hash1;
      this.note.state = state1;
      const noteOwner = Web3Utils.padLeft(
        Web3Utils.toHex(Web3Utils.toBN(this.note.owner)),
        20
      );
      await updateNote(noteOwner, this.note);

      const hash2 = tx.logs[1].args.note;
      const state2 = Web3Utils.hexToNumberString(
        Web3Utils.toHex(tx.logs[1].args.state)
      );
      notes.note1.hash = hash2;
      notes.note1.state = state2;
      await addNote(this.account, notes.note1);

      const hash3 = tx.logs[2].args.note;
      const state3 = Web3Utils.hexToNumberString(
        Web3Utils.toHex(tx.logs[2].args.state)
      );
      notes.note2.hash = hash3;
      notes.note2.state = state3;
      await addNote(noteOwner, notes.note2);

      const transferNote1 = this.note;
      transferNote1.type = 'Send';
      transferNote1.from = noteOwner;
      transferNote1.to = this.account;
      transferNote1.change = Web3Utils.hexToNumberString(Web3Utils.toHex(this.change(this.amount)));
      transferNote1.value = Web3Utils.hexToNumberString(Web3Utils.toHex(this.amount));
      transferNote1.transactionHash = tx.receipt.transactionHash;
      await addTransferNote(noteOwner, transferNote1);

      const transferNote2 = notes.note1;
      transferNote2.type = 'Receive';
      transferNote2.from = '',
      transferNote2.to = this.account;
      transferNote2.change = '',
      transferNote2.value = Web3Utils.hexToNumberString(Web3Utils.toHex(this.amount));
      transferNote2.transactionHash = tx.receipt.transactionHash;
      await addTransferNote(this.account, transferNote2);

      this.loading = false;
      this.$router.push({ path: '/' });
    },
    change (amount) {
      return Web3Utils.toBN(this.note.value).sub(Web3Utils.toBN(amount));
    },
    isValidAccount (account) {
      return Web3Utils.isAddress(account);
    },
    isValidAmount (amount) {
      const fromAmount = Web3Utils.toBN(this.note.value);
      const toAmount = Web3Utils.toBN(amount);

      return fromAmount.cmp(toAmount) >= 0 ? true : false;
    },
  },
};
</script>
