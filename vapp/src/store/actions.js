import contract from 'truffle-contract';
import dexJSON from '../../../build/contracts/ZkDex.json';
import daiJSON from '../../../build/contracts/MockDai.json';

export default {
  setContract ({
    commit,
  }) {
    const dex = contract(dexJSON);
    const dai = contract(daiJSON);

    dex.setProvider(window.web3.currentProvider);
    dai.setProvider(window.web3.currentProvider);

    commit('SET_DEX_CONTRACT', dex);
    commit('SET_DAI_CONTRACT', dai);
  },
  setDexContractInstance ({
    commit,
  }, instance) {
    commit('SET_DEX_CONTRACT_INSTANCE', instance);
  },
  setDaiContractInstance ({
    commit,
  }, instance) {
    commit('SET_DAI_CONTRACT_INSTANCE', instance);
  },

  setDaiAddress ({
    commit,
  }, daiAddress) {
    commit('SET_DAI_ADDRESS', daiAddress);
  },

  setDaiAmount ({
    commit,
  }, daiAmount) {
    commit('SET_DAI_AMOUNT', daiAmount);
  },

  setViewingKey ({
    commit,
  }, key) {
    commit('SET_VIEWING_KEY', key);
  },
  setSecretKey ({
    commit,
  }, key) {
    commit('SET_SECRET_KEY', key);
  },

  setOrder ({
    commit,
  }, order) {
    commit('SET_ORDER', order);
  },
  setOrders ({
    commit,
  }, orders) {
    commit('SET_ORDERS', orders);
  },

  setAccounts ({
    commit,
  }, accounts) {
    commit('SET_ACCOUNTS', accounts);
  },

  setNote ({
    commit,
  }, note) {
    commit('SET_NOTE', note);
  },

  setWeb3 ({
    commit,
  }, web3) {
    commit('SET_WEB3', web3);
  },

  updateWallet ({
    commit,
  }, account) {
    commit('UPDATE_WALLET', account);
  },

  setLastPath ({
    commit,
  }, path) {
    commit('SET_LAST_PATH', path);
  },
};
