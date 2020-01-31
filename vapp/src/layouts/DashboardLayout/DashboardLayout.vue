<template>
  <div class="dashboard-layout">
    <dashboard-menu />
    <router-view class="dashboard-layout-container" />
  </div>
</template>

<script>
import DashboardMenu from './containers/DashboardMenu';

export default {
  components: {
    DashboardMenu,
  },
};
</script>

<style lang="scss" scoped>
@import "DashboardLayout.scss";
</style>
