<template>
  <div class="container">
    <div class="container-header">
      <img src="../../../../assets/icons/exchange/allnotes.png" />
      <h3>All Notes</h3>
    </div>
    <div class="table-container">
      <standard-table
        :type="'note'"
        :clickable=clickable
        :datas="$store.state.note.notes"
      />
    </div>
  </div>
</template>

<script>
import StandardTable from '../../../../components/StandardTable';

export default {
  props: {
    clickable: {
      type: Boolean,
      default: false,
    },
  },
  components: {
    StandardTable,
  },
};
</script>

<style lang="scss" scoped>
@import "NoteContainer.scss";
</style>
