<template>
  <div class="container">
    <div class="container-header">
      <h3>Transfer</h3>
    </div>
    <div class="note-transfer-container">
      <input-text
        :label="'From'"
        :isStaticValue="true"
        :value="from"
      />
      <input-text
        :label="'Note'"
        :isStaticValue="true"
        :value="noteHash"
      />
      <input-text
        :label="'Note Amount'"
        :isStaticValue="true"
        :value="noteValue"
      />
      <input-text
        :label="'To'"
        :isStaticValue="false"
      >
        <template v-slot:input>
          <input type="text"
            v-model="to"
          />
        </template>
      </input-text>
      <input-text
        :label="'Note'"
        :isStaticValue="false"
      >
        <template v-slot:input>
          <input type="text"
            v-model="amount"
          />
        </template>
      </input-text>
    </div>
    <button @click="transferNote">Transfer</button>
  </div>
</template>

<script>
import InputText from '../../../../components/Inputs/InputText';

import { Note } from '../../../../../../scripts/lib/Note';
import { mapState } from 'vuex';
import Web3Utils from 'web3-utils';
import api from '../../../../api/index';

export default {
  data () {
    return {
      note: null,
      from: '',
      noteHash: '',
      noteValue: '',
      to: '',
      amount: '',
    };
  },
  components: {
    InputText,
  },
  created () {
    this.$bus.$on('noteSelected', (note) => {
      this.note = note;
      this.from = note.owner;
      this.noteHash = note.hash;
      this.noteValue = Web3Utils.toBN(note.value);
    });
  },
  beforeDestroy () {
    this.$bus.$off('noteSelected', () => {});
  },
  computed: mapState({
    accounts: state => state.account.accounts,
    dexContract: state => state.app.dexContract,
    metamaskAccount: state => state.app.metamaskAccount,
  }),
  methods: {
    async transferNote () {
      let notes;
      try {
        notes = this.makeNotes(this.note);
      } catch (err) {
        return alert(err);
      }
      const originalNote = notes.originalNote;
      const paymentNote = notes.paymentNote;
      const changeNote = notes.changeNote;

      const circuit = 'transferNote';
      const params = [originalNote, paymentNote, changeNote, null];
      const proof = (await api.generateProof(circuit, params)).data.proof;

      let tx;
      try {
        tx = await this.dexContract.spend(
          ...proof,
          paymentNote.encrypt(paymentNote.owner),
          changeNote.encrypt(changeNote.owner),
          {
            from: this.metamaskAccount,
          }
        );
      } catch (err) {
        console.log('err:', err);
      }

      if (!tx.receipt.status) {
        alert('revert transaction');
        return;
      }

      // 1. add note transfer history.
      await api.addNoteTransferHistory(notes);

      // 2. update note state.
      try {
        const noteHash = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(tx.logs[0].args.note)),
          64
        );
        const noteState = Web3Utils.toHex(tx.logs[0].args.state);
        originalNote.hash = noteHash;
        originalNote.state = noteState;
        await api.updateNote(this.metamaskAccount, originalNote);
      } catch (err) {
        console.log(err); // TODO: error handling.
      }

      try {
        const noteHash = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(tx.logs[1].args.note)),
          64
        );
        const noteState = Web3Utils.toHex(tx.logs[1].args.state);
        paymentNote.hash = noteHash;
        paymentNote.state = noteState;
        await api.addNote(this.to, paymentNote);
      } catch (err) {
        console.log(err); // TODO: error handling.
      }

      try {
        const noteHash = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(tx.logs[2].args.note)),
          64
        );
        const noteState = Web3Utils.toHex(tx.logs[2].args.state);
        changeNote.hash = noteHash;
        changeNote.state = noteState;
        await api.addNote(this.metamaskAccount, changeNote);
      } catch (err) {
        console.log(err); // TODO: error handling.
      }

      // 3. get note transfer histories.
      let allHistories = [];
      for (const account of this.accounts) {
        const histories = await api.getNoteTransferHistories(account.address);
        allHistories = allHistories.concat(histories);
      }
      this.$store.dispatch('setNoteTransferHistories', allHistories);

      // 4. get notes.
      if (notes !== null) {
        this.$store.dispatch('setNotes', (await api.getNotes(this.metamaskAccount)));
      }

      this.clear();
    },
    makeNotes (originalNote) {
      if (this.note.state !== '0x1') {
        throw 'invalid note state';
      }
      const type = this.note.token;
      const noteAmount = Web3Utils.toBN(this.note.value);
      const wantToTransferAmount = Web3Utils.toBN(Web3Utils.toHex(this.amount))
      if (noteAmount.cmp(wantToTransferAmount) < 0) {
        throw 'invalid amount';
      }

      const change = noteAmount.sub(wantToTransferAmount);
      const paymentNote = new Note(
        this.to,
        this.amount,
        type,
        '0x0',
        Web3Utils.randomHex(16)
      );
      const changeNote = new Note(
        this.note.owner,
        change,
        type,
        '0x0',
        Web3Utils.randomHex(16)
      );
      return { originalNote, paymentNote, changeNote };
    },
    clear() {
      this.note = null;
      this.from = '';
      this.noteHash = '';
      this.noteValue = '';
      this.to = '';
      this.amount = '';
    },
  },
};
</script>

<style lang="scss" scoped>
@import "NoteTransferContainer.scss";
</style>
