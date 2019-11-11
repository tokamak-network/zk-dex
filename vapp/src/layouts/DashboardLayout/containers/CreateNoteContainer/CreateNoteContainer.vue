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
    <button
      @click="createNewNote"
    >
      Create
    </button>
  </div>
</template>

<script>
import InputText from '../../../../components/Inputs/InputText';
import DropdownTokenSelector from '../../../../components/DropdownTokenSelector';

import { mapState } from 'vuex';
import { createNote } from '../../../../helpers/note';
import api from '../../../../api/index';
import Web3Utils from 'web3-utils';

export default {
  data () {
    return {
      account: '',
      amount: '',
      token: '',
    };
  },
  computed: mapState({
    daiContract: state => state.app.daiContract,
    dexContract: state => state.app.dexContract,
    metamaskAccount: state => state.app.metamaskAccount,
  }),
  components: {
    InputText,
    DropdownTokenSelector,
  },
  methods: {
    tokenSelected (token) {
      this.token = token;
    },
    async createNewNote () {
      // create note.
      const note = createNote(this.account, this.amount, this.token.type);

      // generate proof.
      const params = {
        circuit: 'mintNBurnNote',
        params: [note],
      };
      const proof = (await api.generateProof(params)).data.proof;

      // validate proof and make note.
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

      // update vue state.
      note.hash = Web3Utils.padLeft(
        Web3Utils.toHex(Web3Utils.toBN(tx.logs[0].args.note)),
        64
      );
      note.state = Web3Utils.toHex(tx.logs[0].args.state);

      try {
        this.$store.dispatch('addNote', (await api.addNote(this.metamaskAccount, note)));
      } catch (err) {
      } finally {
        this.account = '';
        this.amount = '';
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@import "CreateNoteContainer.scss";
</style>
