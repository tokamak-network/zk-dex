<template>
  <div v-loading="loading" style="text-align: center;">
    <div>
      <p>account: {{ coinbase }}</p>
      <p>token type: {{ token }}</p>
      <p>value: {{ value }}</p>
      <p>viewing key: {{ viewingKey }}</p>
      <p>salt: {{ salt }}</p>
      <p>proof: {{ proof }}</p>
      <div>
        <el-button @click="getProof">generate proof</el-button>
      </div>
    </div>
    <div>
      <el-button @click="mintNote">mint note</el-button>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import Web3Utils from 'web3-utils';
import { Note, constants } from '../../../../scripts/lib/Note';
import { generateProof } from '../../api/index';

const ether = n => Web3Utils.toBN(n).mul(Web3Utils.toBN((1e18).toString(10)));

export default {
  data () {
    return {
      loading: false,
      proof: '',
      value: null,
      salt: null,
      note: null,
    };
  },
  props: {
    token: {
      type: String,
      default: '',
    },
  },
  computed: mapState({
    myNotes: state => state.myNotes,
    viewingKey: state => state.viewingKey,
    wallet: state => state.wallet,
    dex: state => state.dexContractInstance,
    dai: state => state.daiContractInstance,
    web3: state => state.web3.web3Instance,
    coinbase: state => state.web3.coinbase,
  }),
  created () {
    this.value = ether(5);
    this.salt = Web3Utils.randomHex(16);
    if (this.token === 'eth') {
      this.createEthNote();
      console.log('eth');
    } else {
      this.createDaiNote();
      console.log('dai');
    }
  },
  methods: {
    createEthNote () {
      this.note = new Note(
        this.coinbase,
        this.value,
        constants.ETH_TOKEN_TYPE,
        this.viewingKey,
        this.salt,
        false
      );
    },
    createDaiNote () {
      this.note = new Note(
        this.coinbase,
        this.value,
        constants.DAI_TOKEN_TYPE,
        this.viewingKey,
        this.salt,
        false
      );
    },
    async mintEthNote () {
      this.loading = true;

      await this.dex.mint(...this.proof, this.note.encrypt(), {
        from: this.coinbase,
        value: this.value,
      });

      setTimeout(() => {
        this.loading = false;
        this.$router.push({ path: '/main' });
      }, 3000);
    },
    async mintDaiNote () {
      this.loading = true;

      await this.dai.approve(this.dex.address, this.value, {
        from: this.coinbase,
      });
      await this.dex.mint(...this.proof, this.note.encrypt(), {
        from: this.coinbase,
      });
    },
    getProof () {
      this.loading = true;

      const params = {
        circuit: 'mintNBurnNote',
        params: this.note,
      };
      generateProof(params)
        .then(res => (this.proof = res.data.proof))
        .catch(e => console.log(e))
        .finally(() => (this.loading = false));
    },
    mintNote () {
      if (this.token === 'eth') {
        this.mintEthNote().then(() => {
          setTimeout(() => {
            this.loading = false;
            this.$router.push({ path: '/main' });
          }, 3000);
        });
      } else {
        this.mintDaiNote().then(() => {
          setTimeout(() => {
            this.loading = false;
            this.$router.push({ path: '/main' });
          }, 3000);
        });
      }
    },
  },
};
</script>
