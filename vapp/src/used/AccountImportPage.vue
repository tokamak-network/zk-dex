<template>
  <div>
    <account-list :accounts="accounts" />
    <input type="file" id="file" @change="onChange">
  </div>
</template>

<script>
import { mapState, mapMutations } from 'vuex';
import AccountList from '../components/AccountList.vue';

import { getAccounts, addAccount } from '../api/index';

export default {
  data () {
    return {
      file: null,
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
  },
  methods: {
    ...mapMutations(['SET_ACCOUNTS']),
    onChange (event) {
      const reader = new FileReader();
      reader.onload = this.onReaderLoad;
      reader.readAsText(event.target.files[0]);
    },
    onReaderLoad (event) {
      // TODO: filter not keystore format.
      const keystore = JSON.parse(event.target.result);
      this.importAccount(keystore);
    },
    importAccount (keystore) {
      const account = {};
      account.keystore = keystore;
      account.address = `0x${keystore.address}`;
      account.name = '';
      account.numberOfNotes = 0;

      // TODO: filter duplicated account
      addAccount(this.key, account).then(() => {
        this.$emit('addNewAccount', account);
        this.done = true;
      });
      this.accounts.push(account);
    },
  },
};
</script>
