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
import { mapState } from 'vuex';
import AccountList from '../components/AccountList.vue';

import { getAccounts, deleteAccount } from '../api/index';

export default {
  data () {
    return {
      accounts: [],
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
      account: state => state.account,
    }),
  },
  created () {
    getAccounts(this.key).then(async (accounts) => {
      if (accounts !== null) {
        this.accounts = accounts;
      }
    });
  },
  mounted () {
    this.$store.watch(
      (state, getters) => getters.account,
      () => {
        this.accountToDelete = this.account;
        this.addressToDelete = this.account.address;
      }
    );
  },
  methods: {
    deleteAccount () {
      deleteAccount(this.key, this.addressToDelete).then(() => {
        for (let i = 0; i < this.accounts.length; i++) {
          if (this.accounts[i].address === this.addressToDelete) {
            this.accounts.splice(i, 1);
            break;
          }
        }
      });
    },
  },
};
</script>
