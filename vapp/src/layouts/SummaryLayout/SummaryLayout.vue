<template>
  <div>
    <account-container
      :withModal="true"
    />
    <create-note-container style="margin-top: 24px; "/>
    <note-container
      style="margin-top: 24px;"
      :datas="$store.state.notes"
      :clickable="true"
    />
    <balance-container style="margin-top: 24px;"/>
  </div>
</template>

<script>
import AccountContainer from '../DashboardLayout/containers/AccountContainer';
import CreateNoteContainer from '../DashboardLayout/containers/CreateNoteContainer';
import NoteContainer from '../DashboardLayout/containers/NoteContainer';
import BalanceContainer from '../DashboardLayout/containers/BalanceContainer';

export default {
  components: {
    AccountContainer,
    CreateNoteContainer,
    NoteContainer,
    BalanceContainer,
  },
};
</script>
