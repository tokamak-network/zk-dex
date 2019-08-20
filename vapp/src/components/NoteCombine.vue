<template>
  <div class="box" style="text-align: center;">
    <div style="float: left;">
      <p style="margin-left: 10px; margin-bottom: 20px;">Selected Notes</p>
    </div>
    <table class="table fixed_header">
      <thead>
        <tr>
          <th>Note Hash</th>
          <th>Owner</th>
          <th>Token</th>
          <th>VALUE</th>
          <th>STATE</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="note in selectedNotes" @click="unselectNote(note)">
          <td>{{ note.hash | abbreviate }}</td>
          <td>{{ note.owner | address | abbreviate }}</td>
          <td>{{ note.token | hexToNumberString | tokenType }}</td>
          <td>{{ note.value | hexToNumberString }}</td>
          <td>{{ note.state | noteState }}</td>
        </tr>
      </tbody>
    </table>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          Total Amount
        </a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">
          {{ totalAmount }}
        </a>
      </p>
    </div>
    <div class="field has-addons">
      <p class="control">
        <a class="button is-static" style="width: 140px">
          To
        </a>
      </p>
      <p class="control is-expanded">
        <a class="button is-static" style="width: 100%;">
          {{ account }}
        </a>
      </p>
    </div>
    <div style="margin-top: 10px; display: flex; justify-content: flex-end">
      <button class="button" @click="combineNote" :class="{ 'is-static': selectedNotes.length === 0, 'is-loading': loading }">Combine</button>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex';

import Web3Utils from 'web3-utils';
import { Note } from '../../../scripts/lib/Note';
import { addNote, updateNote, generateProof } from '../api/index';

export default {
  data () {
    return {
      loading: false,
      selectedNotes: [],
    };
  },
  props: ['account'],
  computed: {
    ...mapState({
      note: state => state.note,
      coinbase: state => state.web3.coinbase,
      dex: state => state.dexContractInstance,
      viewingKey: state => state.viewingKey,
    }),
    totalAmount () {
      let totalAmount = Web3Utils.toBN('0');
      for (const note of this.selectedNotes) {
        const noteValue = Web3Utils.toBN(note.value);
        totalAmount = totalAmount.add(noteValue);
      }
      return Web3Utils.hexToNumberString(Web3Utils.toHex(totalAmount));
    },
  },
  mounted () {
    this.$store.watch(
      (state, getters) => getters.note,
      () => {
        if (!this.selectedNotes.includes(this.note)) {
          this.selectedNotes.push(this.note);
        }
      }
    );
  },
  methods: {
    unselectNote (note) {
      const i = this.selectedNotes.indexOf(note);
      if (i > -1) {
        this.selectedNotes.splice(i, 1);
      }
    },
    combineNote () {},
  },
};
</script>
