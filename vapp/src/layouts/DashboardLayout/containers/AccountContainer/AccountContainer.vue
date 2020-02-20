<template>
  <div class="container">
    <create-account-modal
      v-if="showModal"
      @modalClosed="showModal=false"
      v-on:newAccountRequested="addAccount"
    />
    <div class="container-header">
      <img src="../../../../assets/icons/menu/account.png" />
      <h3>Accounts</h3>
      <button
        v-if="withModal"
        @click="showModal=true"
      >
        Create new Account
      </button>
    </div>
    <div class="table-container">
      <standard-table
        :type="'account'"
        :clickable=clickable
        :datas="accounts"
      />
    </div>
  </div>
</template>

<script>
import StandardTable from '../../../../components/StandardTable';
import CreateAccountModal from '../../../../components/CreateAccountModal';

import { mapState } from 'vuex';
import api from '../../../../api/index';

export default {
  components: {
    StandardTable,
    CreateAccountModal,
  },
  props: {
    withModal: {
      type: Boolean,
      default: false,
    },
    clickable: {
      type: Boolean,
      default: false,
    },
  },
  data () {
    return {
      showModal: false,
    };
  },
  computed: {
    ...mapState([
      'userKey',
      'accounts',
    ]),
  },
  methods: {
    async addAccount (passphrase) {
      await api.createAndAddAccount(this.userKey, passphrase);

      const accounts = await api.getAccounts(this.userKey);
      this.$store.dispatch('setAccounts', accounts);

      this.showModal = false;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "AccountContainer.scss";
</style>
