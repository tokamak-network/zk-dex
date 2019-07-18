<template>
  <div>
    {{order}}
    <div class="columns" style="margin-top: 200px;">
      <div class="column"></div>
      <div class="column">
        <div class="field is-horizontal">
          <div class="field-label is-normal">
            <label class="label">viewing key</label>
          </div>
          <div class="field-body">
            <div class="field">
              <div class="control">
                <input class="input" type="text" v-model="viewingKey">
              </div>
            </div>
          </div>
        </div>
        <div class="field is-horizontal">
          <div class="field-label is-normal">
            <label class="label">price</label>
          </div>
          <div class="field-body">
            <div class="field">
              <div class="control">
                <input class="input" type="text">
              </div>
            </div>
          </div>
        </div>
        <div class="field is-horizontal">
          <div class="field-label is-normal">
            <label class="label">proof</label>
          </div>
          <div class="field-body">
            <div class="field">
              <div class="control">
                <input class="input" type="text">
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="column"></div>
    </div>
    <div style="height:50px; width:100%; clear:both;"></div>
    <div>
      <b-button
        rounded
        style="margin-right: 15px;"
        @click="generateViewingKey()"
      >
        GERATE VIEWING KEY
      </b-button>
      <b-button
        rounded
        style="margin-left: 15px; margin-right: 15px;"
        @click="makeProof()"
      >
        GERATE PROOF
      </b-button>
      <b-button tag="router-link"
        to="/"
        type="is-info"
        rounded
        style="margin-left: 15px;"
      >
        <span v-on:click="makeOrder()">MAKE ORDER</span>
      </b-button>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      order: null,
      viewingKey: null,
    }
  },
  created () {
    this.order = this.$store.state.noteToMakeOrder;
  },
  computed: {
    
  },
  methods: {
    generateViewingKey () {
      this.viewingKey = '123';
    }
  },
}
</script>

<style>

</style>

