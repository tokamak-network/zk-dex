<template>
  <div>
    <account-list :accounts="accounts" />
    <div class="box">
      Export account: {{ addressToExport }}
      <div class="field has-addons" style="margin-top: 20px;">
        <p class="control">
          <a class="button is-static" style="width: 140px">
            Passphrase
          </a>
        </p>
        <p class="control is-expanded">
          <input style="width: 100%; text-align: right;" class="input" type="password" placeholder="passphrase" v-model="passphrase">
        </p>
      </div>
      <button class="button" style="width: 100%;" @click="unlockAccount" :class="{'is-static': accountToExport == null}">Unlock</button>
      <a tag="button" @click="exportAccount" style="width: 100%; margin-top: 10px;" class="button" :href="'data:' +data+ ''" download="keystore.json" :class="{'is-static': !isUnlock}">Export keystore</a>
    </div>
  </div>
</template>

<script>
import { mapState, mapMutations } from 'vuex';
import AccountList from '../components/AccountList.vue';

import { getAccounts, unlockAccount } from '../api/index';
import keythereum from 'keythereum';

export default {
  data () {
    return {
      accountToExport: null,
      addressToExport: '',
      passphrase: '',
      isUnlock: false,
      data: null,
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
    // this.$bus.$off('select-account');
  },
  methods: {
    ...mapMutations(['SET_ACCOUNTS']),
    selectAccount (account) {
      this.accountToExport = account;
      this.addressToExport = account.address;
    },
    async unlockAccount () {
      const res = await unlockAccount(
        this.passphrase,
        this.accountToExport.keystore
      );
      const privateKey = res.data.privateKey;

      if (privateKey === null) {
        alert('Failed to unlock the account');
        return;
      }
      this.isUnlock = true;
    },
    exportAccount () {
      const keyObj = this.accountToExport.keystore;
      this.data =
        'text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(keyObj));
      this.passphrase = '';
      this.isUnlock = false;
      this.accountToExport = null;
      this.addressToExport = '';
    },
  },
};
</script>
