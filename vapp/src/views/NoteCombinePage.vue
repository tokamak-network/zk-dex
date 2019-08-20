<template>
  <div>
    <note-balance-list :accounts="accounts" :notes="notes" v-on:selectAccount="selectAccount" />
    <note-list :notes="notes" />
    <note-combine :notes="notes" :account="account" />
  </div>
</template>

<script>
import NoteBalanceList from '../components/NoteBalanceList';
import NoteList from '../components/NoteList';
import NoteCombine from '../components/NoteCombine';

import { mapState } from 'vuex';
import { getAccounts, getNotes } from '../api/index';

import Web3Utils from 'web3-utils';

export default {
  components: {
    NoteBalanceList,
    NoteList,
    NoteCombine,
  },
  data () {
    return {
      account: '',
      accounts: [],
      notes: [],
    };
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
  methods: {
    async selectAccount (account) {
      this.account = account;
      const notes = await getNotes(account);
      if (notes !== null) {
        this.notes = notes;
      } else {
        this.notes = [];
      }
    },
  },
};
</script>
