<template>
  <div class="container">
    <div class="container-header">
      <img src="../../../../assets/icons/components/balance.png" class="balance" />
      <h3>Total Balance</h3>
    </div>
    <div class="table-container">
      <standard-table
        :type="'balance'"
        :clickable="false"
        :columns="[
          {
            title: 'Currency Name',
            data: 'name',
            options: [],
          },
          {
            title: 'Symbol',
            data: 'symbol',
            options: [],
          },
          {
            title: 'Valid Total Notes',
            data: 'numNotes',
            options: [],
          },
          {
            title: 'Available Balance',
            data: 'totalBalance',
            options: [],
          }
        ]"
        :datas="balanceOfNotes"
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
      'balanceOfNotes',
    ]),
  },
};
</script>

<style lang="scss" scoped>
@import "BalanceContainer.scss";
</style>
