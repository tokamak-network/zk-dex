<template>
<div class="zone">
  <div class="container">
    <div class="columns">
      <div class="column">
        <h2>TRADING</h2>
      </div>
      <div class="column">
        <b-tabs position="is-right" type="is-toggle" v-model="activeTab" style="float: right;">
          <b-tab-item label="Make"></b-tab-item>
          <b-tab-item label="Take"></b-tab-item>
        </b-tabs>
      </div>
    </div>
    <order-request-make v-if="activeTab === 0"/>
    <order-request-take v-if="activeTab === 1"/>
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
};
</script>

<style>
</style>
