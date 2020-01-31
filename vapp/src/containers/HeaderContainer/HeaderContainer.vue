<template>
  <div class="header-container">
    <div class="header">
      <div class="logo">
        <p>ZK-DEX</p>
      </div>
      <router-link to="/" class="header-button">
        <button
          :class="$route.path !== '/exchange'
          ? 'selected'
          : 'unselected'"
          class="interval"
        >
          Dashboard
        </button>
      </router-link>
      <router-link to="/exchange" class="header-button">
        <button
          :class="$route.path === '/exchange'
          ? 'selected'
          : 'unselected'"
        >
          Exchange
        </button>
      </router-link>
    </div>
  </div>
</template>

<script>
export default {
};
</script>

<style lang="scss" scoped>
@import "HeaderContainer.scss";
</style>
