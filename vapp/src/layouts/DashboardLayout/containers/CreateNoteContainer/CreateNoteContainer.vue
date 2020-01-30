<template>
  <div class="container">
    <div class="container-header">
      <img src="../../../../assets/icons/exchange/allnotes.png" />
      <h3>Create Note</h3>
      <dropdown-token-selector
        v-on:tokenSelected="tokenSelected"
      />
    </div>
    <div class="create-note-container">
      <input-text
        :label="'To'"
        :isStaticValue="false"
      >
        <template v-slot:input>
          <input type="text"
            v-model="account"
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
    </div>
    <div class="button-container">
      <standard-button
        :text="'Create'"
        :loading="loading"
        @click.native="createNewNote"
      />
    </div>
  </div>
</template>

<script>
import InputText from '../../../../components/Inputs/InputText';
import DropdownTokenSelector from '../../../../components/DropdownTokenSelector';
import StandardButton from '../../../../components/StandardButton';

import { mapState } from 'vuex';
import { Note } from '../../../../../../scripts/lib/Note';
import api from '../../../../api/index';
import web3Utils from 'web3-utils';

export default {
  data () {
    return {
      account: '',
      amount: '',
      token: '',
      loading: false,
    };
  },
  computed: {
    ...mapState([
      'daiContract',
      'dexcontract',
      'userKey',
      'metamaskAccount',
    ]),
  },
  components: {
    InputText,
    DropdownTokenSelector,
    StandardButton,
  },
  methods: {
    tokenSelected (token) {
      this.token = token;
    },
    async createNewNote () {
      if (this.loading === true) return;
      this.loading = true;

      const getSalt = () => web3Utils.randomHex(16);

      // TODO: set correct parameter
      // Create new note.
      // const note = new Note(owner0, owner1, value, tokenType, '0xdead', getSalt());
      const note = {};

      // Generate proof.
      const circuit = 'mintNBurnNote';
      const params = [note];
      const proof = (await api.generateProof(circuit, params)).data.proof;

      // Validate proof and make note.
      let tx;
      if (this.token.symbol === 'DAI') {
        await this.daiContract.approve(this.dexContract.address, this.amount, {
          from: this.metamaskAccount,
        });
        tx = await this.dexContract.mint(...proof, note.encrypt(note.owner), {
          from: this.metamaskAccount,
        });
      } else if (this.token.symbol === 'ETH') {
        tx = await this.dexContract.mint(...proof, note.encrypt(note.owner), {
          from: this.metamaskAccount,
          value: this.amount,
        });
      }

      if (!tx.receipt.status) {
        alert('revert transaction');
        return;
      }

      await new Promise(r => setTimeout(r, 5000));

      const notes = api.getNotes(this.userKey);
      this.$store.dispatch('setNotes', notes);
    },
  },
};
</script>

<style lang="scss" scoped>
@import "CreateNoteContainer.scss";
</style>
