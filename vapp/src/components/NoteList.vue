<template>
  <div class="box" style="text-align: center;">
    <div style="float: left;">
      <p style="margin-left: 10px; margin-bottom: 20px;">Notes</p>
    </div>
    <table class="table fixed_header">
      <thead>
        <tr>
          <th>Note Hash</th>
          <th>Owner</th>
          <th>Token</th>
          <th>VALUE</th>
          <th>STATE</th>
          <th>SMART NOTE</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="note in notes" @click="selectNote(note)">
          <td>{{ note.hash | abbreviate}}</td>
          <td>{{ note.owner | abbreviate }}</td>
          <td>{{ note.token | tokenType }}</td>
          <td>{{ note.value | hexToNumberString }}</td>
          <td>{{ note.state | noteState }}</td>
          <td>{{ note.isSmart | isSmartNote }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import { constants } from '../../../scripts/lib/Note';
import { getNotes } from '../api/index';

export default {
  props: ['notes'],
  computed: {
    ...mapState({
      accounts: state => state.accounts,
    }),
  },
  methods: {
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
