<template>
  <div>
    <p>Network: {{ network }}</p>
    <p>Account: {{ coinbase }}</p>
    <p>ETH: {{ balance }} wei</p>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import Web3 from 'web3';

export default {
  name: 'metamask',
  computed: {
    ...mapState({
      isListening: state => state.web3.isListening,
      network: state => NETWORKS[state.web3.networkId],
      coinbase: state => state.web3.coinbase,
      balance: state => state.web3.balance,
    }),
  },
  methods: {
    ...mapActions(['setWeb3']),
  },
  beforeCreate () {
    getWeb3()
      .then((web3) => {
        this.setWeb3(web3);
        setDaiAmount(this.$store);
        polling(this.$store);
      })
      .catch((e) => {
        // this.message = `please refresh page, error: ${e}`;
      });
  },
};

const NETWORKS = {
  '1': 'Main Net',
  '2': 'Deprecated Morden test network',
  '3': 'Ropsten test network',
  '4': 'Rinkeby test network',
  '42': 'Kovan test network',
  '1337': 'Tokamak network',
  '4447': 'Truffle Develop Network',
  '5777': 'Ganache Blockchain',
};

const getWeb3 = () =>
  new Promise(async (resolve, reject) => {
    if (typeof window.ethereum === 'undefined') {} else {
      window.web3 = new Web3(window.ethereum);
      try {
        await window.ethereum.enable();
      } catch (e) {
        reject(e);
      }

      const web3Object = {};
      try {
        web3Object.web3Instance = window.web3;
        web3Object.coinbase = (await window.web3.eth.getAccounts())[0];
        web3Object.networkId = await window.web3.eth.net.getId();
        web3Object.balance = await window.web3.eth.getBalance(web3Object.coinbase);
        web3Object.isListening = await window.web3.eth.net.isListening();
      } catch (e) {
        reject(e);
      }
      resolve(web3Object);
    }
  });

const polling = (store) => {
  setInterval(async () => {
    const account = (await window.web3.eth.getAccounts())[0];
    if (account !== store.state.web3.coinbase) {
      const newBalance = await window.web3.eth.getBalance(account);
      store.dispatch('updateWallet', {
        coinbase: account,
        balance: newBalance,
      });
      await setDaiAmount(store);
    } else {
      const balance = await window.web3.eth.getBalance(store.state.web3.coinbase);
      if (balance !== store.state.web3.balance) {
        store.dispatch('updateWallet', {
          coinbase: store.state.web3.coinbase,
          balance,
        });
        await setDaiAmount(store);
      }
    }
  }, 500);
};

const setDaiAmount = async function (store) {
  const daiContract = store.state.daiContractInstance;
  if (daiContract !== null) {
    const daiAmount = await store.state.daiContractInstance.balanceOf(store.state.web3.coinbase);
    store.dispatch('setDaiAmount', {
      daiAmount,
    });
  }
};
</script>

<style scoped></style>
