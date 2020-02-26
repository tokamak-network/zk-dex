<template>
  <div class="container">
    <!-- TODO: all png logo must be 24px , 24px -->
    <div class="container-header">
      <img src="../../../../assets/icons/exchange/allnotes.png" />
      <h3>Liquidate Note</h3>
    </div>
    <div class="input-text-container">
      <input-text
        :label="'Owner'"
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
      note: '',
      account: '',
      noteHash: '',
      noteValue: '',
      loading: false,
    };
  },
  computed: {
    ...mapState([
      'userKey',
      'dexContract',
      'metamaskAccount',
    ]),
  },
  created () {
    this.$bus.$on('noteSelected', (note) => {
      this.note = note;
      this.noteHash = this.$options.filters.toNoteHash(note);
      this.noteValue = Web3Utils.toBN(note.value);
    });
  },
  beforeDestroy () {
    this.$bus.$off('noteSelected', () => {});
  },
  methods: {
    async unlockAccount (address, passphrase = '1234') {
      try {
        await api.unlockAccount(this.userKey, passphrase, address);
      } catch (e) {
        console.log('failed to unlock');
      }
    },
    async liquidateNote () {
      if (this.loading) return;
      this.loading = true;

      const zkAddress = this.$options.filters.toZkAddress(this.note.pubKey0, this.note.pubKey1);
      await this.unlockAccount(zkAddress);

      console.log('generating proof...');
      const proof = (await api.generateProof('/mintNBurnNote', [
        this.note,
      ],
      [
        { userKey: this.userKey, address: zkAddress },
      ])).data.proof;

      // TODO: this.account must be address type
      const tx = await this.dexContract.liquidate(this.account, ...proof, {
        from: this.metamaskAccount,
      });


      await new Promise(r => setTimeout(r, 1500));

      await this.$store.dispatch('set', ['notes']);
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
