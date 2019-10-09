<template>
  <div class="box">
    <div class="container">
      <div class="columns">
        <div class="column">
          <h2>DAI-ETH</h2>
          <section style="margin-top: 20px; margin-left: 15px;">
            <div class="field">
              <b-radio v-model="radio" native-value="buy">
                BUY
              </b-radio>
            </div>
            <div class="field">
              <b-radio v-model="radio" native-value="sell">
                SELL
              </b-radio>
            </div>
          </section>
        </div>
        <div class="column">
          <!-- TODO: https://vuejs.org/v2/guide/components-dynamic-async.html#keep-alive-with-Dynamic-Components -->
          <b-tabs position="is-right" type="is-toggle" v-model="activeTab" style="float: right;">
            <b-tab-item label="Make"></b-tab-item>
            <b-tab-item label="Take"></b-tab-item>
          </b-tabs>
        </div>
      </div>
      <order-request-make v-if="activeTab === 0" :radio="radio" />
      <order-request-take v-else-if="activeTab === 1" :radio="radio" />
    </div>

  </div>
</template>

<script>
import { mapMutations } from 'vuex';
import OrderRequestMake from './OrderRequestMake.vue';
import OrderRequestTake from './OrderRequestTake.vue';

export default {
  data () {
    return {
      radio: 'buy',
      activeTab: 0,
    };
  },
  watch: {
    radio (choice) {
      this.SELECT_BUY_OR_SELL(choice);
    },
    activeTab (tab) {
      if (tab === 0) {
        this.SELECT_MAKE_OR_TAKE('make');
      } else if (tab === 1) {
        this.SELECT_MAKE_OR_TAKE('take');
      }
    },
  },
  components: {
    OrderRequestMake,
    OrderRequestTake,
  },
  methods: {
    ...mapMutations(['SELECT_BUY_OR_SELL', 'SELECT_MAKE_OR_TAKE']),
  },
};
</script>

<style>
</style>
