<template>
  <div style="padding: 50px;">
    <input class="input" style="width: 20%; margin-right: 10px;" placeholder="key" v-model="userKey">
    <a class="button is-link" :class="{ 'is-static': userKey === '' }" @click="login">login</a>
  </div>
</template>

<script>
import { mapState, mapMutations } from 'vuex';
import { getViewingKey, setViewingKey } from '../api/index';
import Web3Utils from 'web3-utils';

export default {
  data () {
    return {
      userKey: '',
    };
  },
  computed: {
    ...mapState({
      key: state => state.key,
    }),
  },
  mounted () {
    if (this.key !== null) {
      this.$router.push({ path: '/wallet' });
    }
  },
  methods: {
    ...mapMutations([
      'SET_KEY',
      'SET_VIEWING_KEY',
    ]),
    login () {
      getViewingKey(this.userKey)
        .then((vk) => {
          if (vk === null) {
            // NOTE: viewing key must less than 64 bits
            vk = Web3Utils.randomHex(8);
            setViewingKey(this.userKey, vk);
          }
          this.SET_KEY(this.userKey);
          this.SET_VIEWING_KEY(vk);
          this.$router.push({ path: '/wallet' });
        });
    },
  },
};
</script>
