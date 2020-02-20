<template>
  <div>
    <account-container />
    <note-transfer-history-container style="margin-top: 24px;"/>
  </div>
</template>

<script>
import AccountContainer from '../DashboardLayout/containers/AccountContainer';
import NoteTransferHistoryContainer from '../DashboardLayout/containers/NoteTransferHistoryContainer';

export default {
  components: {
    AccountContainer,
    NoteTransferHistoryContainer,
  },
};
</script>
