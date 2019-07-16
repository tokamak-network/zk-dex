<template>
  <div>
    {{ order }}
    {{ note }}
    <div class="columns" style="margin-top: 200px;">
      <div class="column"></div>
      <div class="column">
        <div class="field is-horizontal">
          <div class="field-label is-normal">
            <label class="label">order id</label>
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
        style="margin-right: 15px;"
        @click="makeProof()"
      >
        GERATE PROOF
      </b-button>
      <b-button tag="router-link"
        to="/"
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
      orderId: null,
      note: null
    }
  },
  created () {
    this.order = this.$store.state.order;
    this.note = this.$store.state.noteToTakeOrder;
  },
  computed: {
    
  },
  methods: {
    makeProof() {
      this.proof = '1'
    },
    makeOrder() {
      // const order = {
      //   type: 'buy',
      //   price: 1000,
      //   date: '2016-10-15 13:40:40'
      // };
      // this.$store.dispatch('ADD_ORDER', order);
      // this.$store.state.contractInstance().bet(10, {
      //   gas: 300000,
      //   value: this.$store.state.web3.web3Instance().toWei(this.amount, 'ether'),
      //   from: this.$store.state.web3.coinbase
      // }, (err, result) => {
      //   if (err) {
      //     this.pending = false
      //   } else {
      //     let Won = this.$store.state.contractInstance().Won()
      //     Won.watch((err, result) => {
      //       this.winEvent = result.args
      //       this.winEvent._amount = parseInt(result.args._amount, 10)
      //       this.pending = false
      //     })
      //   }
      // });
    }
  },
}
</script>

<style>

</style>
