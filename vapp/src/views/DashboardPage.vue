<template>
  <div class="container columns">
    <div class="column is-one-fifth" style="padding-left: 20px;">
      <aside class="menu">
        <ul class="menu-list">
          <li>
            <router-link to="/">Dashboard</router-link>
          </li>
        </ul>
        <p class="menu-label" style="margin-top: 30px;">Wallets</p>
        <ul class="menu-list">
          <li>
            <router-link to="/zaccounts">zAccounts</router-link>
          </li>
          <li>
            <router-link to="/wallet">Notes</router-link>
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
        <p class="menu-label" style="margin-top: 30px;">History</p>
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

<script setup lang="ts">
// Dashboard page - layout component
</script>
