<template>
  <div>
    <div class="dropdown-open-button" @click="dropdownOpen = !dropdownOpen">
      <p>{{ selectedAccount }}</p>
    </div>
    <div v-if="dropdownOpen" class="dropdown-list">
      <ul>
        <li
          v-for="account in $store.state.account.accounts"
          @click="selectAccount(account)"
        >
          {{ account.address }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  data () {
    return {
      selectedAccount: 'Select Account',
      dropdownOpen: false,
    };
  },
  created () {
    document.addEventListener('click', (e) => {
      if (!this.$el.contains(e.target)) {
        this.dropdownOpen = false;
      }
    });
  },
  beforeDestroy () {
    document.removeEventListener('click', (e) => {
      if (!this.$el.contains(e.target)) {
        this.dropdownOpen = false;
      }
    });
  },
  methods: {
    selectAccount (account) {
      this.selectedAccount = account.address;
      this.$emit('accountSelected', account);

      this.dropdownOpen = false;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "DropdownAccountSelector.scss";
</style>
