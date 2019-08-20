<template>
  <div class="box">
    <div>
      <p style="margin-left: 10px; margin-bottom: 40px;">Create {{ token }} Note</p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          To
        </a>
      </p>
      <p class="control">
        <div class="select is-fullwidth">
          <select v-model="account">
            <option v-for="(account, index) in accounts">{{ account.address }}</option>
          </select>
        </div>
      </p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          Amount
        </a>
      </p>
      <p class="control is-expanded">
        <input style="width: 100%; text-align: right;" class="input" type="text" placeholder="price" v-model="amount">
      </p>
    </div>
    <div style="display: flex; justify-content: flex-end">
      <a class="button is-link" style="margin-top: 20px;" :class="{ 'is-static': account === '' || amount === '', 'is-loading': loading }" @click="createNewNote">Create</a>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import { Note, constants } from '../../../scripts/lib/Note';
import { addNote, generateProof } from '../api/index';
import Web3Utils from 'web3-utils';

export default {
  data () {
    return {
      loading: false,
      account: '',
      amount: '',
    };
  },
  computed: {
    ...mapState({
      viewingKey: state => state.viewingKey,
      coinbase: state => state.web3.coinbase,
      dai: state => state.daiContractInstance,
      dex: state => state.dexContractInstance,
    }),
  },
  props: ['accounts', 'token'],
  methods: {
    daiNote () {
      const salt = Web3Utils.randomHex(16);
      const note = new Note(
        this.account,
        this.amount,
        constants.DAI_TOKEN_TYPE,
        this.viewingKey,
        salt,
        false
      );
      return note;
    },
    ethNote () {
      const salt = Web3Utils.randomHex(16);
      const note = new Note(
        this.account,
        this.amount,
        constants.ETH_TOKEN_TYPE,
        this.viewingKey,
        salt,
        false
      );
      return note;
    },
    async proof (note) {
      const params = {
        circuit: 'mintNBurnNote',
        params: [note],
      };
      const res = await generateProof(params);
      return res.data.proof;
    },
    async createNewNote () {
      this.loading = true;

      const getNote =
        this.token === 'DAI' ? this.daiNote :
          this.token === 'ETH' ? this.ethNote :
            () => {
              alert('undefined token type' + this.token);
              return null;
            };

      const note = getNote();
      if (note === null) return;

      const proof = await this.proof(note);

      let tx;
      if (this.token === 'DAI') {
        await this.dai.approve(this.dex.address, this.amount, {
          from: this.coinbase,
        });
        tx = await this.dex.mint(...proof, note.encrypt(), {
          from: this.coinbase,
        });
      } else if (this.token === 'ETH') {
        tx = await this.dex.mint(...proof, note.encrypt(), {
          from: this.coinbase,
          value: this.amount,
        });
      }

      const hash = tx.logs[0].args.note;
      const state = Web3Utils.hexToNumberString(
        Web3Utils.toHex(tx.logs[0].args.state)
      );
      note.hash = hash;
      note.state = state;
      await addNote(this.account, note);
      this.$emit('addNewNote', note);

      this.loading = false;
      this.$router.push({ path: '/' });
    },
  },
};
</script>
