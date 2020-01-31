<template>
  <div class="container">
    <div class="container-header">
      <img src="../../../../assets/icons/exchange/orderhistory.png" />
      <h3>ORDER HISTORY</h3>
    </div>
    <div class="table-container">
      <standard-table
        :type="'orderHistory'"
        :datas="$store.getters.orderHistory"
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
@import "OrderHistoryContainer.scss";
</style>
