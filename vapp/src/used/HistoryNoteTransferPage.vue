<template>
  <div>
    <account-list :accounts="accounts" />
    <note-list-transfer-history :transferNotes="transferNotes" />
  </div>
</template>

<script>
import AccountList from '../components/AccountList';
import NoteListTransferHistory from '../components/NoteListTransferHistory';

import { mapState } from 'vuex';
import { getAccounts, getTransferNotes } from '../api/index';

export default {
  data () {
    return {
      accounts: [],
      transferNotes: [],
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
        const transferNotes = [];
        for (let i = 0; i < accounts.length; i++) {
          const n = await getTransferNotes(accounts[i].address);
          if (n != null) {
            transferNotes.push(...n);
          }
        }
        this.transferNotes = transferNotes;
      }
    });
  },
  components: {
    AccountList,
    NoteListTransferHistory,
  },
};
</script>
