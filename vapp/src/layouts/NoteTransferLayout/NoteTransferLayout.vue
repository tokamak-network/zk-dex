<template>
  <div class="note-transfer-layout">
    <note-container
      :clickable="true"
      :datas="generalAndValidNotes"
    />
    <note-transfer-container style="margin-top: 24px; padding-bottom: 24px;" />
  </div>
</template>

<script>
import { mapGetters } from 'vuex';

import NoteContainer from '../DashboardLayout/containers/NoteContainer';
import NoteTransferContainer from '../DashboardLayout/containers/NoteTransferContainer';

export default {
  components: {
    NoteContainer,
    NoteTransferContainer,
  },
  computed: {
    ...mapGetters([
      'generalAndValidNotes',
    ]),
  },
};
</script>
