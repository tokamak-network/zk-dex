<template>
  <div>
    <account-list :accounts="accounts" v-on:addNewAccount="addNewAccount" />
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

import { mapState } from 'vuex';
import { getAccounts, getTransferNotes, getNotes } from '../api/index';

export default {
  data () {
    return {
      accounts: [],
      notes: [],
      transferNotes: [],
    };
  },
  components: {
    AccountList,
    NoteList,
    NoteBalanceList,
    NoteListTransferHistory,
  },
  computed: {
    ...mapState({
      key: state => state.key,
    }),
  },
  created () {
    getAccounts(this.key).then(async (accounts) => {
      if (accounts !== null) {
        const notes = [];
        const transferNotes = [];
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
        this.accounts = accounts;
        this.notes = notes;
        this.transferNotes = transferNotes;
      } else {
        alert('You have to make account!');
      }
    });
  },
  methods: {
    addNewAccount (account) {
      this.accounts.push(account);
    },
    addNewNote (note) {
      this.notes.push(note);
    },
  },
};
</script>
