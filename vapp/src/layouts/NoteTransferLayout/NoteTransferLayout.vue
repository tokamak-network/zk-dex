<template>
  <div class="note-transfer-layout">
    <balance-container />
    <note-container
      style="margin-top: 24px;"
      :clickable="true"
      :datas="$store.state.notes"
    />
    <note-transfer-container style="margin-top: 24px; padding-bottom: 24px;" />
  </div>
</template>

<script>
import NoteContainer from '../DashboardLayout/containers/NoteContainer';
import BalanceContainer from '../DashboardLayout/containers/BalanceContainer';
import NoteTransferContainer from '../DashboardLayout/containers/NoteTransferContainer';

export default {
  components: {
    BalanceContainer,
    NoteContainer,
    NoteTransferContainer,
  },
};
</script>
