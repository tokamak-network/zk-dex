<template>
  <div class="account-export-layout">
    <account-container
      :clickable=true
    />
    <account-export-container />
  </div>
</template>

<script>
import AccountContainer from '../DashboardLayout/containers/AccountContainer';
import AccountExportContainer from '../DashboardLayout/containers/AccountExportContainer';

export default {
  components: {
    AccountContainer,
    AccountExportContainer,
  },
};
</script>

<style lang="scss" scoped>
@import "AccountExportLayout.scss";
</style>
