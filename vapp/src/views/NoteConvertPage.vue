<template>
  <div>
    <note-list :notes="smartNotes" />
    <div class="box">
      <div class="field has-addons">
        <p class="control">
          <a class="button is-static" style="width: 140px">
            Note
          </a>
        </p>
        <p class="control is-expanded">
          <a class="button is-static" style="width: 100%;">
            {{ noteHash | abbreviate }}
          </a>
        </p>
      </div>
      <div style="margin-top: 10px; display: flex; justify-content: flex-end">
        <button class="button" @click="convertNote" :class="{ 'is-static': noteHash === '', 'is-loading': loading }">Convert</button>
      </div>
    </div>
  </div>
</template>

<script>
import NoteList from '../components/NoteList';
import NoteTransfer from '../components/NoteTransfer';

import { mapState, mapMutations, mapGetters } from 'vuex';
import { getAccounts, getNotes } from '../api/index';

export default {
  data () {
    return {
      note: null,
      noteHash: '',
      loading: false,
    };
  },
  components: {
    NoteList,
  },
  computed: {
    ...mapState({
      key: state => state.key,
      accounts: state => state.accounts,
      notes: state => state.notes,
    }),
    ...mapGetters(['smartNotes']),
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
    this.$bus.$on('select-note', this.selectNote);
  },
  beforeDestroy () {
    this.$bus.$off('select-note');
  },
  methods: {
    ...mapMutations(['SET_ACCOUNTS', 'SET_NOTES']),
    selectNote (note) {
      this.note = note;
      this.noteHash = note.hash;
    },
    convertNote () {},
  },
};
</script>
