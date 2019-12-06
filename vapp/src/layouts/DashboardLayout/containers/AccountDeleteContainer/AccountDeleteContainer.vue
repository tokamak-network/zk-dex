<template>
  <div class="container">
    <div class="account-delete-container">
      <p>Warning!</p>
      <p>Liquidate or transfer note before delete account.</p>
      <p>Any notes owned by an account will be lost after the account deleted.</p>
      <p>Please type in the address of the account.</p>
      <input-account />
      <div>
        <button class="cancel">Cancel</button>
        <button class="delete">Delete</button>
      </div>
    </div>
  </div>
</template>

<script>
import InputAccount from '../../../../components/Inputs/InputAccount';

export default {
  components: {
    InputAccount,
  },
  created () {
    this.$bus.$on('tableDataSelected', (account) => {
      this.account = account.address;
    });
  },
  beforeDestroy () {
    this.$bus.$off('tableDataSelected', () => {});
  },
};
</script>

<style lang="scss" scoped>
@import "AccountDeleteContainer.scss";
</style>
