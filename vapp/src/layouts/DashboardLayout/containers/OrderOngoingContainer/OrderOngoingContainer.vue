<template>
  <div class="container">
    <div class="container-header">
      <img src="../../../../assets/icons/exchange/ongoingorders.png" />
      <h3>Ongoing Orders</h3>
    </div>
    <div class="table-container">
      <standard-table
        :type="'order'"
        :datas="ongoingOrders"
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
          },
        ]"
      />
    </div>
  </div>
</template>

<script>
import StandardTable from '../../../../components/StandardTable';

import { mapGetters } from 'vuex';

export default {
  components: {
    StandardTable,
  },
  computed: {
    ...mapGetters([
      'ongoingOrders',
    ]),
  },
};
</script>

<style lang="scss" scoped>
@import "OrderOngoingContainer.scss";
</style>
