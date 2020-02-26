<template>
  <div class="container">
    <div class="container-header">
      <img src="../../../../assets/icons/exchange/orderhistory.png" />
      <h3>Order History</h3>
    </div>
    <div class="table-container">
      <standard-table
        :type="'order'"
        :columns="[
          {
            title: 'Order ID',
            data: 'orderId',
            options: [],
          },
          {
            title: 'Type',
            data: 'type',
            options: [],
          },
          {
            title: 'Price',
            data: 'price',
            options: [],
          },
          {
            title: 'ETH Note Hash',
            data: 'ethNoteHash',
            options: [],
          },
          {
            title: 'DAI Note Hash',
            data: 'daiNoteHash',
            options: [],
          },
          {
            title: 'State',
            data: 'state',
            options: [],
          }
        ]"
        :datas="settledOrders"
      />
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';

import StandardTable from '../../../../components/StandardTable';

export default {
  components: {
    StandardTable,
  },
  computed: {
    ...mapGetters([
      'settledOrders',
    ]),
  },
};
</script>

<style lang="scss" scoped>
@import "OrderHistoryContainer.scss";
</style>
