<template>
  <div class="zone" style="text-align: center;">
    <h2 style="margin-bottom: 20px;">Accounts</h2>
    <table class="table">
      <thead>
        <tr>
          <th>Index</th>
          <th>Address</th>
          <th>Name</th>
          <th>Total Notes</th>
        </tr>
      </thead>
      <tbody>
        <!-- <tr v-for="(account, index) in accounts" @click="selectAccount(account)" :class="{ 'is-selected': account == selectedAccount }"> -->
        <tr v-for="(account, index) in accounts">
          <td>{{index}}</td>
          <td>{{account.address}}</td>
          <td>{{account.name}}</td>
          <td>{{account.numberOfNotes}}</td>
        </tr>
      </tbody>
    </table>
    <button class="button" @click="createNewAccount" :class="{ 'is-loading': !done }">CREATE</button>
  </div>
</template>

<script>
import { mapActions, mapMutations, mapState } from 'vuex';
import { createAccount, addAccount, getAccounts } from '../api/index';

export default {
  data () {
    return {
      accounts: [],
      done: true,
    };
  },
  mounted () {
    getAccounts(this.key).then((accounts) => {
      if (accounts !== null) {
        this.accounts = accounts;
        this.MUTATE_ACCOUNTS(accounts);
      } else {
        alert('you have to make account!');
      }
    });
  },
  computed: {
    ...mapState({
      key: state => state.key,
    }),
  },
  methods: {
    ...mapMutations(['MUTATE_ACCOUNTS']),
    createNewAccount () {
      this.done = false;
      createAccount().then((res) => {
        const account = {
          address: res.data.address,
          name: 'main',
          numberOfNotes: 10,
        };
        this.accounts.push(account);
        addAccount(this.key, account);
        this.done = true;
      });
    },
  },
};
</script>
