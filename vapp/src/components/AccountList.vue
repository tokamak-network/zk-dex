<template>
  <div class="box">
    <div class="columns is-vcentered">
      <div class="column" style="float: left;">
        <p style="margin-left: 10px;">Accounts</p>
      </div>
      <div style="float: right; margin-top: 10px; margin-right: 20px;" v-if="$route.path === '/'">
        <button class="button" @click="activeModal" :class="{ 'is-loading': !done }">CREATE NEW ACCOUNT</button>
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
        <tr v-for="(account, index) in accounts" @click="selectAccount(account)">
          <td>{{ index }}</td>
          <td>{{ account.address }}</td>
          <td>{{ account.name }}</td>
          <td>{{ getNumberOfNotesInAccount(account) }}</td>
        </tr>
      </tbody>
    </table>
    <b-modal :active.sync="createAccountModalActive" :width="640" scroll="keep" class="hide-footer centered">
      <form action="">
        <div class="modal-card" style="width: auto">
          <header class="modal-card-head">
            <p class="modal-card-title">Create New Account</p>
          </header>
          <section class="modal-card-body">
            <b-field label="Passphrase">
              <b-input type="password" v-model="passphrase" password-reveal placeholder="Your password" required>
              </b-input>
            </b-field>
          </section>
          <footer class="modal-card-foot">
            <button class="button" :class="{ 'is-static': passphrase === ''}" @click="createNewAccount">Create</button>
          </footer>
        </div>
      </form>
    </b-modal>
  </div>
</template>

<script>
import { mapMutations, mapState, mapGetters } from 'vuex';
import { createAccount, addAccount } from '../api/index';

export default {
  data () {
    return {
      done: true,
      createAccountModalActive: false,
      passphrase: '',
    };
  },
  props: ['accounts'],
  computed: {
    ...mapState({
      key: state => state.key,
    }),
    ...mapGetters(['numberOfNotesInAccount']),
  },
  methods: {
    ...mapMutations(['ADD_ACCOUNT']),
    getNumberOfNotesInAccount (account) {
      return this.numberOfNotesInAccount(account);
    },
    selectAccount (account) {
      this.$bus.$emit('select-account', account);
    },
    // TODO: refactoring
    createNewAccount () {
      this.done = false;
      createAccount(this.passphrase).then((res) => {
        const keystore = res.data.address;
        const account = {};
        account.keystore = keystore;
        account.address = `0x${keystore.address}`;
        account.name = '';
        account.numberOfNotes = 0;

        addAccount(this.key, account).then(() => {
          this.ADD_ACCOUNT(account);
          this.createAccountModalActive = false;
          this.done = true;
          this.passphrase = '';
        });
      });
    },
    activeModal () {
      this.createAccountModalActive = true;
    },
  },
};
</script>
