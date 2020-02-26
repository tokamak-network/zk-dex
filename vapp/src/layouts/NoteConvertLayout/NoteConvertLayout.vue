<template>
  <div>
    <note-container
      :datas="smartAndValidNotes"
      :clickable="true"
    />
    <note-convert-container
      style="margin-top: 24px;"
    />
  </div>
</template>

<script>
import { mapGetters } from 'vuex';

import NoteContainer from '../DashboardLayout/containers/NoteContainer';
import NoteConvertContainer from '../DashboardLayout/containers/NoteConvertContainer';

export default {
  computed: {
    ...mapGetters([
      'smartAndValidNotes',
    ]),
  },
  components: {
    NoteContainer,
    NoteConvertContainer,
  },
};
</script>
