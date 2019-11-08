<template>
  <div class="container">
    <div class="container-header">
      <img src="../../../../assets/icons/exchange/tradehistory.png" />
      <h3>Trade History</h3>
    </div>
    <div class="table-container">
      <standard-table
        :type="'orderHistory'"
        :clickable=true
        :datas="$store.getters.orderHistory"
      />
        <!-- :datas="datas" -->
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
@import "TradeHistoryContainer.scss";
</style>
