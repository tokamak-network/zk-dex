<template>
  <div class="container">
    <div class="container-header">
      <h3>Convert</h3>
    </div>
    <div class="note-transfer-container">
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
    <div class="button-container">
      <standard-button
        @click.native="convertNote"
        :text="'Convert'"
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
import web3Utils from 'web3-utils';
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
      this.noteHash = this.$options.filters.toNoteHash(note);
      this.noteValue = web3Utils.toBN(note.value);
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
        console.log('failed to unlock');
      }
    },
    async convertNote (note) {
      if (this.loading === true) return;
      this.loading = true;

      const getSalt = () => web3Utils.randomHex(16);
      const { newNote, changeNote } = this.makeNotes(this.note);

      await this.unlockAccount(this.from);

      const convertedNote = new Note(
        this.note.pubKey0, this.note.pubKey1,
        this.note.value,
        this.note.token,
        '1234',
        getSalt(),
      );

      console.log('generating proof...');
      const proof = (await api.generateProof('/convertNote', [
        this.note,
        this.parentNote,
        convertedNote,
      ],
      [
        { userKey: this.userKey, address: this.from },
      ])).data.proof;

      const tx = await this.dexContract.convertNote(
        ...proof,
        convertedNote.encrypt('1234'),
        {
          from: this.metamaskAccount,
        }
      );

      await new Promise(r => setTimeout(r, 1500));

      await this.$store.dispatch('set', ['notes']);
      this.clear();
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
@import "NoteConvertContainer.scss";
</style>
