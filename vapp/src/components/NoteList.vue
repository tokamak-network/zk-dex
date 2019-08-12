<template>
  <div style="text-align: center;">
    <h2 style="margin-bottom: 20px;">MY NOTES</h2>
    <table class="table">
      <thead>
        <tr>
          <th>Note Hash</th>
          <th>Owner</th>
          <th>Token</th>
          <th>VALUE</th>
          <th>STATE</th>
          <!-- <th>IS SMART</th> -->
        </tr>
      </thead>
      <tbody>
        <tr v-for="note in notes" @click="selectNote(note)" :class="{ 'is-selected': note == selectedNote }">
          <td>{{ note.hash | abbreviate }}</td>
          <td>{{ note.owner | abbreviate }}</td>
          <td>{{ note.token | hexToNumberString | tokenType }}</td>
          <td>{{ note.value | hexToNumberString }}</td>
          <td>{{ note.state | noteState }}</td>
        </tr>
      </tbody>
    </table>
    <!-- <p>selected note: {{ selectedNote }}</p> -->
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
  computed: {
    ...mapState({
      accounts: state => state.accounts,
    }),
  },
  methods: {
    ...mapActions(['setNote']),
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
    async getNotes () {
      this.notes = [];
      for (let i = 0; i < this.accounts.length; i++) {
        const notes = await getNotes(this.accounts[i].address);
        if (notes != null) {
          this.notes.push(...notes);
        }
      }
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
  mounted () {
    this.getNotes();
    this.$store.watch(
      (state, getters) => getters.accounts,
      () => {
        this.getNotes();
      }
    );
  },
};
</script>
