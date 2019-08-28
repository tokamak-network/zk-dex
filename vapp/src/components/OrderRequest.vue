<template>
  <div class="box">
    <div class="container">
      <div class="columns">
        <div class="column">
          <h2>TRADING</h2>
        </div>
        <div class="column">
          <!-- TODO: https://vuejs.org/v2/guide/components-dynamic-async.html#keep-alive-with-Dynamic-Components -->
          <b-tabs position="is-right" type="is-toggle" v-model="activeTab" style="float: right;">
            <b-tab-item label="Make"></b-tab-item>
            <b-tab-item label="Take"></b-tab-item>
          </b-tabs>
        </div>
      </div>
      <order-request-make v-if="activeTab === 0" />
      <order-request-take v-else-if="activeTab === 1" />
    </div>

  </div>
</template>

<script>
import OrderRequestMake from './OrderRequestMake.vue';
import OrderRequestTake from './OrderRequestTake.vue';

export default {
  data () {
    return {
      activeTab: 0,
    };
  },
  components: {
    OrderRequestMake,
    OrderRequestTake,
  },
  created () {},
  beforeDestroy () {},
};
</script>

<style>
</style>
