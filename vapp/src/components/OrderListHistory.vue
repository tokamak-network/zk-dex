<template>
  <div style="text-align: center;">
    <h2 style="margin-bottom: 20px;">Order History</h2>
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Note Hash</th>
            <th>Type</th>
            <th>Token</th>
            <th>Value</th>
            <th>From</th>
            <th>To</th>
            <th>Change</th>
            <th>Transaction</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="note in notes" @click="selectNote(note)" :class="{ 'is-selected': note == selectedNote }">
            <td>{{ note.token | hexToNumberString | tokenType }}</td>
            <td>{{ note.value | hexToNumberString }}</td>
            <td>{{ note.state | noteState }}</td>
            <td>{{ note.isSmart | hexToNumberString | isSmartNote }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import { constants } from '../../../scripts/lib/Note';
import { getNotes } from '../api/index';

export default {
  data () {
    return {
      notes: [],
      selectedNote: null,
    };
  },
  computed: mapState({
    coinbase: state => state.web3.coinbase,
    secretKey: state => state.secretKey,
    account: state => state.account,
  }),
  methods: {
    ...mapActions(['setNote', 'setMyNotes']),
    selectNote (note) {
      this.selectedNote = note;
      this.setNote(note);
    },
    mappedNotes (notes) {
      return notes.map((note) => {
        const n = {};
        n.token = note.token === constants.ETH_TOKEN_TYPE ? 'eth' : 'dai';
        n.value = parseInt(note.value);

        return n;
      });
    },
    // handleNoteToMakeOrder (index, note) {
    //   this.setNote(this.notes[index]);
    //   this.$router.push({ path: '/make' });
    // },
    // handleNoteToTakeOrder (index, note) {
    //   this.setNote(this.notes[index]);
    //   this.$router.push({ path: '/take' });
    // },
    // handleNoteToTransfer (index, note) {
    //   this.setNote(this.notes[index]);
    //   this.$router.push({ path: '/transfer' });
    // },
  },
  created () {
    getNotes(this.secretKey).then((notes) => {
      this.notes = notes;
    });
  },
};
</script>
