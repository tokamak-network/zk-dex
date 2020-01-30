<template>
  <div>
    <account-list :accounts="accounts" />
    <div class="box">
      Delete account: {{ addressToDelete }}
      <button class="button" style="width: 100%; margin-top: 15px;" @click="deleteAccount" :class="{'is-static': accountToDelete == null}">Delete</button>
    </div>
  </div>
</template>

<script>
import { mapState, mapMutations } from 'vuex';
import AccountList from '../components/AccountList.vue';

import { getAccounts, deleteAccount } from '../api/index';

export default {
  data () {
    return {
      accountToDelete: null,
      addressToDelete: '',
    };
  },
  components: {
    AccountList,
  },
  computed: {
    ...mapState({
      key: state => state.key,
      accounts: state => state.accounts,
    }),
  },
  created () {
    if (this.accounts === null) {
      getAccounts(this.key).then(async (a) => {
        const accounts = [];
        if (a !== null) {
          accounts.push(...a);
        }
        this.SET_ACCOUNTS(accounts);
      });
    }
    this.$bus.$on('select-account', this.selectAccount);
  },
  beforeDestroy () {
    this.$bus.$off('select-account');
  },
  methods: {
    ...mapMutations(['SET_ACCOUNTS', 'DELETE_ACCOUNT']),
    selectAccount (account) {
      this.accountToDelete = account;
      this.addressToDelete = account.address;
    },
    deleteAccount () {
      deleteAccount(this.key, this.addressToDelete).then(() => {
        this.DELETE_ACCOUNT(this.accountToDelete);
      });
    },
  },
};
</script>
