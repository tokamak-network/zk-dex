<template>
  <div class="container">
    <div class="account-export-container">
      <div class="account-info-container">
        <!-- TODO: account condition check -->
        <p v-if="account !== ''">account</p>
        <p>{{ account }}</p>
      </div>
      <input-account
        labelType="password"
      />
      <button>Unlock</button>
      <div class="export-button-container">
        <button class="export">Export to Keystore FIle</button>
        <button class="export">Export to Private Key</button>
      </div>
    </div>
  </div>
</template>

<script>
import InputAccount from '../../../../components/Inputs/InputAccount';

export default {
  components: {
    InputAccount,
  },
  data () {
    return {
      account: '',
    };
  },
  created () {
    this.$bus.$on('tableDataSelected', (account) => {
      this.account = account.address;
    });
  },
  beforeDestroy () {
    this.$bus.$off('tableDataSelected', () => {});
  },
};
</script>

<style lang="scss" scoped>
@import "AccountExportContainer.scss";
</style>
