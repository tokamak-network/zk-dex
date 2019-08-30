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
import { mapState, mapActions, mapMutations } from 'vuex';
import { Note, constants } from '../../../scripts/lib/Note';
import { getNotes, addNote, generateProof } from '../api/index';
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
    ...mapMutations(['SET_NOTES']),
    daiNote () {
      const salt = Web3Utils.randomHex(16);
      const note = new Note(
        this.account,
        this.amount,
        constants.DAI_TOKEN_TYPE,
        '0x0',
        salt
      );
      return note;
    },
    ethNote () {
      const salt = Web3Utils.randomHex(16);
      const note = new Note(
        this.account,
        this.amount,
        constants.ETH_TOKEN_TYPE,
        '0x0',
        salt
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
        this.token === 'DAI'
          ? this.daiNote
          : this.token === 'ETH'
            ? this.ethNote
            : () => {
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
        tx = await this.dex.mint(...proof, note.encrypt(note.owner), {
          from: this.coinbase,
        });
      } else if (this.token === 'ETH') {
        tx = await this.dex.mint(...proof, note.encrypt(note.owner), {
          from: this.coinbase,
          value: this.amount,
        });
      }

      if (tx.receipt.status) {
        const hash = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(tx.logs[0].args.note)),
          64
        );
        const state = Web3Utils.toHex(tx.logs[0].args.state);

        const noteObject = {};
        noteObject.owner = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(note.owner)),
          40
        );
        noteObject.value = Web3Utils.toHex(Web3Utils.toBN(note.value));
        noteObject.token = Web3Utils.toHex(Web3Utils.toBN(note.token));
        noteObject.viewingKey = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(note.viewingKey)),
          16
        );
        noteObject.salt = Web3Utils.padLeft(
          Web3Utils.toHex(Web3Utils.toBN(note.salt)),
          32
        );
        noteObject.isSmart = Web3Utils.toHex(Web3Utils.toBN(note.isSmart));
        noteObject.hash = hash;
        noteObject.state = state;

        await addNote(this.account, noteObject);

        const newNotes = [];
        for (let i = 0; i < this.accounts.length; i++) {
          const n = await getNotes(this.accounts[i].address);
          if (n !== null) {
            newNotes.push(...n);
          }
        }
        this.SET_NOTES(newNotes);
        this.updateDaiAmount();
      }
      this.loading = false;
      this.$router.push({ path: '/' });
    },
    async updateDaiAmount () {
      const daiAmount = await this.dai.balanceOf(this.coinbase);
      this.$store.dispatch('setDaiAmount', {
        daiAmount,
      });
    },
  },
};
</script>
