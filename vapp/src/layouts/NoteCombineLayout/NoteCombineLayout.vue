<template>
  <div class="note-combine-layout">
    <balance-container />
    <note-container style="margin-top: 24px;" />
    <note-combine-container style="margin-top: 24px; padding-bottom: 24px;" />
  </div>
</template>

<script>
import NoteContainer from '../DashboardLayout/containers/NoteContainer';
import BalanceContainer from '../DashboardLayout/containers/BalanceContainer';
import NoteCombineContainer from '../DashboardLayout/containers/NoteCombineContainer';

export default {
  components: {
    NoteContainer,
    BalanceContainer,
    NoteCombineContainer,
  },
};
</script>
