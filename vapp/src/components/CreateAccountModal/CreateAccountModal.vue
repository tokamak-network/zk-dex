<template>
  <transition name="modal">
    <div class="modal-mask">
      <div class="modal-wrapper" @click="$emit('modalClosed')">
        <div class="modal-container" @click.stop>
          <div class="modal-body">
            <h1>Create Account</h1>
            <input-account
              ref="password1"
              labelType="password"
            />
            <input-account
              ref="password2"
              labelType="password"
            />
            <button class="modal-button"
              @click="clickConfirmButton"
            >
              Confirm
            </button>
          </div>
          <!-- <div class="modal-footer">
            <p>Account </p>
            <p>00000abcd00000abcd</p>
            <p>successfully created.</p>
          </div> -->
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
import InputAccount from '../../components/Inputs/InputAccount';

import api from '../../api/index';

export default {
  components: {
    InputAccount,
  },
  mounted () {
    this.$refs.password1.$refs.input.focus();
  },
  methods: {
    async clickConfirmButton () {
      const password1 = this.$refs.password1.$refs.input.value;
      const password2 = this.$refs.password2.$refs.input.value;

      if (!this.isValidPassword(password1, password2)) {
        alert('invalid password');
        return;
      }

      const account = await this.createAccount(password1);
      this.$emit('newAccountCreated', account);
    },
    isValidPassword (password1, password2) {
      if (password1 !== '' &&
          password1 !== password2
      ) {
        return false;
      }
      return true;
    },
    async createAccount (password) {
      // TODO: after developing server, have to modify.
      const account = await api.createAccount(password);

      // NOTE: following object ordering
      const index = String(this.$store.state.account.accounts.length + 1);
      return {
        index,
        address: '0x' + account.data.address.address,
        name: '',
        totalNoteAmount: '0',
        password: password,
      };
    },
  },
};
</script>

<style lang="scss" scoped>
@import "CreateAccountModal.scss";
</style>
