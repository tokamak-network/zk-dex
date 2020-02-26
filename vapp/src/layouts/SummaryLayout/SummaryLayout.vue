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
    <liquidate-note-container style="margin-top: 24px;"/>
    <balance-container style="margin-top: 24px;"/>
  </div>
</template>

<script>
import AccountContainer from '../DashboardLayout/containers/AccountContainer';
import BalanceContainer from '../DashboardLayout/containers/BalanceContainer';
import CreateNoteContainer from '../DashboardLayout/containers/CreateNoteContainer';
import LiquidateNoteContainer from '../DashboardLayout/containers/LiquidateNoteContainer';
import NoteContainer from '../DashboardLayout/containers/NoteContainer';

export default {
  components: {
    AccountContainer,
    CreateNoteContainer,
    NoteContainer,
    BalanceContainer,
    LiquidateNoteContainer,
  },
};
</script>
