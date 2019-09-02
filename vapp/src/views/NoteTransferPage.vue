<template>
  <div>
    <note-transfer :notes="notes" />
    <note-list :notes="notes" />
  </div>
</template>

<script>
import NoteList from '../components/NoteList';
import NoteTransfer from '../components/NoteTransfer';

import { mapState, mapMutations } from 'vuex';
import { getAccounts, getNotes } from '../api/index';

export default {
  components: {
    NoteList,
    NoteTransfer,
  },
  computed: {
    ...mapState({
      key: state => state.key,
      accounts: state => state.accounts,
      notes: state => state.notes,
    }),
  },
  created () {
    if (this.accounts === null) {
      getAccounts(this.key).then(async (a) => {
        const accounts = [];
        const notes = [];

        if (a !== null) {
          accounts.push(...a);
          for (let i = 0; i < accounts.length; i++) {
            const n = await getNotes(accounts[i].address);
            if (n !== null) {
              notes.push(...n);
            }
          }
        }
        this.SET_ACCOUNTS(accounts);
        this.SET_NOTES(notes);
      });
    }
  },
  methods: {
    ...mapMutations(['SET_ACCOUNTS', 'SET_NOTES']),
  },
};
</script>
