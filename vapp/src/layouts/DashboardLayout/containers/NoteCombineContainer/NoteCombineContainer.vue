<template>
  <div class="container">
    <div class="container-header">
      <h3>Selected Notes</h3>
    </div>
    <div class="table-container">
      <standard-table
        :columns="columns"
        :datas="datas"
      />
    </div>
    <div class="note-combine-container">
      <div class="input-text-container">
        <input-text />
        <input-text />
      </div>
      <button class="combine">Combine</button>
    </div>
  </div>
</template>

<script>
import StandardTable from '../../../../components/StandardTable';
import InputText from '../../../../components/Inputs/InputText';

export default {
  components: {
    StandardTable,
    InputText,
  },
  data () {
    return {
      columns: [
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
      ],
      datas: [
        {
          noteHash: '10',
          owner: 100,
          token: 100,
          value: 100,
          state: 100,
        },
        {
          noteHash: '10',
          owner: 100,
          token: 100,
          value: 100,
          state: 100,
        },
        {
          noteHash: '10',
          owner: 100,
          token: 100,
          value: 100,
          state: 100,
        },
        {
          noteHash: '10',
          owner: 100,
          token: 100,
          value: 100,
          state: 100,
        },
        {
          noteHash: '10',
          owner: 100,
          token: 100,
          value: 100,
          state: 100,
        },
        {
          noteHash: '10',
          owner: 100,
          token: 100,
          value: 100,
          state: 100,
        },
        {
          noteHash: '10',
          owner: 100,
          token: 100,
          value: 100,
          state: 100,
        },
        {
          noteHash: '10',
          owner: 100,
          token: 100,
          value: 100,
          state: 100,
        },
        {
          noteHash: '10',
          owner: 100,
          token: 100,
          value: 100,
          state: 100,
        },
        {
          noteHash: '10',
          owner: 100,
          token: 100,
          value: 100,
          state: 100,
        },
        {
          noteHash: '10',
          owner: 100,
          token: 100,
          value: 100,
          state: 100,
        },
      ],
    };
  },
};
</script>

<style lang="scss" scoped>
@import "NoteCombineContainer.scss";
</style>
