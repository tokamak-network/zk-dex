<template>
  <div class="account-delete-layout">
    <account-container
      :clickable="true"
    />
    <account-delete-container />
  </div>
</template>

<script>
import AccountContainer from '../DashboardLayout/containers/AccountContainer';
import AccountDeleteContainer from '../DashboardLayout/containers/AccountDeleteContainer';

export default {
  components: {
    AccountContainer,
    AccountDeleteContainer,
  },
};
</script>

<style lang="scss" scoped>
@import "AccountDeleteLayout.scss";
</style>
