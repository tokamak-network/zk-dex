<template>
  <div class="container">
    <div class="container-header">
      <img src="../../../../assets/icons/exchange/ongoingorders.png" />
      <h3>Ongoing Orders</h3>
    </div>
    <div class="table-container">
      <standard-table
        :type="'ongoingOrder'"
        :columns="columns"
        :datas="$store.state.order.orders"
      />
    </div>
  </div>
</template>

<script>
// TODO: if header 2 line, weirde tbody
import StandardTable from '../../../../components/StandardTable';

export default {
  components: {
    StandardTable,
  },
};
</script>

<style lang="scss" scoped>
@import "OrderOngoingContainer.scss";
</style>
