<template>
  <div>
    <note-container
      :datas="$store.state.notes"
      :clickable="true"
    />
    <!-- :datas="smartNotes" -->
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
      'smartNotes',
    ]),
  },
  components: {
    NoteContainer,
    NoteConvertContainer,
  },
};
</script>
