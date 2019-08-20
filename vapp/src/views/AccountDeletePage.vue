<template>
  <div>
    <account-list :accounts="accounts" />
  </div>
</template>

<script>
import { mapState } from 'vuex';
import AccountList from '../components/AccountList.vue';

import { getAccounts } from '../api/index';

export default {
  data () {
    return {
      accounts: [],
    };
  },
  components: {
    AccountList,
  },
  computed: {
    ...mapState({
      key: state => state.key,
    }),
  },
  created () {
    getAccounts(this.key).then(async (accounts) => {
      if (accounts !== null) {
        this.accounts = accounts;
      }
    });
  },
};
</script>
