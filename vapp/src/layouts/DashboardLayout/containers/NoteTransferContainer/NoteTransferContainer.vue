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
    dexContract: state => state.app.dexContract,
    metamaskAccount: state => state.app.metamaskAccount,
  }),
  methods: {
    async transferNote () {
      // NOTE: `to` address must be metamask account address.
      const { paymentNote, changeNote } = this.makeNotes();
      console.log(this.note, paymentNote, changeNote);
      const params = {
        circuit: 'transferNote',
        params: [this.note, null, paymentNote, changeNote],
      };

      const proof = (await api.generateProof(params)).data.proof;
      try {
        const tx = await this.dexContract.spend(
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
    },
    makeNotes () {
      if (this.note.state !== '0x1') {
        alert('invalid note');
        return;
      }
      const type = this.note.token;
      const change = Web3Utils.toBN(this.note.value).sub(Web3Utils.toBN(Web3Utils.toHex(this.amount)))
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
      return { paymentNote, changeNote };
    }
  },
};
</script>

<style lang="scss" scoped>
@import "NoteTransferContainer.scss";
</style>
