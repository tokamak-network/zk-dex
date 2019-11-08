<template>
  <div>
    <div class="dropdown-open-button" @click="dropdownOpen = !dropdownOpen">
      <p>{{ selectedToken }}</p>
    </div>
    <div v-if="dropdownOpen" class="dropdown-list">
      <ul>
        <li
          v-for="token in tokens"
          @click="selectToken(token)"
        >
          {{ token.symbol }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import Web3Utils from 'web3-utils';

const ETH_TOKEN_TYPE = Web3Utils.padLeft('0x0', 32);
const DAI_TOKEN_TYPE = Web3Utils.padLeft('0x1', 32);

export default {
  data () {
    return {
      tokens: [
        {
          symbol: 'ETH',
          type: ETH_TOKEN_TYPE,
        },
        {
          symbol: 'DAI',
          type: DAI_TOKEN_TYPE,
        },
      ],
      selectedToken: 'Select Token',
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
    selectToken (token) {
      this.selectedToken = token.symbol;
      this.$emit('tokenSelected', token);

      this.dropdownOpen = false;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "DropdownTokenSelector.scss";
</style>
