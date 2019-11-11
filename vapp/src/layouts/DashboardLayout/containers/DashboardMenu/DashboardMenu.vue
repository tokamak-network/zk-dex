<template>
  <div class="dashboard-menu">
    <router-link class="menu-item-with-icon" to="/"
      :class="{ selected: path === '/'}"
    >
      <div class="icon-container">
        <img src="../../../../assets/icons/menu/summary.png" />
      </div>
      <p>Summary</p>
      <img class="arrow" src="../../../../assets/icons/menu/arrow.png" />
    </router-link>

    <div class="menu-item-with-icon">
      <div class="icon-container"
        :class="{ 'icon-selected-container': path === '/accounts/import' || path === '/accounts/export' || path === '/accounts/delete'}"
      >
        <img src="../../../../assets/icons/menu/account.png" />
      </div>
      <p>Account</p>
    </div>
    <router-link to="/accounts/import" class="menu-item"
      :class="{ selected: path === '/accounts/import'}"
    >
      <p>Import</p>
      <img class="arrow" src="../../../../assets/icons/menu/arrow.png" />
    </router-link>
    <router-link to="/accounts/export" class="menu-item"
      :class="{ selected: path === '/accounts/export'}"
    >
      <p>Export</p>
      <img class="arrow" src="../../../../assets/icons/menu/arrow.png" />
    </router-link>
    <router-link to="/accounts/delete" class="menu-item"
      :class="{ selected: path === '/accounts/delete'}"
    >
      <p>Delete</p>
      <img class="arrow" src="../../../../assets/icons/menu/arrow.png" />
    </router-link>

    <div class="menu-item-with-icon">
      <div class="icon-container"
        :class="{ 'icon-selected-container': path === '/wallet' || path === '/notes/transfer' || path === '/notes/combine'}"
      >
        <img src="../../../../assets/icons/menu/wallet.png" />
      </div>
      <p>Wallet</p>
    </div>
    <router-link to="/wallet" class="menu-item"
      :class="{ selected: path === '/wallet'}"
    >
      <p>My Wallet</p>
      <img class="arrow" src="../../../../assets/icons/menu/arrow.png" />
    </router-link>
    <router-link to="/notes/transfer" class="menu-item"
      :class="{ selected: path === '/notes/transfer'}"
    >
      <p>Transfer</p>
      <img class="arrow" src="../../../../assets/icons/menu/arrow.png" />
    </router-link>
    <router-link to="/notes/combine" class="menu-item"
      :class="{ selected: path === '/notes/combine'}"
    >
      <p>Combine</p>
      <img class="arrow" src="../../../../assets/icons/menu/arrow.png" />
    </router-link>

    <div class="menu-item-with-icon">
      <div class="icon-container"
        :class="{ 'icon-selected-container': path === '/notes/history' || path === '/orders/history'}"
      >
        <img src="../../../../assets/icons/menu/history.png" />
      </div>
      <p>History</p>
    </div>
    <router-link to="/notes/history" class="menu-item"
      :class="{ selected: path === '/notes/history'}"
    >
      <p>Note Transfer</p>
      <img class="arrow" src="../../../../assets/icons/menu/arrow.png" />
    </router-link>
    <router-link to="/orders/history" class="menu-item"
      :class="{ selected: path === '/orders/history'}"
    >
      <p>Order</p>
      <img class="arrow" src="../../../../assets/icons/menu/arrow.png" />
    </router-link>
  </div>
</template>

<script>
export default {
  data () {
    return {
      path: '',
    };
  },
  watch: {
    $route (to) {
      this.path = to.path;
    },
  },
  created () {
    this.path = this.$route.path;
  },
};
</script>

<style lang="scss" scoped>
@import "DashboardMenu.scss";
</style>
