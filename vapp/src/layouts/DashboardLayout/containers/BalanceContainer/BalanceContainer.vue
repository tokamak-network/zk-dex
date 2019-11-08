<template>
  <div class="container">
    <div class="container-header">
      <img src="../../../../assets/icons/components/balance.png" class="balance" />
      <h3>Total Balance</h3>
      <dropdown-account-selector
        v-on:accountSelected="accountSelected"
      />
    </div>
    <div class="table-container">
      <!-- TODO: use balance by account, not total balance. -->
      <standard-table
        :type="'balance'"
        :clickable=false
        :datas="$store.state.note.balance"
      />
    </div>
  </div>
</template>

<script>
import StandardTable from '../../../../components/StandardTable';
import DropdownAccountSelector from '../../../../components/DropdownAccountSelector';

export default {
  components: {
    StandardTable,
    DropdownAccountSelector,
  },
  methods: {
    accountSelected (account) {},
  },
};
</script>

<style lang="scss" scoped>
@import "BalanceContainer.scss";
</style>
