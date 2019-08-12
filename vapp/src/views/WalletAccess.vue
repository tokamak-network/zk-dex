<template>
  <div>
    {{ message }}
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import Web3 from 'web3';

export default {
  data () {
    return {
      message: 'accessing wallet',
    };
  },
  computed: {
    ...mapState({
      path: state => state.path,
    }),
  },
  methods: {
    ...mapActions(['setWeb3']),
  },
  beforeCreate () {
    getWeb3()
      .then((web3) => {
        this.setWeb3(web3);
        polling(this.$store);
        this.$router.push({ path: '/wallet' });
      })
      .catch((e) => {
        this.message = `please refresh page, error: ${e}`;
      });
  },
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
        web3Object.balance = await window.web3.eth.getBalance(web3Object.account);
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
    if (account !== store.state.web3.account) {
      const newAccount = account;
      const newBalance = await window.web3.eth.getBalance(newAccount);
      store.dispatch('updateWallet', {
        coinbase: newAccount,
        balance: newBalance,
      });
    } else {
      const balance = await window.web3.eth.getBalance(store.state.web3.account);
      if (balance !== store.state.web3.balance) {
        store.dispatch('updateWallet', {
          coinbase: store.state.web3.account,
          balance: balance,
        });
      }
    }
  }, 500);
};
</script>
