<template>
  <div>
    <div v-if="action === 'mint'">
      <note-mint :accounts="accounts" :token="token" />
    </div>
    <div v-else-if="action === 'liquidate'">
      <note-list :notes="notes" />
      <note-liquidate :accounts="accounts" :token="token" />
    </div>
  </div>
</template>

<script>
import NoteList from '../components/NoteList';
import NoteMint from '../components/NoteMint';
import NoteLiquidate from '../components/NoteLiquidate';

import { mapState } from 'vuex';
import { getAccounts, getNotes } from '../api/index';
import Web3Utils from 'web3-utils';

export default {
  components: {
    NoteList,
    NoteMint,
    NoteLiquidate,
  },
  data () {
    return {
      accounts: [],
      notes: [],
    };
  },
  created () {
    const query = this.$route.query;
    this.action = query.action;
    this.token = query.token;

    let type;
    if (this.token === 'ETH') {
      type = '0';
    } else if (this.token === 'DAI') {
      type = '1';
    }

    getAccounts(this.key).then(async (accounts) => {
      if (accounts !== null) {
        this.accounts = accounts;

        if (this.action === 'liquidate') {
          const notes = [];
          for (let i = 0; i < accounts.length; i++) {
            const n = await getNotes(accounts[i].address);
            if (n != null) {
              const f = n.filter(note => Web3Utils.hexToNumberString(note.token) === type);
              notes.push(...f);
            }
          }
          this.notes = notes;
        }
      }
    });
  },
  computed: {
    ...mapState({
      key: state => state.key,
    }),
  },
};
</script>
