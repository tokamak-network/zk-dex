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
          <input
            type="text"
            v-model="address"
          />
        </template>
      </input-text>
      <input-text
        :label="'Amount'"
        :isStaticValue="false"
      >
        <template v-slot:input>
          <input
            v-model="amount"
            @keypress="isNumber"
          />
        </template>
      </input-text>
    </div>
    <div class="button-container">
      <standard-button
        :text="'Create'"
        :loading="loading"
        @click.native="requestCreateNote"
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

const { ZkDexAddress, ZkDexPublicKey } = require('zk-dex-keystore/lib/Account');
const {
  addZkPrefix,
  removeZkPrefix,
} = require('zk-dex-keystore/lib/utils');

export default {
  data () {
    return {
      address: '',
      amount: '',
      token: '',
      loading: false,
    };
  },
  computed: {
    ...mapState([
      'daiContract',
      'dexContract',
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
    clear () {
      this.address = '';
      this.amount = '';
      this.token = '';
    },
    isNumber (evt) {
      evt = (evt) ? evt : window.event;
      const charCode = (evt.which) ? evt.which : evt.keyCode;
      if ((charCode > 31 && (charCode < 48 || charCode > 57)) && charCode !== 46) {
        evt.preventDefault();
      } else {
        return true;
      }
    },
    check () {
      if (this.address === '' || this.amount === '') return false;
      return true;
    },
    async requestCreateNote () {
      if (!this.check()) return alert('empty params');
      this.loading = true;

      await this.createNote();

      this.loading = false;
      this.clear();
    },
    async createNote () {
      // TODO: fix
      const viewingKey = '1234';
      const getSalt = () => web3Utils.randomHex(16);

      const pubKey = ZkDexAddress.fromBase58(removeZkPrefix(this.address)).toPubKey();
      const pubKey0 = pubKey.xToHex();
      const pubKey1 = pubKey.yToHex();

      const note = new Note(pubKey0, pubKey1, this.amount, this.token.type, viewingKey, getSalt());

      await this.unlockAccount(this.address);

      console.log('generating proof...');
      const proof = (await api.generateProof('/mintNBurnNote', [note], [{
        userKey: this.userKey,
        address: this.address,
      }])).data.proof;

      let tx;
      if (this.token.symbol === 'DAI') {
        await this.daiContract.approve(this.dexContract.address, this.amount, {
          from: this.metamaskAccount,
        });
        try {
          tx = await this.dexContract.mint(...proof, note.encrypt(viewingKey), {
            from: this.metamaskAccount,
          });
        } catch (e) {
          console.log(e.message);
        }
      } else if (this.token.symbol === 'ETH') {
        try {
          tx = await this.dexContract.mint(...proof, note.encrypt(viewingKey), {
            from: this.metamaskAccount,
            value: this.amount,
          });
        } catch (e) {
          console.log(e.message);
        }
      }
      await this.$store.dispatch('set', ['notes']);
    },
    async unlockAccount (address, passphrase = '1234') {
      try {
        await api.unlockAccount(this.userKey, passphrase, address);
      } catch (e) {
        console.log('failed to unlock');
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@import "CreateNoteContainer.scss";
</style>
