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
      this.from = this.$options.filters.toZkAddress(note.pubKey0, note.pubKey1);
      this.noteHash = this.$options.filters.toNoteHash(note);
      this.noteValue = Web3Utils.toBN(note.value);
    });
  },
  beforeDestroy () {
    this.$bus.$off('noteSelected', () => {});
  },
  computed: {
    ...mapState([
      'dexContract',
      'userKey',
      'metamaskAccount',
    ]),
  },
  methods: {
    async unlockAccount (address, passphrase = '1234') {
      try {
        await api.unlockAccount(this.userKey, passphrase, address);
      } catch (e) {
        console.log('failed to unlock: ', e.message);
      }
    },
    async transferNote () {
      if (this.loading === true) return;
      this.loading = true;

      console.log(this.from, this.to);
      await this.unlockAccount(this.from);

      const { newNote, changeNote } = this.makeNotes(this.note);

      console.log('generating proof...');
      const proof = (await api.generateProof('/transferNote', [
        this.note,
        null,
        newNote,
        changeNote,
      ],
      [
        { userKey: this.userKey, address: this.from },
        { userKey: null, address: null },
      ])).data.proof;

      const tx = await this.dexContract.spend(
        ...proof,
        newNote.encrypt('1234'),
        changeNote.encrypt('1234'),
        {
          from: this.metamaskAccount,
        }
      );

      console.log(tx);

      // this.clear();
    },
    makeNotes () {
      const oldNote0 = this.note;
      const oldNote1 = null;

      const type = this.note.token;
      const noteAmount = Web3Utils.toBN(this.note.value);
      const wantToTransferAmount = Web3Utils.toBN(Web3Utils.toHex(this.amount));
      if (noteAmount.cmp(wantToTransferAmount) < 0) {
        throw 'invalid amount';
      }
      const change = noteAmount.sub(wantToTransferAmount);

      const pubKey = this.$options.filters.toPubKey(this.to);
      const newNote = new Note(
        pubKey.xToHex(),
        pubKey.yToHex(),
        this.amount,
        type,
        '0x0',
        Web3Utils.randomHex(16)
      );
      console.log(newNote);
      console.log(change);
      const changeNote = new Note(
        oldNote0.pubKey0,
        oldNote0.pubKey1,
        change,
        type,
        '0x0',
        Web3Utils.randomHex(16)
      );
      console.log(changeNote);
      return { newNote, changeNote };
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
