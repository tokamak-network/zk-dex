<template>
  <div class="container">
    <!-- TODO: all png logo must be 24px , 24px -->
    <div class="container-header">
      <img src="../../../../assets/icons/exchange/allnotes.png" />
      <h3>Liquidate Note</h3>
    </div>
    <div class="input-text-container">
      <input-text
        :label="'Account'"
        :isStaticValue="false"
      >
        <template v-slot:input>
          <input type="text"
            v-model="account"
          />
        </template>
      </input-text>
      <input-text
        :label="'Note'"
        :isStaticValue="true"
        :value="noteHash"
      />
      <input-text
        :label="'Note Amount'"
        :value="noteValue"
        :isStaticValue="true"
      />
      <div class="button-container">
        <standard-button
          @click.native="liquidateNote"
          :text="'Liquidate'"
          :loading="loading"
        />
      </div>
    </div>
  </div>
</template>

<script>
import InputText from '../../../../components/Inputs/InputText';
import StandardButton from '../../../../components/StandardButton';

import { mapState } from 'vuex';
import Web3Utils from 'web3-utils';
import api from '../../../../api/index';

export default {
  components: {
    InputText,
    StandardButton,
  },
  data () {
    return {
      account: '',
      noteHash: '',
      noteValue: '',
      loading: false,
    };
  },
  computed: {
    ...mapState([
      'dexcontract',
      'metamaskAccount',
    ]),
  },
  created () {
    this.$bus.$on('noteSelected', (note) => {
      this.note = note;
      this.noteHash = note.hash;
      this.noteValue = Web3Utils.toBN(note.value);
    });
  },
  beforeDestroy () {
    this.$bus.$off('noteSelected', () => {});
  },
  methods: {
    async liquidateNote () {
      if (this.loading) return;
      this.loading = true;

      const circuit = 'mintNBurnNote';
      const params = [this.note];
      const proof = (await api.generateProof(circuit, params)).data.proof;

      // TODO: this.account must be address type
      const tx = await this.dexContract.liquidate(this.account, ...proof, {
        from: this.metamaskAccount,
      });

      if (!tx.receipt.status) {
        alert('revert transaction');
        return;
      }

      await new Promise(r => setTimeout(r, 5000));

      const notes = await api.getNotes(this.userKey);
      this.$store.dispatch('setNotes', notes);

      this.clear();
    },
    clear () {
      this.account = '';
      this.note = null;
      this.noteHash = '';
      this.noteValue = '';
      this.loading = false;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "LiquidateNoteContainer.scss";
</style>
