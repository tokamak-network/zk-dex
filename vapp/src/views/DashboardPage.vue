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
          <!-- TODO: change to accounts -->
          <li>
            <router-link to="/account/import">Import</router-link>
          </li>
          <li>
            <router-link to="/account/export">Export</router-link>
          </li>
          <li>
            <router-link to="/account/delete">Delete</router-link>
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
        </ul>
        <p class="menu-label" style="margin-top: 30px;">
          History
        </p>
        <ul class="menu-list">
          <li>
            <!-- TODO: change to notes -->
            <router-link to="/note/transfer">Note Transfer</router-link>
          </li>
        </ul>
        <ul class="menu-list">
          <li>
            <!-- TODO: change to orders -->
            <router-link to="/order">Order</router-link>
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
