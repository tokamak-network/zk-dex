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
import { mapState } from 'vuex';
import { updateNote, generateProof } from '../api/index';
import Web3Utils from 'web3-utils';

export default {
  data () {
    return {
      loading: false,
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
      coinbase: state => state.web3.coinbase,
      note: state => state.note,
      dex: state => state.dexContractInstance,
    }),
  },
  mounted () {
    this.$store.watch(
      (state, getters) => getters.note,
      () => {
        const note = this.$store.getters.note;
        const owner = note.owner;

        this.noteOwner = Web3Utils.padLeft(Web3Utils.toHex(Web3Utils.toBN(owner)), 20);
        this.noteHash = note.hash;
        this.noteValue = note.value;
      }
    );
  },
  methods: {
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

      const note = this.note;
      const hash = tx.logs[0].args.note;
      const state = Web3Utils.hexToNumberString(
        Web3Utils.toHex(tx.logs[0].args.state)
      );
      note.hash = hash;
      note.state = state;
      await updateNote(this.noteOwner, note);
      this.$emit('updateNote', note);

      this.loading = false;
      this.$router.push({ path: '/' });
    },
  },
};
</script>
