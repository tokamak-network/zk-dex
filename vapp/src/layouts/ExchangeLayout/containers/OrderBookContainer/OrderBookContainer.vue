<template>
  <div class="container">
    <div class="container-header">
      <img src="../../../../assets/icons/exchange/orderbook.png" />
      <h3>Order Book</h3>
    </div>
    <div class="table-container">
      <standard-table
        :type="'orderBook'"
        :clickable="true"
        :columns="[
          {
            title: 'Price',
            data: 'price',
            options: [],
          },
          {
            title: 'Orders',
            data: 'numOrders',
            options: [],
          }
        ]"
        :datas="$store.getters.orderBook"
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
@import "OrderBookContainer.scss";
</style>
