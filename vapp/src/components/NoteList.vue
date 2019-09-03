<template>
  <div class="box" style="text-align: center;">
    <div style="float: left;">
      <p class="hoverable" style="margin-left: 10px; margin-bottom: 20px;" @click="showAllNotes">Notes</p>
    </div>
    <table class="table fixed_header">
      <thead>
        <tr>
          <th>Note Hash</th>
          <th>Owner</th>
          <th>Token</th>
          <th>VALUE</th>
          <th>STATE</th>
          <!-- <th>SMART NOTE</th> -->
        </tr>
      </thead>
      <tbody>
        <div v-if="$route.path === '/exchange'">
          <tr v-for="note in notesFilteredByOrderType" @click="selectNote(note)">
            <td>{{ note.hash | abbreviate}}</td>
            <td>{{ note.owner | abbreviate }}</td>
            <td>{{ note.token | tokenType }}</td>
            <td>{{ note.value | hexToNumberString }}</td>
            <td>{{ note.state | noteState }}</td>
            <!-- <td>{{ note.isSmart | isSmartNote }}</td> -->
          </tr>
        </div>
        <div v-else-if="$route.path === '/transfer' || $route.path === '/convert'">
          <tr v-for="note in validNotes" @click="selectNote(note)">
            <td>{{ note.hash | abbreviate}}</td>
            <td>{{ note.owner | abbreviate }}</td>
            <td>{{ note.token | tokenType }}</td>
            <td>{{ note.value | hexToNumberString }}</td>
            <td>{{ note.state | noteState }}</td>
            <!-- <td>{{ note.isSmart | isSmartNote }}</td> -->
          </tr>
        </div>
        <div v-else>
          <div v-if="isSortedByAccount">
            <tr v-for="note in notesSortedByAccounts" @click="selectNote(note)">
              <td>{{ note.hash | abbreviate}}</td>
              <td>{{ note.owner | abbreviate }}</td>
              <td>{{ note.token | tokenType }}</td>
              <td>{{ note.value | hexToNumberString }}</td>
              <td>{{ note.state | noteState }}</td>
            </tr>
          </div>
          <div v-else>
            <tr v-for="note in validNotesSortedByNoteState" @click="selectNote(note)">
              <td>{{ note.hash | abbreviate}}</td>
              <td>{{ note.owner | abbreviate }}</td>
              <td>{{ note.token | tokenType }}</td>
              <td>{{ note.value | hexToNumberString }}</td>
              <td>{{ note.state | noteState }}</td>
            </tr>
          </div>
        </div>
      </tbody>
    </table>
  </div>
</template>

<script>
import {
  mapState,
  mapActions,
  mapGetters,
  mapMutations,
} from 'vuex';
import { constants } from '../../../scripts/lib/Note';
import { getNotes } from '../api/index';

export default {
  data () {
    return {
      isSortedByAccount: false,
      notesSortedByAccounts: [],
    };
  },
  props: ['notes'],
  created () {
    this.$bus.$on('select-account', this.selectAccount);
  },
  computed: {
    ...mapState({
      accounts: state => state.accounts,
    }),
    ...mapGetters(['notesFilteredByOrderType', 'validNotesSortedByNoteState']),
    validNotes () {
      return this.notes.filter(note => note.state === '0x1');
    },
  },
  methods: {
    ...mapMutations(['SET_NOTES']),
    showAllNotes () {
      this.isSortedByAccount = false;
    },
    selectAccount (account) {
      this.isSortedByAccount = true;
      this.notesSortedByAccounts = this.notes.filter(note => note.owner === account.address);
    },
    selectNote (note) {
      this.$bus.$emit('select-note', note);
    },
    mappedNotes (notes) {
      return notes.map((note) => {
        const n = {};
        n.token = note.token === constants.ETH_TOKEN_TYPE ? 'eth' : 'dai';
        n.value = parseInt(note.value);

        return n;
      });
    },
  },
};
</script>

<style scoped>
.hoverable {
  cursor: pointer;
}
</style>
