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
                :text="'Settle'"
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
import InputAccount from '../../components/Inputs/InputAccount';
import StandardButton from '../../components/StandardButton';

import api from '../../api/index';

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

      this.$emit('newAccountRequested', password1);

      // TODO: get synchronously event
      await new Promise(r => setTimeout(r, 2000));
      this.loading = false;
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
