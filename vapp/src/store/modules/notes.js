import Vue from 'vue';

const state = {
  notes: [],
  // noteTransferHistory: [
  //   {
  //     noteHash: '0x1234',
  //     type: 'eth',
  //     token: 'ether',
  //     value: 100,
  //     from: '0x2..2',
  //     to: '0x1..1',
  //     change: '0x1234',
  //     transactionHash: '1234',
  //   },
  // ],
};

const mutations = {
  ADD_NOTE: (state, note) => {
    state.notes.push(note);
  },
  SET_NOTES: (state, notes) => {
    state.notes = notes;
  },
  DELETE_NOTES: (state) => {
    state.notes = [];
  },
  UPDATE_NOTE: (state, note) => {
    const index = state.notes.map(n => n.hash).indexOf(note.hash);
    Vue.set(state.notes, index, note);
  },
};

const actions = {
  addNote ({ commit }, note) {
    commit('ADD_NOTE', note);
  },
  setNotes ({ commit }, notes) {
    commit('SET_NOTES', notes);
  },
  deleteNotes ({ commit }, note) {
    commit('DELETE_NOTES', note);
  },
  updateNote ({ commit }, note) {
    commit('UPDATE_NOTE', note);
  },
};

export default {
  state,
  mutations,
  actions,
};
