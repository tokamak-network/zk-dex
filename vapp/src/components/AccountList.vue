<template>
  <div class="box">
    <div class="columns is-vcentered">
      <div class="column" style="float: left;">
        <p style="margin-left: 10px;">Accounts</p>
      </div>
      <div style="float: right; margin-top: 10px; margin-right: 20px;" v-if="$route.path === '/'">
        <button class="button" @click="createNewAccount" :class="{ 'is-loading': !done }">CREATE NEW ACCOUNT</button>
      </div>
    </div>
    <table class="table fixed_header">
      <thead>
        <tr>
          <th>Index</th>
          <th>Address</th>
          <th>Name</th>
          <th>Total Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(account, index) in accounts">
          <td>{{index}}</td>
          <td>{{account.address | abbreviate}}</td>
          <td>{{account.name}}</td>
          <td>{{account.numberOfNotes}}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { mapActions, mapMutations, mapState } from 'vuex';
import { createAccount, addAccount, getAccounts } from '../api/index';

export default {
  data () {
    return {
      done: true,
    };
  },
  props: ['accounts'],
  computed: {
    ...mapState({
      key: state => state.key,
    }),
  },
  methods: {
    ...mapMutations(['MUTATE_ACCOUNTS']),
    createNewAccount () {
      this.done = false;
      createAccount().then((res) => {
        const account = {
          address: res.data.address,
          name: '',
          numberOfNotes: 0,
        };
        addAccount(this.key, account).then(() => {
          this.$emit('addNewAccount', account);
          this.done = true;
        });
      });
    },
  },
};
</script>
