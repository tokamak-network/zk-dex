<template>
  <section class="section">
    <div class="container">
      <div style="text-align: center; margin-top: 150px;">
        <p style="margin-bottom: 40px;">metamask address: {{ coinbase }}</p>
        <div class="columns">
          <div class="column is-half">
            <p>accounts: </p>
          </div>
          <div class="column is-half">
            <div class="select">
              <select v-model="account">
                <option v-for="(account, index) in accounts">{{ account.address }}</option>
              </select>
            </div>
          </div>
        </div>
        <div class="columns">
          <div class="column is-half">
            <p>value: {{ value }}</p>
          </div>
          <div class="column is-half">
            <input class="input" style="width: 20%;" type="number" placeholder="amount" v-model="value">
          </div>
        </div>
        <div class="columns">
          <div class="column is-half">
            <p>ETH: {{ balance }}</p>
          </div>
          <div class="column is-half">
            <button class="button" @click="createEthNote">Make Note(ETH)</button>
          </div>
        </div>
        <div class="columns">
          <div class="column is-half">
            <p>DAI: {{ daiAmount }}</p>
          </div>
          <div class="column is-half">
            <button class="button" @click="createDaiNote">Make Note(DAI)</button>
          </div>
        </div>
        <div>
          <p>viewing key: {{ viewingKey }}</p>
          <p>note: {{ JSON.stringify(note, null, 2) }}</p>
          <p>proof: {{ proof }}</p>
        </div>
        <div>
          <a class="button is-link" v-bind:class="loading" @click="getProof">generate proof</a>
        </div>
        <div>
          <a class="button is-link" @click="mintNote">mint note</a>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { mapState } from 'vuex';
import Web3Utils from 'web3-utils';
import { Note, constants } from '../../../scripts/lib/Note';
import { getAccounts, addNote, generateProof } from '../api/index';

const ether = n => Web3Utils.toBN(n).mul(Web3Utils.toBN((1e18).toString(10)));

export default {
  data () {
    return {
      account: null,
      accounts: [],
      loaded: false,
      proof: '',
      value: null,
      salt: null,
      note: null,
      daiAmount: null,
    };
  },
  computed: {
    ...mapState({
      key: state => state.key,
      coinbase: state => state.web3.coinbase,
      balance: state => state.web3.balance,
      viewingKey: state => state.viewingKey,
      dex: state => state.dexContractInstance,
      dai: state => state.daiContractInstance,
      web3: state => state.web3.web3Instance,
    }),
    loading: function () {
      return {
        'is-loading': this.loaded,
      };
    },
  },
  created () {
    this.salt = Web3Utils.randomHex(16);
    this.getDaiAmount().then((b) => {
      this.daiAmount = b.toString();
    });
  },
  beforeMount () {
    getAccounts(this.key).then((accounts) => {
      if (accounts !== null) {
        this.accounts = accounts;
      }
    });
  },
  methods: {
    getDaiAmount () {
      return this.dai.balanceOf(this.coinbase);
    },
    createEthNote () {
      this.note = new Note(
        this.account,
        this.value,
        constants.ETH_TOKEN_TYPE,
        this.viewingKey,
        this.salt,
        false
      );
    },
    createDaiNote () {
      this.note = new Note(
        this.account,
        this.value,
        constants.DAI_TOKEN_TYPE,
        this.viewingKey,
        this.salt,
        false
      );
    },
    async mintEthNote () {
      const mintTx = await this.dex.mint(...this.proof, this.note.encrypt(), {
        from: this.coinbase,
        value: this.value,
      });

      this.note.hash = mintTx.logs[0].args.note;
      this.note.state = mintTx.logs[0].args.state;
      await addNote(this.account, this.note);
    },
    async mintDaiNote () {
      await this.dai.approve(this.dex.address, this.value, {
        from: this.coinbase,
      });
      const mintTx = await this.dex.mint(...this.proof, this.note.encrypt(), {
        from: this.coinbase,
      });

      this.note.hash = mintTx.logs[0].args.note;
      this.note.state = mintTx.logs[0].args.state;
      await addNote(this.account, this.note);
    },
    getProof () {
      this.loaded = true;
      const params = {
        circuit: 'mintNBurnNote',
        params: [this.note],
      };
      generateProof(params)
        .then(res => (this.proof = res.data.proof))
        .catch(e => console.log(e))
        .finally(() => (this.loaded = false));
    },
    mintNote () {
      if (this.note.token === constants.ETH_TOKEN_TYPE) {
        this.mintEthNote().then(() => {
          this.$router.push({ path: '/wallet' });
        });
      } else {
        this.mintDaiNote().then(() => {
          this.$router.push({ path: '/wallet' });
        });
      }
    },
  },
};
</script>
