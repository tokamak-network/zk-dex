<template>
  <div class="container">
    <div class="container-header">
      <img src="../../../../assets/icons/components/balance.png" class="balance" />
      <h3>Total Balance</h3>
      <dropdown-account-selector
        v-if="$route.path === '/notes/transfer'"
        v-on:accountSelected="accountSelected"
      />
    </div>
    <div class="table-container">
      <standard-table
        v-if="$route.path === '/notes/transfer'"
        :type="'balance'"
        :clickable=false
        :datas="$store.getters.balanceFromAccount(account)"
      />
      <standard-table
        v-else
        :type="'balance'"
        :clickable=false
        :datas="$store.getters.balance"
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
  data () {
    return {
      account: '',
    };
  },
  methods: {
    accountSelected (account) {
      this.account = account;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "BalanceContainer.scss";
</style>
