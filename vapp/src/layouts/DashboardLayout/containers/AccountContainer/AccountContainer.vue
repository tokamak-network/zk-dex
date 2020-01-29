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
        :datas="$store.state.account.accounts"
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
  computed: mapState({
    key: state => state.app.key,
  }),
  methods: {
    async addAccount (password) {
      const account = await this.createAccount(password);
      try {
        this.$store.dispatch('addAccount', (await api.addAccount(this.key, account)));
      } catch (err) {
        console.log(err);
      } finally {
        this.showModal = false;
      }
    },
    async createAccount (password) {
      const account = await api.createAccount(password);
      const index = String(this.$store.state.account.accounts.length + 1);
      return {
        index,
        address: account.data.address,
        name: '',
        totalNoteAmount: '0',
        password: password,
      };
    },
  },
};
</script>

<style lang="scss" scoped>
@import "AccountContainer.scss";
</style>
