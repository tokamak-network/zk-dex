<template>
  <div style="text-align: center;">
    <h1 class="title is-1">ZK-DEX</h1>
    <zk-dex-contract />
    <div style="height: 10px;"></div>
    <meta-mask />
    <div>
      <input class="input" type="password" placeholder="Text input" v-model="viewingKey">
    </div>
    <p>viewingKey: {{ viewingKey }}</p>
    <p>secretKey: {{ `${account}${viewingKey}` }}</p>
    <div>
      <a class="button is-info" :disabled="viewingKey === '' || !isListening" @click="moveToMainPage">START !</a>
    </div>
  </div>
</template>

<script>
import MetaMask from '../components/MetaMask.vue';
import ZkDexContract from '../components/ZkDexContract.vue';

import { mapState, mapActions } from 'vuex';

import { account } from '../../../scripts/lib/account';
import Web3Utils from 'web3-utils';

export default {
  components: {
    MetaMask,
    ZkDexContract,
  },
  data () {
    return {
      viewingKey: '',
    };
  },
  computed: {
    ...mapState({
      coinbase: state => state.web3.coinbase,
      isListening: state => state.web3.isListening,
      dexContractInstance: state => state.dexContractInstance,
    }),
    paddedViewingKey () {
      return Web3Utils.padLeft(Web3Utils.toHex(this.viewingKey), 64);
    },
  },
  methods: {
    ...mapActions(['setViewingKey', 'setSecretKey', 'setaccount']),
    moveToMainPage () {
      if (this.viewingKey === '') return;
      this.setKeys();
      this.initaccount().then(() => {
        this.$router.push({ path: '/main/account' });
      });
    },
    async initaccount () {
      const account = new account();
      account.setVk(this.account, this.paddedViewingKey);
      await account.init(this.dexContractInstance.address);

      this.setaccount(account);
    },
    setKeys () {
      this.setViewingKey(this.paddedViewingKey);
      this.setSecretKey(`${this.account}${this.viewingKey}`);
    },
  },
};
</script>
