<template>
  <div>
    <balance-container />
    <note-container style="margin-top: 24px;" />
  </div>
</template>

<script>
import NoteContainer from '../DashboardLayout/containers/NoteContainer';
import BalanceContainer from '../DashboardLayout/containers/BalanceContainer';

export default {
  components: {
    NoteContainer,
    BalanceContainer,
  },
};
</script>
