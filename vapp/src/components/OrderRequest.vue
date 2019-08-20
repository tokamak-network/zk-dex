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
  created () {
    this.$on('addNewOrder', this.addNewOrder);
    this.$on('updateNote', this.updateNote);
    this.$on('updateOrder', this.updateOrder);
  },
  beforeDestroy () {
    this.$off('addNewOrder', this.addNewOrder);
    this.$off('updateNote', this.updateNote);
    this.$off('updateOrder', this.updateOrder);
  },
  methods: {
    addNewOrder (order) {
      this.$parent.$emit('addNewOrder', order);
    },
    updateNote (note) {
      this.$parent.$emit('updateNote', note);
    },
    updateOrder (order) {
      this.$parent.$emit('updateOrder', order);
    },
  },
};
</script>

<style>
</style>
