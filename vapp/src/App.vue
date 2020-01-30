<template>
  <div id="app">
    <header-container />
    <router-view class="views"/>
    <footer-container />
  </div>
</template>

<script>
// TODO: use @
import HeaderContainer from './containers/HeaderContainer';
import FooterContainer from './containers/FooterContainer';

import Web3 from 'web3';
import Contract from 'truffle-contract';
import ZkDexContractJSON from '../../build/contracts/ZkDex.json';
import DaiContractJSON from '../../build/contracts/MockDai.json';
import api from './api/index';

export default {
  name: 'App',
  components: {
    HeaderContainer,
    FooterContainer,
  },
  async beforeCreate () {
    // TODO: make responsive web

    // fixed width
    const width = screen.width;
    document.body.style.minWidth = `${width}px`;

    // metamask
    if (window.ethereum) {
      try {
        await window.ethereum.enable();
        await this.setApp();
      } catch (error) {
        console.log('User denied account access', error);
      }
    } else {
      return;
    }

    // metamask event listening
    window.ethereum.on('networkChanged', async (netId) => {
      await this.setApp();
    });
    window.ethereum.on('accountsChanged', async (account) => {
      await this.setApp();
    });
  },
  methods: {
    async setApp () {
      this.$store.dispatch('setInitialState');

      // create and set web3
      const provider = window.ethereum;
      const web3 = new Web3(provider);
      this.$store.dispatch('setWeb3', web3);

      // set metamask account
      const metamaskAccount = (await web3.eth.getAccounts())[0];
      this.$store.dispatch('setUserKey', metamaskAccount);

      // set ZkDex contract instance
      const ZkDexContract = Contract(ZkDexContractJSON);
      ZkDexContract.setProvider(web3.currentProvider);
      const ZkDexContractInstance = await ZkDexContract.deployed();
      this.$store.dispatch('setDexContract', ZkDexContractInstance);

      // set Dai contract instance
      const daiContractAddress = await ZkDexContractInstance.dai();

      const daiContract = Contract(DaiContractJSON);
      daiContract.setProvider(web3.currentProvider);
      const daiContractInstance = await daiContract.at(daiContractAddress);
      this.$store.dispatch('setDaiContract', daiContractInstance);

      this.setState(metamaskAccount);
    },
    async setState (metamaskAccount) {
      // NOTE: use metamask account as key.
      const key = metamaskAccount;

      // const accounts = await api.getAccounts(key);
      // if (accounts !== null) {
      //   this.$store.dispatch('setAccounts', accounts);

      //   let allHistories = [];
      //   for (const account of accounts) {
      //     const histories = await api.getNoteTransferHistories(account.address);
      //     allHistories = allHistories.concat(histories);
      //   }
      //   this.$store.dispatch('setNoteTransferHistories', allHistories);
      // }

      // const notes = await api.getNotes(key);
      // if (notes !== null) {
      //   this.$store.dispatch('setNotes', notes);
      // }

      // const orders = await api.getOrders();
      // if (orders !== null) {
      //   this.$store.dispatch('setOrders', orders);
      // }
    },
  },
};
</script>

<style lang="scss">
@import './scss/Global';
@import '~@/scss/containers';

html, body {
  height: 100%;
}

#app {
  display: flex;
  flex-direction: column;
  background: rgba(31, 31, 42, 1.000);
  min-height: 100%;
}

.views {
  flex-grow: 1;
}

</style>
