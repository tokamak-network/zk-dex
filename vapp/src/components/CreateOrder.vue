<template>
  <div>
    <div class="columns" style="margin-top: 200px;">
      <div class="column"></div>
      <div class="column">
        <div class="field is-horizontal">
          <div class="field-label is-normal">
            <label class="label">MVK</label>
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
            <label class="label">targetToken</label>
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
  data () {
    return {
      note: null,
      proof: null,
      noteHash: null,
      price: 1
    }
  },
  created () {
    this.note = this.$store.state.selectedNote;
    this.noteHash = this.note.hash;
  },
  computed: {
    
  },
  methods: {
    makeProof() {
      this.proof = '1'
    },
    makeOrder() {
      const order = {
        type: 'buy',
        price: 1000,
        date: '2016-10-15 13:40:40'
      };
      this.$store.dispatch('ADD_ORDER', order);
    }
  },
}
</script>

<style>

</style>
