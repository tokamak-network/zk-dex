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
      <button
        @click="liquidateNote"
      >
        Liquidate
      </button>
    </div>
  </div>
</template>

<script>
import InputText from '../../../../components/Inputs/InputText';

import { mapState } from 'vuex';
import Web3Utils from 'web3-utils';
import api from '../../../../api/index';

export default {
  components: {
    InputText,
  },
  data () {
    return {
      account: '',
      noteHash: '',
      noteValue: '',
    }
  },
  computed: mapState({
    dexContract: state => state.app.dexContract,
    metamaskAccount: state => state.app.metamaskAccount,
  }),
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
      const params = {
        circuit: 'mintNBurnNote',
        params: [this.note],
      };
      const proof = (await api.generateProof(params)).data.proof;

      // TODO: this.account must be address type
      const tx = await this.dexContract.liquidate(this.account, ...proof, {
        from: this.metamaskAccount,
      });

      if (!tx.receipt.status) {
        alert('revert transaction');
        return;
      }

      try {
        const noteHash = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(tx.logs[0].args.note)),
          64
        );
        const noteState = Web3Utils.toHex(tx.logs[0].args.state);
        this.$store.dispatch(
          'updateNote',
          (await api.updateNoteState(this.metamaskAccount, noteHash, noteState))
        );
      } catch (err) {
        console.log(err); // TODO: error handling.
      } finally {
        this.clear();
      }
    },
    clear () {
      this.account = '';
      this.note = null;
      this.noteHash = '';
      this.noteValue = '';
    },
  },
}
</script>

<style lang="scss" scoped>
@import "LiquidateNoteContainer.scss";
</style>
