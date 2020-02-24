<template>
  <div class="container">
    <div class="container-header">
      <img src="../../../../assets/icons/exchange/allnotes.png" />
      <h3>All Notes</h3>
    </div>
    <div class="table-container">
      <standard-table
        :type="'note'"
        :clickable="true"
        :columns="[
          {
            title: 'Note Hash',
            data: 'noteHash',
            options: [],
          },
          {
            title: 'Owner',
            data: 'owner',
            options: [],
          },
          {
            title: 'Token',
            data: 'token',
            options: [],
          },
          {
            title: 'Value',
            data: 'value',
            options: [],
          },
          {
            title: 'State',
            data: 'state',
            options: [],
          },
        ]"
        :datas="$store.state.notes"
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
};
</script>

<style lang="scss" scoped>
@import "NoteContainer.scss";
</style>
