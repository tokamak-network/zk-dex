<template>
  <div style="text-align: center;">
    <h2 style="margin-bottom: 20px;">Account Balance</h2>
    <table class="table">
      <thead>
        <tr>
          <th>Currency Name</th>
          <th>Symbol</th>
          <th>Total Notes</th>
          <th>Available Balance</th>
          <th>Reserved</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="account in accounts" @click="selectAccount(account)" :class="{ 'is-selected': account == selectedAccount }">
          <!-- <td>Ethereum</td>
          <td>ETH</td>
          <td>3</td>
          <td>0.11111</td>
          <td>0.22222</td>
          <td>0.33333</td> -->
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';

export default {
  data () {
    return {
      accounts: [],
      selectedAccount: null,
    };
  },
  computed: mapState({
    // coinbase: state => state.web3.coinbase,
    // secretKey: state => state.secretKey,
    // account: state => state.account,
  }),
  methods: {
    selectAccount (account) {
      this.selectedAccount = account;
    },
  },
  created () {
    this.accounts.push({
      '1': 1,
      '2': 2,
      '3': 3,
    });
  },
};
</script>
