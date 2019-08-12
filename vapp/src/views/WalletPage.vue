<template>
  <div>
    <section class="section">
      <div class="container">
        <account-list />
        <div style="height: 100px;" />
        <account-list-balance />
        <div style="height: 100px;" />
        <note-list-manage />
        <div style="height: 100px;" />
        <note-list-history />
      </div>
    </section>
  </div>
</template>

<script>
import AccountList from '../components/AccountList.vue';
import AccountListBalance from '../components/AccountListBalance.vue';
import NoteListManage from '../components/NoteListManage.vue';
import NoteListHistory from '../components/NoteListHistory.vue';

export default {
  components: {
    AccountList,
    AccountListBalance,
    NoteListManage,
    NoteListHistory,
  },
};
</script>
