<template>
  <div>
    <account-list :accounts="accounts" />
    <note-list :notes="notes" />
    <note-balance-list :notes="notes" />
    <note-list-transfer-history :transferNotes="transferNotes" />
  </div>
</template>

<script>
import AccountList from '../components/AccountList.vue';
import NoteList from '../components/NoteList.vue';
import NoteBalanceList from '../components/NoteBalanceList.vue';
import NoteListTransferHistory from '../components/NoteListTransferHistory.vue';

import { mapState, mapMutations } from 'vuex';
import { getAccounts, getTransferNotes, getNotes } from '../api/index';

export default {
  components: {
    AccountList,
    NoteList,
    NoteBalanceList,
    NoteListTransferHistory,
  },
  computed: {
    ...mapState({
      key: state => state.key,
      accounts: state => state.accounts,
      notes: state => state.notes,
      transferNotes: state => state.transferNotes,
    }),
  },
  created () {
    if (this.accounts === null) {
      getAccounts(this.key).then(async (a) => {
        const accounts = [];
        const notes = [];
        const transferNotes = [];

        if (a !== null) {
          accounts.push(...a);
          for (let i = 0; i < accounts.length; i++) {
            const n = await getNotes(accounts[i].address);
            if (n !== null) {
              notes.push(...n);
            }
            const tn = await getTransferNotes(accounts[i].address);
            if (tn !== null) {
              transferNotes.push(...tn);
            }
          }
        }
        this.SET_ACCOUNTS(accounts);
        this.SET_NOTES(notes);
        this.SET_TRANSFER_NOTES(transferNotes);
      });
    }
  },
  methods: {
    ...mapMutations(['SET_ACCOUNTS', 'SET_NOTES', 'SET_TRANSFER_NOTES']),
  },
};
</script>
