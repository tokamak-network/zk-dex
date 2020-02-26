<template>
  <div>
    <note-container
      :datas="generalAndValidNotes"
      :clickable="true"
    />
    <note-liquidate-container
      style="margin-top: 24px;"
    />
  </div>
</template>

<script>
import { mapGetters } from 'vuex';

import NoteContainer from '../DashboardLayout/containers/NoteContainer';
import NoteLiquidateContainer from '../DashboardLayout/containers/NoteLiquidateContainer';

export default {
  computed: {
    ...mapGetters([
      'generalAndValidNotes',
    ]),
  },
  components: {
    NoteContainer,
    NoteLiquidateContainer,
  },
};
</script>
