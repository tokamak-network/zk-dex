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
        :label="'Amount'"
        :isStaticValue="false"
      >
        <template v-slot:input>
          <input type="text"
            v-model="amount"
          />
        </template>
      </input-text>
    <div class="button-container">
      <standard-button
        @click.native="transferNote"
        :text="'Transfer'"
        :loading="loading"
      />
    </div>
    </div>
  </div>
</template>

<script>
import InputText from '../../../../components/Inputs/InputText';
import StandardButton from '../../../../components/StandardButton';

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
      loading: false,
    };
  },
  components: {
    InputText,
    StandardButton,
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
      if (this.loading === true) return;
      this.loading = true;

      const { originalNote, paymentNote, changeNote } = this.makeNotes(this.note);

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

      await new Promise(r => setTimeout(r, 5000));

      const notes = await api.getNotes(this.userKey);
      const histories = await api.getNoteTransferHistories(this.userKey);

      this.$store.dispatch('setNotes', notes);
      this.$store.dispatch('setNoteTransferHistories', histories);

      this.clear();
    },
    makeNotes (originalNote) {
      if (this.note.state !== '0x1') {
        throw 'invalid note state';
      }
      const type = this.note.token;
      const noteAmount = Web3Utils.toBN(this.note.value);
      const wantToTransferAmount = Web3Utils.toBN(Web3Utils.toHex(this.amount));
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
    clear () {
      this.note = null;
      this.from = '';
      this.noteHash = '';
      this.noteValue = '';
      this.to = '';
      this.amount = '';
      this.loading = false;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "NoteTransferContainer.scss";
</style>
