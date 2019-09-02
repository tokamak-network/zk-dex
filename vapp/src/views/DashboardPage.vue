<template>
  <div class="container columns">
    <div class="column is-one-fifth">
      <aside class="menu">
        <ul class="menu-list">
          <li>
            <router-link to="/">Summary</router-link>
          </li>
        </ul>
        <p class="menu-label" style="margin-top: 30px;">
          Accounts
        </p>
        <ul class="menu-list">
          <li>
            <router-link to="/accounts/import">Import</router-link>
          </li>
          <li>
            <router-link to="/accounts/export">Export</router-link>
          </li>
          <li>
            <router-link to="/accounts/delete">Delete</router-link>
          </li>
        </ul>
        <p class="menu-label" style="margin-top: 30px;">
          Wallets
        </p>
        <ul class="menu-list">
          <li>
            <router-link to="/wallet">My Wallet</router-link>
          </li>
          <li>
            <router-link to="/transfer">Transfer</router-link>
          </li>
          <li>
            <router-link to="/combine">Combine</router-link>
          </li>
          <li>
            <router-link to="/convert">Convert</router-link>
          </li>
        </ul>
        <p class="menu-label" style="margin-top: 30px;">
          History
        </p>
        <ul class="menu-list">
          <li>
            <router-link to="/notes/transfer">Note Transfer</router-link>
          </li>
        </ul>
        <ul class="menu-list">
          <li>
            <router-link to="/orders">Order</router-link>
          </li>
        </ul>
      </aside>
    </div>
    <div class="column">
      <router-view />
    </div>
  </div>
</template>

<script>
export default {};
</script>
