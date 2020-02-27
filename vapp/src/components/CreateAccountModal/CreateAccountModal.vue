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
            <div class="button-container">
              <standard-button
                @click.native="clickConfirmButton"
                :text="'Create'"
                :loading="loading"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
import { mapState } from 'vuex';
import api from '../../api/index';

import InputAccount from '../../components/Inputs/InputAccount';
import StandardButton from '../../components/StandardButton';

export default {
  data () {
    return {
      loading: false,
    };
  },
  components: {
    InputAccount,
    StandardButton,
  },
  computed: {
    ...mapState([
      'userKey',
    ]),
  },
  mounted () {
    this.$refs.password1.$refs.input.focus();
  },
  methods: {
    async clickConfirmButton () {
      if (this.loading) return;
      this.loading = true;
      const password1 = this.$refs.password1.$refs.input.value;
      const password2 = this.$refs.password2.$refs.input.value;

      if (!this.isValidPassword(password1, password2)) {
        alert('invalid password');
        this.loading = false;
        return;
      }

      // TODO: fix
      await this.addAccount();
      this.$emit('newAccountAdded');

      this.loading = false;
    },
    async addAccount (passphrase = '1234') {
      await api.addAccount(this.userKey, passphrase);

      const accounts = await api.getAccounts(this.userKey);
      this.$store.dispatch('setAccounts', accounts);
    },
    isValidPassword (password1, password2) {
      if (password1 !== '' &&
          password1 !== password2
      ) {
        return false;
      }
      return true;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "CreateAccountModal.scss";
</style>
