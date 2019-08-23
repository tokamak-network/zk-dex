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
import { mapState } from 'vuex';
import AccountList from '../components/AccountList.vue';

import { getAccounts, unlockAccount } from '../api/index';
import keythereum from 'keythereum';

export default {
  data () {
    return {
      accounts: [],
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
        this.accountToExport = this.account;
        this.addressToExport = this.account.address;
      }
    );
  },
  methods: {
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
