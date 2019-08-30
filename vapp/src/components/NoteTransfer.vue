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
        <input v-if="!isSelfTransfer" style="width: 100%; text-align: right;" class="input" type="text" v-model="account">
        <b-select v-else placeholder="Select Account" v-model="account">
          <option v-for="account in accounts">
            {{ account.address }} {{ account.name }}
          </option>
        </b-select>
      </p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          Amount
        </a>
      </p>
      <p class="control is-expanded">
        <input style="width: 100%; text-align: right;" class="input" type="text" v-model="amount" @keypress="onlyNumber">
      </p>
    </div>
    <div style="margin-top: 10px; display: flex; justify-content: flex-end">
      <button class="button" @click="transferNote" :class="{ 'is-static': noteHash === '' || amount === '', 'is-loading': loading }">Transfer</button>
    </div>
  </div>
</template>

<script>
import { mapState, mapMutations } from 'vuex';

import Web3Utils from 'web3-utils';
import { Note } from '../../../scripts/lib/Note';
import {
  getNotes,
  getTransferNotes,
  addNote,
  addTransferNote,
  updateNoteState,
  generateProof,
} from '../api/index';

export default {
  data () {
    return {
      loading: false,
      note: '',
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
      accounts: state => state.accounts,
      coinbase: state => state.web3.coinbase,
      dex: state => state.dexContractInstance,
      viewingKey: state => state.viewingKey,
    }),
  },
  created () {
    this.$bus.$on('select-note', this.selectNote);
  },
  beforeDestroy () {
    this.$bus.$off('select-note');
  },
  methods: {
    ...mapMutations([
    onlyNumber () {
      if (event.keyCode < 48 || event.keyCode > 57) {
        event.returnValue = false;
      }
    selectNote (note) {
      this.note = note;
      this.noteOwner = Web3Utils.padLeft(
        Web3Utils.toHex(Web3Utils.toBN(note.owner)),
        40
      );
      this.noteHash = note.hash;
      this.noteValue = note.value;
      if (this.isSelfTransfer) {
        this.account = this.noteOwner;
      } else {
        this.account = '';
      }
    },
    notes () {
      if (this.note.state !== '0x1') {
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
        '0x0',
        Web3Utils.randomHex(16)
      );
      const note2 = new Note(
        this.note.owner,
        change,
        type,
        '0x0',
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
        notes.note1.encrypt(notes.note1.owner),
        notes.note2.encrypt(notes.note2.owner),
        { from: this.coinbase }
      );

      // 1. update note
      const noteOwner = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(this.note.owner)), 40);
      const noteHash = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(tx.logs[0].args.note)), 64);
      const noteState = Web3Utils.toHex(tx.logs[0].args.state);
      await updateNoteState(noteOwner, noteHash, noteState);

      // 2. add note1
      const noteHash1 = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(tx.logs[1].args.note)), 64);
      const noteState1 = Web3Utils.toHex(tx.logs[1].args.state);
      const noteObject1 = {};
      noteObject1.owner = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(notes.note1.owner)), 40);
      noteObject1.value = Web3Utils.toHex(Web3Utils.toBN(notes.note1.value));
      noteObject1.token = Web3Utils.toHex(Web3Utils.toBN(notes.note1.token));
      noteObject1.viewingKey = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(notes.note1.viewingKey)), 16);
      noteObject1.salt = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(notes.note1.salt)), 32);
      noteObject1.isSmart = Web3Utils.toHex(Web3Utils.toBN(notes.note1.isSmart));
      noteObject1.hash = noteHash1;
      noteObject1.state = noteState1;
      await addNote(noteObject1.owner, noteObject1);

      // 3. add note2
      const noteHash2 = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(tx.logs[2].args.note)), 64);
      const noteState2 = Web3Utils.toHex(tx.logs[2].args.state);
      const noteObject2 = {};
      noteObject2.owner = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(notes.note2.owner)), 40);
      noteObject2.value = Web3Utils.toHex(Web3Utils.toBN(notes.note2.value));
      noteObject2.token = Web3Utils.toHex(Web3Utils.toBN(notes.note2.token));
      noteObject2.viewingKey = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(notes.note2.viewingKey)), 16);
      noteObject2.salt = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(notes.note2.salt)), 32);
      noteObject2.isSmart = Web3Utils.toHex(Web3Utils.toBN(notes.note2.isSmart));
      noteObject2.hash = noteHash2;
      noteObject2.state = noteState2;
      await addNote(noteObject2.owner, noteObject2);

      // transfer note1
      const transferNote1 = this.note;
      transferNote1.type = '0x0'; // 0x0: send, 0x1: receive
      transferNote1.from = noteOwner;
      transferNote1.to = this.account;
      transferNote1.change = Web3Utils.toHex(this.change(this.amount));
      transferNote1.value = Web3Utils.toHex(this.amount);
      transferNote1.transactionHash = tx.receipt.transactionHash;
      await addTransferNote(noteOwner, transferNote1);

      // transfer note2
      const transferNote2 = noteObject1;
      transferNote2.type = '0x1';
      transferNote2.from = '',
      transferNote2.to = this.account;
      transferNote2.change = '',
      transferNote2.value = Web3Utils.toHex(this.amount);
      transferNote2.transactionHash = tx.receipt.transactionHash;
      await addTransferNote(this.account, transferNote2);

      const newNotes = [];
      for (let i = 0; i < this.accounts.length; i++) {
        const n = await getNotes(this.accounts[i].address);
        if (n !== null) {
          newNotes.push(...n);
        }
      }
      this.SET_NOTES(newNotes);

      const newTransferNotes = [];
      for (let i = 0; i < this.accounts.length; i++) {
        const n = await getTransferNotes(this.accounts[i].address);
        if (n !== null) {
          newTransferNotes.push(...n);
        }
      }
      this.SET_TRANSFER_NOTES(newTransferNotes);

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
