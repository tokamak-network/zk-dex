<template>
  <div>
    <note-balance-list :notes="notes" />
    <note-list :notes="notes" />
  </div>
</template>

<script>
import NoteBalanceList from '../components/NoteBalanceList';
import NoteList from '../components/NoteList';

import { mapState } from 'vuex';
import { getAccounts, getNotes } from '../api/index';

export default {
  components: {
    NoteBalanceList,
    NoteList,
  },
  data () {
    return {
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
        const notes = [];
        for (let i = 0; i < accounts.length; i++) {
          const n = await getNotes(accounts[i].address);
          if (n != null) {
            notes.push(...n);
          }
        }
        this.notes = notes;
      }
    });
  },
};
</script>
