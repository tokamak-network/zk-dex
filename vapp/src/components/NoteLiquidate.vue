<template>
  <div class="box">
    <div>
      <p style="margin-left: 10px; margin-bottom: 40px;">Liquidate {{ token }} Note</p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          Account
        </a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">
          {{ noteOwner }}
        </a>
      </p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          Note
        </a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">
          {{ noteHash | abbreviate }}
        </a>
      </p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          Note Amount
        </a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">
          {{ noteValue | hexToNumberString }}
        </a>
      </p>
    </div>
    <div style="display: flex; justify-content: flex-end">
      <a class="button is-link" style="margin-top: 20px;" :class="{ 'is-static': noteHash === '', 'is-loading': loading }" @click="liquidateNote">Liquidate</a>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions, mapMutations } from 'vuex';
import { getNotes, updateNoteState, generateProof } from '../api/index';
import Web3Utils from 'web3-utils';

export default {
  data () {
    return {
      loading: false,
      note: null,
      noteOwner: '',
      noteHash: '',
      noteValue: '',
    };
  },
  props: {
    token: {
      type: String,
    },
  },
  computed: {
    ...mapState({
      accounts: state => state.accounts,
      coinbase: state => state.web3.coinbase,
      dex: state => state.dexContractInstance,
      dai: state => state.daiContractInstance,
    }),
  },
  created () {
    this.$bus.$on('select-note', this.selectNote);
  },
  beforeDestroy () {
    this.$bus.$off('select-note');
  },
  methods: {
    ...mapMutations([
      'SET_NOTES',
    ]),
    selectNote (note) {
      this.note = note;
      this.noteOwner = Web3Utils.padLeft(
        Web3Utils.toHex(Web3Utils.toBN(note.owner)),
        40
      );
      this.noteHash = note.hash;
      this.noteValue = note.value;
    },
    async proof () {
      const params = {
        circuit: 'mintNBurnNote',
        params: [this.note],
      };
      const res = await generateProof(params);

      return res.data.proof;
    },
    async liquidateNote () {
      this.loading = true;

      const proof = await this.proof();
      const tx = await this.dex.liquidate(this.noteOwner, ...proof, {
        from: this.coinbase,
      });

      const noteOwner = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(this.note.owner)), 40);
      const noteHash = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(tx.logs[0].args.note)), 64);
      const noteState = Web3Utils.toHex(tx.logs[0].args.state);
      await updateNoteState(noteOwner, noteHash, noteState);

      const newNotes = [];
      for (let i = 0; i < this.accounts.length; i++) {
        const n = await getNotes(this.accounts[i].address);
        if (n !== null) {
          newNotes.push(...n);
        }
      }
      this.SET_NOTES(newNotes);
      this.updateDaiAmount();

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
