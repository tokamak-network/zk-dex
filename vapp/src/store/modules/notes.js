import Vue from 'vue';

const state = {
  notes: [],
  noteTransferHistories: [],
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
  SET_NOTE_TRANSFER_HISTORIES: (state, histories) => {
    state.noteTransferHistories = histories;
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
  setNoteTransferHistories ({ commit }, histories) {
    commit('SET_NOTE_TRANSFER_HISTORIES', histories);
  },
};

export default {
  state,
  mutations,
  actions,
};
