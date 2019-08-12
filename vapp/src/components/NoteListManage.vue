<template>
  <div class="zone">
    <div>
      <note-list />
    </div>
    <div style="text-align: center;">
      <router-link to="/mint">
        <button class="button">MINT</button>
      </router-link>
      <!-- <button class="button">Delete</button>
      <button class="button">Import</button>
      <button class="button">Export</button> -->
    </div>
  </div>
</template>

<script>
import NoteList from './NoteList.vue';

export default {
  components: {
    NoteList,
  },
};
</script>

<style>
</style>
