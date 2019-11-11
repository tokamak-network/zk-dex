<template>
  <div class="container">
    <div class="container-header">
      <img src="../../../../assets/icons/components/recentnotetransfer.png" />
      <h3>Recent Note Transfer</h3>
    </div>
    <div class="table-container">
      <standard-table
        :type="'noteTransferHistory'"
        :columns="columns"
        :datas="$store.state.note.noteTransferHistory"
      />
    </div>
  </div>
</template>

<script>
import StandardTable from '../../../../components/StandardTable';

export default {
  components: {
    StandardTable,
  },
  methods: {
    showModal () {
      this.$refs['create-account'].$refs['create-account-modal'].show();
    },
  },
};
</script>

<style lang="scss" scoped>
@import "NoteTransferHistoryContainer.scss";
</style>
